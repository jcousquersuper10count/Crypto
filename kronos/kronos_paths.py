"""Kronos sampling that keeps every forecast path (the stock predictor averages them)."""
import os, sys
import numpy as np
import pandas as pd
import torch

KRONOS_DIR = os.environ.get("KRONOS_DIR", os.path.join(os.path.dirname(__file__), "Kronos"))
sys.path.insert(0, KRONOS_DIR)
from model import Kronos, KronosTokenizer  # noqa: E402
from model.kronos import sample_from_logits  # noqa: E402

MODELS = {
    "mini": ("NeoQuasar/Kronos-Tokenizer-2k", "NeoQuasar/Kronos-mini", 2048),
    "small": ("NeoQuasar/Kronos-Tokenizer-base", "NeoQuasar/Kronos-small", 512),
    "base": ("NeoQuasar/Kronos-Tokenizer-base", "NeoQuasar/Kronos-base", 512),
}
COLS = ["open", "high", "low", "close", "volume", "amount"]


def load(name="small"):
    tk, mn, ctx = MODELS[name]
    tok = KronosTokenizer.from_pretrained(tk).eval()
    m = Kronos.from_pretrained(mn).eval()
    return tok, m, ctx


def stamps(dates):
    d = pd.DatetimeIndex(dates)
    return np.stack([d.minute, d.hour, d.weekday, d.day, d.month], axis=1).astype(np.float32)


def prepare(df):
    """df with date, open, high, low, close, volume -> normalised array, mean, std."""
    x = df[["open", "high", "low", "close", "volume"]].to_numpy(np.float64)
    amount = x[:, 4] * x[:, :4].mean(axis=1)
    x = np.concatenate([x, amount[:, None]], axis=1)
    mean, std = x.mean(axis=0), x.std(axis=0)
    xn = np.clip((x - mean) / (std + 1e-5), -5, 5)
    return xn.astype(np.float32), mean, std


@torch.no_grad()
def sample_paths(tok, model, max_ctx, windows, future_dates, pred_len, n_samples=32, T=1.0, top_p=0.9, seed=0):
    """windows: list of DataFrames (same length). future_dates: list of DatetimeIndex (len pred_len).
    Returns array (n_windows, n_samples, pred_len) of predicted closes in price units."""
    torch.manual_seed(seed)
    xs, xst, yst, mus, sds = [], [], [], [], []
    for w, fd in zip(windows, future_dates):
        xn, mu, sd = prepare(w)
        xs.append(xn); mus.append(mu); sds.append(sd)
        xst.append(stamps(w["date"])); yst.append(stamps(fd))
    x = torch.from_numpy(np.stack(xs)); x_stamp = torch.from_numpy(np.stack(xst)); y_stamp = torch.from_numpy(np.stack(yst))
    B = x.size(0)
    rep = lambda t: t.unsqueeze(1).repeat(1, n_samples, *([1] * (t.dim() - 1))).reshape(-1, *t.shape[1:])
    x, x_stamp, y_stamp = rep(x), rep(x_stamp), rep(y_stamp)

    x_token = tok.encode(x, half=True)
    L = x.size(1)
    bs = x_token[0].size(0)
    full_stamp = torch.cat([x_stamp, y_stamp], dim=1)
    pre = x_token[0].new_zeros(bs, max_ctx); post = x_token[1].new_zeros(bs, max_ctx)
    n0 = min(L, max_ctx)
    pre[:, :n0] = x_token[0][:, L - n0:]; post[:, :n0] = x_token[1][:, L - n0:]
    gen_pre = x_token[0].new_empty(bs, pred_len); gen_post = x_token[1].new_empty(bs, pred_len)
    for i in range(pred_len):
        cur = L + i
        wl = min(cur, max_ctx)
        stamp = full_stamp[:, max(0, cur - max_ctx):cur, :].contiguous()
        s1_logits, ctx = model.decode_s1(pre[:, :wl], post[:, :wl], stamp)
        sp = sample_from_logits(s1_logits[:, -1, :], temperature=T, top_k=0, top_p=top_p, sample_logits=True)
        s2_logits = model.decode_s2(ctx, sp)
        so = sample_from_logits(s2_logits[:, -1, :], temperature=T, top_k=0, top_p=top_p, sample_logits=True)
        gen_pre[:, i] = sp.squeeze(-1); gen_post[:, i] = so.squeeze(-1)
        if cur < max_ctx:
            pre[:, cur] = sp.squeeze(-1); post[:, cur] = so.squeeze(-1)
        else:
            pre = torch.roll(pre, -1, 1); post = torch.roll(post, -1, 1)
            pre[:, -1] = sp.squeeze(-1); post[:, -1] = so.squeeze(-1)
    full_pre = torch.cat([x_token[0], gen_pre], 1); full_post = torch.cat([x_token[1], gen_post], 1)
    tot = L + pred_len
    st = max(0, tot - max_ctx)
    z = tok.decode([full_pre[:, st:tot].contiguous(), full_post[:, st:tot].contiguous()], half=True)
    z = z[:, -pred_len:, :].cpu().numpy().reshape(B, n_samples, pred_len, -1)
    mu = np.stack(mus)[:, None, None, :]; sd = np.stack(sds)[:, None, None, :]
    z = z * (sd + 1e-5) + mu
    return z[..., 3]  # close
