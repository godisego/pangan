import akshare as ak
import os
import pandas as pd

# Disable proxy
for key in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"]:
    os.environ.pop(key, None)

print("Checking PMI...")
try:
    df = ak.macro_china_pmi()
    print("PMI Columns:", df.columns)
    print("PMI Head:", df.head(1).to_dict('records'))
except Exception as e:
    print("PMI Error:", e)

print("\nChecking News for 000001...")
try:
    df = ak.stock_news_em(symbol="000001")
    print("News Columns:", df.columns)
    print("News Head:", df.head(1).to_dict('records'))
except Exception as e:
    print("News Error:", e)
