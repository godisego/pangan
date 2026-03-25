import efinance as ef
import time

def test_efinance():
    print("Testing efinance.stock.get_realtime_quotes()...")
    start = time.time()
    try:
        # efinance fetch all real time quotes
        df = ef.stock.get_realtime_quotes()
        elapsed = time.time() - start
        
        print(f"Time: {elapsed:.4f}s")
        print(f"Rows: {len(df)}")
        
        # Columns might be simplified Chinese
        # checking columns
        # print(df.columns)
        
        # usually 涨跌幅 is '涨跌幅'
        up = len(df[df['涨跌幅'] > 0])
        down = len(df[df['涨跌幅'] < 0])
        print(f"Up: {up}, Down: {down}")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_efinance()

