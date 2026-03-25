import akshare as ak

def search_ak(keyword):
    methods = [m for m in dir(ak) if keyword in m.lower()]
    return methods

keywords = ["up_down", "summary", "breadth", "sentiment", "overview", "count", "asc", "desc"]
for k in keywords:
    print(f"--- {k} ---")
    print(search_ak(k))
