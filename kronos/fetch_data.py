"""Daily OHLCV history for the tracked coins, converted to EUR.

Sources (public endpoints, no key):
  BTC, ATOM : Coinbase Exchange EUR pairs (paged, several years)
  PLUME     : Kraken PLUMEUSD (last 720 days max)
  CETUS     : Gate.io CETUS_USDT (up to ~1000 days)
USD/USDT prices are converted to EUR with Kraken's daily EUR/USD close.
"""
import json, time, urllib.request
from datetime import datetime, timezone, timedelta
import pandas as pd

UA = {"User-Agent": "vault-signals/1.0"}


def get(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:  # noqa
            if i == 3:
                raise
            time.sleep(2 + 3 * i)


def coinbase(product, days=1800):
    rows, end = [], datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start_limit = end - timedelta(days=days)
    while end > start_limit:
        start = max(start_limit, end - timedelta(days=299))
        url = (f"https://api.exchange.coinbase.com/products/{product}/candles?granularity=86400"
               f"&start={start.isoformat()}&end={end.isoformat()}")
        data = get(url)
        if not data:
            break
        rows += data
        end = start
        time.sleep(0.35)
    df = pd.DataFrame(rows, columns=["t", "low", "high", "open", "close", "volume"])
    df["date"] = pd.to_datetime(df["t"], unit="s", utc=True)
    return df


def kraken(pair):
    data = get(f"https://api.kraken.com/0/public/OHLC?pair={pair}&interval=1440")
    key = [k for k in data["result"] if k != "last"][0]
    df = pd.DataFrame(data["result"][key], columns=["t", "open", "high", "low", "close", "vwap", "volume", "count"])
    df["date"] = pd.to_datetime(df["t"], unit="s", utc=True)
    return df


def gate(pair, limit=1000):
    data = get(f"https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair={pair}&interval=1d&limit={limit}")
    # [t, quote_volume, close, high, low, open, base_volume, closed]
    df = pd.DataFrame(data, columns=["t", "qvol", "close", "high", "low", "open", "volume", "closed"])
    df["t"] = df["t"].astype(int)
    df["date"] = pd.to_datetime(df["t"], unit="s", utc=True)
    return df


def clean(df):
    df = df[["date", "open", "high", "low", "close", "volume"]].copy()
    for c in ["open", "high", "low", "close", "volume"]:
        df[c] = df[c].astype(float)
    df = df.drop_duplicates("date").sort_values("date").reset_index(drop=True)
    # drop today's unfinished candle
    today = pd.Timestamp.now(tz="UTC").normalize()
    df = df[df["date"] < today].reset_index(drop=True)
    return df


COINS = {
    "BTC": {"name": "Bitcoin", "src": "Coinbase BTC-EUR", "fetch": lambda: coinbase("BTC-EUR"), "quote": "EUR"},
    "ATOM": {"name": "Cosmos", "src": "Coinbase ATOM-EUR", "fetch": lambda: coinbase("ATOM-EUR"), "quote": "EUR"},
    "PLUME": {"name": "Plume", "src": "Kraken PLUME-USD", "fetch": lambda: kraken("PLUMEUSD"), "quote": "USD"},
    "CETUS": {"name": "Cetus", "src": "Gate.io CETUS-USDT", "fetch": lambda: gate("CETUS_USDT"), "quote": "USD"},
}


def eurusd():
    """USD per EUR, daily. Coinbase USDT-EUR (EUR per USDT) has the longest history."""
    df = clean(coinbase("USDT-EUR"))
    return 1.0 / df.set_index("date")["close"]


def load_all():
    fx = eurusd()
    out = {}
    for sym, c in COINS.items():
        df = clean(c["fetch"]())
        if c["quote"] == "USD":
            rate = fx.reindex(df["date"]).ffill().bfill().values
            for col in ["open", "high", "low", "close"]:
                df[col] = df[col] / rate
        out[sym] = df
    return out


if __name__ == "__main__":
    data = load_all()
    for s, df in data.items():
        df.to_csv(f"{s}.csv", index=False)
        print(s, len(df), df["date"].iloc[0].date(), "->", df["date"].iloc[-1].date(), "last close EUR", round(df["close"].iloc[-1], 6))
