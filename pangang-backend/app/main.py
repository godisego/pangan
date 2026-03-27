import os
import asyncio
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api.endpoints import btc, stock, notify, battle_commander, chat
from app.routers import macro
from app.api.endpoints.notify import send_daily_report_now
from app.services.notification_service import notification_service

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
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
allow_origins = [
    frontend_url,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
enable_daily_scheduler = os.getenv("ENABLE_DAILY_SCHEDULER", "true").lower() == "true"

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(allow_origins)),
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
        "allow_origins": list(dict.fromkeys(allow_origins)),
        "scheduler_enabled": enable_daily_scheduler,
        "schedule": notification_service.get_config(masked=False).get("schedule", {}),
    }

async def scheduler_loop():
    print("📅 Notification Scheduler started.")
    while True:
        try:
            schedule = notification_service.get_config(masked=False).get("schedule", {})
            timezone_name = schedule.get("timezone") or "Asia/Shanghai"
            try:
                now = datetime.now(ZoneInfo(timezone_name))
            except Exception:
                now = datetime.now()

            if notification_service.should_send_daily(now):
                print(f"🚀 Sending scheduled daily report at {now.isoformat()}")
                result = await send_daily_report_now()
                if result.get("status") != "error":
                    notification_service.mark_daily_sent(now)
                print(f"📬 Scheduled report result: {result.get('status')}")

            await asyncio.sleep(20)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Scheduler Error: {e}")
            await asyncio.sleep(60)

@app.on_event("startup")
async def start_scheduler():
    if enable_daily_scheduler:
        asyncio.create_task(scheduler_loop())

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
