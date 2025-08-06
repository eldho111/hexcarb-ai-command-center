# warmup_daemon.py — simple loop that pings Ollama every interval minutes
import time
import requests
import os
import sys

HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.environ.get("HEXCARB_MODEL", "gemma:2b")
INTERVAL_MINUTES = 8  # ping every 8 minutes (adjust if you like)
SLEEP = INTERVAL_MINUTES * 60

def warmup_once():
    url = HOST.rstrip("/") + "/api/generate"
    payload = {"model": MODEL, "prompt": "Warm-up ping: Say OK.", "stream": False}
    try:
        r = requests.post(url, json=payload, timeout=60)
        print(f"[warmup] status {r.status_code}")
        try:
            print("[warmup] response:", r.json())
        except Exception:
            print("[warmup] raw:", r.text[:200])
    except Exception as e:
        print("[warmup] error:", e)

def main():
    print(f"Warmup daemon starting. Host={HOST} Model={MODEL} Interval={INTERVAL_MINUTES}m")
    try:
        while True:
            warmup_once()
            time.sleep(SLEEP)
    except KeyboardInterrupt:
        print("Warmup daemon stopped by user.")
        sys.exit(0)

if __name__ == "__main__":
    main()
