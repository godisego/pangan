import akshare as ak
import time
import os

# Disable proxy
for key in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "ALL_PROXY", "all_proxy"]:
    os.environ.pop(key, None)

print("\nTesting stock_zh_a_spot_em (All Spot)...")
start = time.time()
try:
    df = ak.stock_zh_a_spot_em()
    print(f"Time: {time.time()-start:.2f}s")
    if df is not None:
        print(f"Cols: {df.columns}")
        print(f"Shape: {df.shape}")
        print(f"Up: {len(df[df['涨跌幅'] > 0])}")
except Exception as e:
    print(f"Error: {e}")
