import akshare as ak
import os
import pandas as pd

# Disable proxy
for key in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"]:
    os.environ.pop(key, None)

print("Checking CLS Telegraph...")
try:
    # stock_telegraph_cls
    df = ak.stock_telegraph_cls()
    print("Columns:", df.columns)
    print("Head:", df.head(1).to_dict('records'))
except Exception as e:
    print("CLS Error:", e)
