import os
import asyncio
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api.endpoints import btc, stock, notify, battle_commander
from app.routers import macro
from app.api.endpoints.notify import trigger_daily_report

app = FastAPI(
    title="Pangang API",
    description="Backend API for Pangang Investment Dashboard",
    version="1.0.0"
)

app.include_router(btc.router, prefix="/api/btc", tags=["btc"])
app.include_router(stock.router, prefix="/api/stock", tags=["stock"])
app.include_router(notify.router, prefix="/api/notify", tags=["notify"])
app.include_router(macro.router, prefix="/api/macro", tags=["macro"])
app.include_router(battle_commander.router, prefix="/api/commander", tags=["battle_commander"])

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
enable_daily_scheduler = os.getenv("ENABLE_DAILY_SCHEDULER", "false").lower() == "true"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Pangang API is running"}

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "frontend_url": frontend_url,
        "scheduler_enabled": enable_daily_scheduler
    }

# Simple Scheduler Logic
async def scheduler_loop():
    print("📅 Daily Scheduler started. Waiting for 08:00...")
    while True:
        try:
            now = datetime.now()
            # Target: 08:00 Today
            target = now.replace(hour=8, minute=0, second=0, microsecond=0)
            
            # If already passed 08:00, schedule for tomorrow
            if now >= target:
                target += timedelta(days=1)
                
            wait_seconds = (target - now).total_seconds()
            print(f"⏳ Next Daily Report in {wait_seconds/3600:.1f} hours ({target})")
            
            await asyncio.sleep(wait_seconds)
            
            print("🚀 Sending Daily Report...")
            # We don't pass webhook_url, relying on env var in NotificationService
            await trigger_daily_report()
            
            # Wait a bit to avoid double firing
            await asyncio.sleep(60)
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Scheduler Error: {e}")
            await asyncio.sleep(60) # Retry after 1 min

@app.on_event("startup")
async def start_scheduler():
    if enable_daily_scheduler:
        asyncio.create_task(scheduler_loop())

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
