import socket
from functools import lru_cache
from typing import Dict

COMMON_PROXY_CANDIDATES = [
    "socks5h://127.0.0.1:7892",
    "http://127.0.0.1:7892",
    "socks5h://127.0.0.1:7890",
    "http://127.0.0.1:7890",
]


def _port_reachable(host: str, port: int, timeout: float = 0.25) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _normalize_proxy_url(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""
    if "://" not in raw:
        return f"http://{raw}"
    return raw


@lru_cache(maxsize=1)
def detect_outbound_proxy_url() -> str:
    for candidate in COMMON_PROXY_CANDIDATES:
        scheme, endpoint = candidate.split("://", 1)
        host, port = endpoint.rsplit(":", 1)
        if _port_reachable(host, int(port)):
            return candidate

    return ""


def ensure_outbound_proxy_env() -> str:
    return detect_outbound_proxy_url()


def build_request_kwargs(timeout: float, use_proxy: bool = True) -> Dict[str, object]:
    kwargs: Dict[str, object] = {"timeout": timeout}
    if use_proxy:
        proxy_url = detect_outbound_proxy_url()
        if proxy_url:
            kwargs["proxies"] = {"http": proxy_url, "https": proxy_url}
    else:
        # requests 会读取环境变量代理；显式置空才能保证国内源直连
        kwargs["proxies"] = {"http": "", "https": ""}
    return kwargs
