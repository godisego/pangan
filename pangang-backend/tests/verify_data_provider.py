# -*- coding: utf-8 -*-
import sys
import os

# Ensure we can import app
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.data_provider import DataFetcherManager
import logging

# Configure logging to see output
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def verify():
    logger.info("Initializing DataFetcherManager...")
    manager = DataFetcherManager()
    
    logger.info("--- Testing fetch_market_indices ---")
    indices = manager.fetch_market_indices()
    if indices:
        logger.info(f"Indices fetched successfully: {indices.get('index', {}).get('name')}, Value: {indices.get('index', {}).get('value')}")
        logger.info(f"Volume: {indices.get('volume')}, NorthFlow: {indices.get('northFlow')}")
    else:
        logger.error("Failed to fetch indices")

    logger.info("--- Testing fetch_hot_sectors ---")
    sectors = manager.fetch_hot_sectors()
    if sectors:
        logger.info(f"Fetched {len(sectors)} hot sectors")
        logger.info(f"Top sector: {sectors[0]}")
    else:
        logger.error("Failed to fetch hot sectors")

    logger.info("--- Testing get_realtime_quotes ---")
    quotes = manager.get_realtime_quotes(['sh000001', '600519'])
    if quotes:
        logger.info(f"Fetched quotes: {quotes.keys()}")
        if 'sh000001' in quotes:
            logger.info(f"sh000001: {quotes['sh000001']}")
        if '600519' in quotes:
            logger.info(f"600519 details: {quotes['600519']}")
    else:
        logger.error("Failed to fetch quotes")

if __name__ == "__main__":
    verify()
