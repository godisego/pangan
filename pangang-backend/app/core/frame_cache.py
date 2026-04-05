# -*- coding: utf-8 -*-
from pathlib import Path
from typing import Optional

import pandas as pd


class FrameCache:
    def __init__(self, cache_dir: Optional[Path] = None):
        self.cache_dir = Path(cache_dir or (Path(__file__).resolve().parent.parent / "data_cache"))
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _namespace_dir(self, namespace: str) -> Path:
        directory = self.cache_dir / namespace
        directory.mkdir(parents=True, exist_ok=True)
        return directory

    def load_frame(self, namespace: str, key: str) -> Optional[pd.DataFrame]:
        directory = self._namespace_dir(namespace)
        parquet_path = directory / f"{key}.parquet"
        pickle_path = directory / f"{key}.pkl"

        if parquet_path.exists():
            try:
                return pd.read_parquet(parquet_path)
            except Exception:
                pass

        if pickle_path.exists():
            try:
                return pd.read_pickle(pickle_path)
            except Exception:
                pass

        return None

    def save_frame(self, namespace: str, key: str, frame: pd.DataFrame):
        directory = self._namespace_dir(namespace)
        parquet_path = directory / f"{key}.parquet"
        pickle_path = directory / f"{key}.pkl"

        try:
            frame.to_parquet(parquet_path, index=False)
            if pickle_path.exists():
                pickle_path.unlink(missing_ok=True)
            return
        except Exception:
            frame.to_pickle(pickle_path)


frame_cache = FrameCache()
