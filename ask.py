# ask.py — HexCarb quick CLI (default: gemma:2b)
import argparse
import requests
import sys

DEFAULT_HOST = "http://localhost:11434"
DEFAULT_MODEL = "gemma:2b"   # fast default

def ask_ollama(prompt, model=DEFAULT_MODEL, host=DEFAULT_HOST, timeout=120):
    url = host.rstrip("/") + "/api/generate"
    payload = {"model": model, "prompt": prompt, "stream": False}
    try:
        resp = requests.post(url, json=payload, timeout=timeout)
    except requests.exceptions.ConnectionError:
        print(f"[Error] Could not connect to Ollama at {host}. Is Ollama running?")
        return
    except Exception as e:
        print("[Error] Request failed:", str(e))
        return

    if resp.status_code != 200:
        print(f"[Error] HTTP {resp.status_code} - {resp.text}")
        return

    try:
        data = resp.json()
    except Exception:
        print("[Error] Could not parse JSON response:", resp.text)
        return

    # Try common response shapes from Ollama
    if isinstance(data, dict) and "response" in data:
        print(data.get("response", "").strip())
    elif isinstance(data, dict) and "results" in data and isinstance(data["results"], list):
        out = "\n".join(str(r.get("content","")) for r in data["results"])
        print(out.strip())
    else:
        print(data)

def main():
    parser = argparse.ArgumentParser(description="Ask Ollama from HexCarb (default: gemma:2b)")
    parser.add_argument("prompt", nargs="*", help="Your question for the model")
    parser.add_argument("-m", "--model", default=DEFAULT_MODEL, help="Model name (default: gemma:2b)")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Ollama host URL (default: http://localhost:11434)")
    parser.add_argument("--warmup", action="store_true", help="Send a small warmup ping and exit")
    args = parser.parse_args()

    if args.warmup:
        ask_ollama("Warm-up: say OK.", model=args.model, host=args.host)
        return

    if not args.prompt:
        parser.print_help()
        sys.exit(0)

    prompt_text = " ".join(args.prompt)
    ask_ollama(prompt_text, model=args.model, host=args.host)

if __name__ == "__main__":
    main()
