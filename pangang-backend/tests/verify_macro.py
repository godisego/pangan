# -*- coding: utf-8 -*-
import sys
import os
import asyncio

# Ensure we can import app
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.services.macro_analyzer import macro_analyzer
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def verify():
    logger.info("Initializing MacroAnalyzer verification...")
    
    # Check if API Key exists
    if os.getenv("GEMINI_API_KEY"):
        logger.info("GEMINI_API_KEY found.")
    else:
        logger.warning("GEMINI_API_KEY not found. Expecting mock response.")

    dashboard = await macro_analyzer.generate_strategy_dashboard()
    
    if dashboard:
        logger.info("Dashboard generated successfully.")
        logger.info(f"Mainline: {dashboard.get('macro_mainline')}")
        logger.info(f"Catalysts: {len(dashboard.get('catalysts', []))} items")
        logger.info(f"Defense: {dashboard.get('defense')}")
        logger.info(f"Operational Logic: {dashboard.get('operational_logic')}")
    else:
        logger.error("Failed to generate dashboard.")

if __name__ == "__main__":
    asyncio.run(verify())
