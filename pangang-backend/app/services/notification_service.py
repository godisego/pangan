import requests
import os
from datetime import datetime
import json

class NotificationService:
    def __init__(self):
        self.config_file = "config.json"
        # Priority: Env Var > Config File
        self.webhook_url = os.getenv("FEISHU_WEBHOOK", "")
        self.load_config()

    def load_config(self):
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    data = json.load(f)
                    # Config file overrides env if present? Or Env overrides config?
                    # Usually Env is strictly better, but here user wants to set it via UI.
                    # So Config File should take precedence effectively if user sets it.
                    if data.get("webhook_url"):
                        self.webhook_url = data.get("webhook_url")
        except Exception as e:
            print(f"Error loading config: {e}")

    def save_config(self, webhook_url):
        self.webhook_url = webhook_url
        try:
            with open(self.config_file, 'w') as f:
                json.dump({"webhook_url": webhook_url}, f)
            return True
        except Exception as e:
            print(f"Error saving config: {e}")
            return False

    def send_card(self, title: str, content: str, elements: list = None, webhook_url: str = None):
        """
        Send a Feishu Interactive Card.
        content: Markdown string for main body.
        elements: List of extra card elements (optional).
        """
        target_url = webhook_url or self.webhook_url
        if not target_url:
            print("Warning: No Feishu Webhook URL configured.")
            return {"status": "error", "message": "No webhook URL provided"}
            
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Basic card structure
        card = {
            "config": {
                "wide_screen_mode": True
            },
            "header": {
                "title": {
                    "tag": "plain_text",
                    "content": title
                },
                "template": "blue" 
            },
            "elements": [
                {
                    "tag": "div",
                    "text": {
                        "tag": "lark_md",
                        "content": content
                    }
                },
                {
                    "tag": "note",
                    "elements": [
                        {
                            "tag": "plain_text",
                            "content": f"发布时间: {timestamp} | 来自: 盘感AI"
                        }
                    ]
                }
            ]
        }
        
        if elements:
            # Insert extra elements before the Note
            # Reverse loop to keep order if inserting at fixed index 1?
            # Or just append before note.
            # card["elements"] has 2 items initially: Body, Note.
            # Insert at index 1.
            for el in reversed(elements):
                card["elements"].insert(1, el)

        payload = {
            "msg_type": "interactive",
            "card": card
        }
        
        try:
            res = requests.post(target_url, json=payload)
            return res.json()
        except Exception as e:
            print(f"Error sending feishu message: {e}")
            return {"status": "error", "message": str(e)}

notification_service = NotificationService()
