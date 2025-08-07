# main.py
"""
HexCarb AI Command Center — Full CLI with config, modules, help, aliases, and session logging
"""

import os
import json
import glob
import importlib.util
from datetime import datetime

# --- Files / defaults ---
CONFIG_FILE = "config.json"

DEFAULT_CONFIG = {
    "company_name": "HexCarb Advanced Pvt Ltd",
    "modules_enabled": {
        "rd": True,
        "procurement": False,
        "accounting": False
    },
    "paths": {
        "data": "data",
        "logs": "logs",
        "modules": "modules"
    },
    "welcome_message": "HexCarb AI Command Center — ONLINE"
}

# --- Help & aliases ---
COMMANDS_HELP = {
    "help": "Show this help message. Usage: help",
    "module list": "List all available modules. Alias: ml",
    "module run <name> [args]": "Run a specific module with optional arguments. Alias: mr",
    "module scaffold <name>": "Create a new module template. Alias: ms",
    "config show": "Display current configuration settings. Alias: cs",
    "config set <key> <value>": "Update a configuration value. Alias: cset",
    "config reset": "Reset config.json to defaults",
    "log <message>": "Write a message to logs. Alias: lg",
    "exit": "Exit the Command Center."
}

ALIASES = {
    "ml": "module list",
    "mr": "module run",      # usage: mr <modname> [args...]
    "ms": "module scaffold",
    "cs": "config show",
    "cset": "config set",
    "lg": "log"
}

def show_help():
    print("\nAvailable Commands:")
    for cmd, desc in COMMANDS_HELP.items():
        print(f"  {cmd:<36} - {desc}")
    print()

# --- Config helpers ---
def load_config():
    if not os.path.exists(CONFIG_FILE):
        save_config(DEFAULT_CONFIG)
        return DEFAULT_CONFIG.copy()
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        merged = DEFAULT_CONFIG.copy()
        merged.update(cfg)
        for k in ("modules_enabled", "paths"):
            nested = DEFAULT_CONFIG.get(k, {}).copy()
            nested.update(cfg.get(k, {}))
            merged[k] = nested
        return merged
    except Exception as e:
        print(f"[WARN] Failed to load config ({e}). Using defaults.")
        return DEFAULT_CONFIG.copy()

def save_config(cfg):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        print(f"[ERROR] Could not save config: {e}")

# --- Ensure standard folders ---
def ensure_paths(cfg):
    os.makedirs(cfg["paths"]["logs"], exist_ok=True)
    os.makedirs(cfg["paths"]["data"], exist_ok=True)
    os.makedirs(cfg["paths"]["modules"], exist_ok=True)

# --- Session logging (per-run) ---
def new_session_logger(cfg):
    ensure_paths(cfg)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    session_log_file = os.path.join(cfg["paths"]["logs"], f"session_{ts}.log")
    # create empty file
    open(session_log_file, "a", encoding="utf-8").close()
    return session_log_file

def log_session(session_log_file, message):
    try:
        with open(session_log_file, "a", encoding="utf-8") as f:
            f.write(f"{datetime.now().isoformat()} - {message}\n")
    except Exception:
        # don't crash if session log fails
        pass

# --- Persistent logging helper (system.log) ---
def log_message(cfg, msg):
    ensure_paths(cfg)
    log_file = os.path.join(cfg["paths"]["logs"], "system.log")
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"{datetime.now()} — {msg}\n")
    print(f"[LOG] Saved: {msg}")

# --- Boot / status ---
def boot_message(cfg):
    now = datetime.now()
    print("==============================================")
    print(cfg.get("welcome_message", DEFAULT_CONFIG["welcome_message"]))
    print(f"{cfg.get('company_name', DEFAULT_CONFIG['company_name'])}")
    print(f"Boot time: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print("Type 'help' for commands.")
    print("==============================================")

def status(cfg):
    now = datetime.now()
    modules = cfg.get("modules_enabled", {})
    enabled = [k for k,v in modules.items() if v]
    print(f"[STATUS] System online — {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"         Company: {cfg.get('company_name')}")
    print(f"         Enabled modules: {', '.join(enabled) if enabled else 'none'}")
    print(f"         Paths: data={cfg['paths']['data']}, logs={cfg['paths']['logs']}, modules={cfg['paths']['modules']}")

# --- Config CLI functions ---
def show_config(cfg):
    print(json.dumps(cfg, indent=2))

def convert_value(v):
    # try bool, int, float, else string (strip quotes)
    if isinstance(v, str):
        s = v.strip()
        if s.lower() in ("true", "false"):
            return s.lower() == "true"
        if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
            return s[1:-1]
        try:
            if "." in s:
                return float(s)
            return int(s)
        except:
            return s
    return v

def set_config(cfg, key_path, value):
    parts = key_path.split(".")
    target = cfg
    for p in parts[:-1]:
        if p not in target or not isinstance(target[p], dict):
            target[p] = {}
        target = target[p]
    last = parts[-1]
    target[last] = convert_value(value)
    save_config(cfg)
    print(f"[CONFIG] Set {key_path} = {target[last]}")

def reset_config():
    save_config(DEFAULT_CONFIG.copy())
    print("[CONFIG] Reset to default config.json")

# --- Module loader helpers ---
def discover_modules(cfg):
    mods = {}
    mod_path = cfg["paths"]["modules"]
    os.makedirs(mod_path, exist_ok=True)
    pattern = os.path.join(mod_path, "*.py")
    for filepath in glob.glob(pattern):
        name = os.path.splitext(os.path.basename(filepath))[0]
        mods[name] = filepath
    return mods

def load_module_from_path(path):
    name = os.path.splitext(os.path.basename(path))[0]
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception as e:
        return None, f"Failed to load module {name}: {e}"
    return mod, None

def module_list(cfg):
    mods = discover_modules(cfg)
    if not mods:
        print("[MODULE] No modules found in ./modules")
        return
    print("[MODULE] Found modules:")
    for name, path in mods.items():
        mod, err = load_module_from_path(path)
        desc = getattr(mod, "meta", {}).get("description", "<no meta>") if mod else f"<load error: {err}>"
        print(f"  - {name}: {desc}")

def module_run(cfg, modname, args):
    mods = discover_modules(cfg)
    if modname not in mods:
        print(f"[MODULE] Module '{modname}' not found.")
        return
    mod, err = load_module_from_path(mods[modname])
    if not mod:
        print(f"[MODULE] Error loading module: {err}")
        return
    if not hasattr(mod, "run"):
        print(f"[MODULE] Module '{modname}' has no `run(args, cfg)` function.")
        return
    try:
        result = mod.run(args, cfg)
        print("[MODULE] Result:")
        if isinstance(result, (dict, list)):
            print(json.dumps(result, indent=2))
        else:
            print(result)
    except Exception as e:
        print(f"[MODULE] Exception during module run: {e}")

def module_scaffold(cfg, name):
    mod_dir = cfg["paths"]["modules"]
    os.makedirs(mod_dir, exist_ok=True)
    # create name_module.py unless name already contains _module
    filename = f"{name}_module.py" if not name.endswith("_module") else f"{name}.py"
    path = os.path.join(mod_dir, filename)
    if os.path.exists(path):
        print(f"[MODULE] {path} already exists.")
        return
    template = f'''# modules/{filename}
"""
Scaffolded module: {name}
"""
meta = {{
    "name": "{name}",
    "description": "Scaffolded module {name}"
}}

def run(args, cfg):
    return "Hello from {name} module. Args: " + str(args)
'''
    with open(path, "w", encoding="utf-8") as f:
        f.write(template)
    print(f"[MODULE] Scaffolded new module at {path}")

# --- Main loop ---
def main():
    # Load config & set up folders
    cfg = load_config()
    ensure_paths(cfg)

    # Setup session log
    session_log_file = new_session_logger(cfg)
    log_session(session_log_file, "Session started")

    # Show boot
    boot_message(cfg)
    log_session(session_log_file, "Boot banner displayed")

    # Primary CLI loop
    while True:
        try:
            raw = input("> ").strip()
            if not raw:
                continue

            # expand alias if first token matches
            parts = raw.split()
            first = parts[0]
            if first in ALIASES:
                alias_expansion = ALIASES[first]
                # if alias expands to multi-token (e.g., "module run"), recompose
                # allow passing rest of args after alias
                remaining = parts[1:]
                new_cmd = alias_expansion.split() + remaining
                command = " ".join(new_cmd)
            else:
                command = raw

            # handle core commands
            if command == "help":
                show_help()
                log_session(session_log_file, "Displayed help")

            elif command == "status":
                status(cfg)
                log_session(session_log_file, "Checked status")

            elif command.startswith("log "):
                msg = command[4:].strip()
                log_message(cfg, msg)
                log_session(session_log_file, f"Logged message: {msg}")

            elif command == "config show":
                show_config(cfg)
                log_session(session_log_file, "Displayed config")

            elif command.startswith("config set "):
                tail = command[len("config set "):].strip()
                parts = tail.split(" ", 1)
                if len(parts) != 2:
                    print("[ERROR] Usage: config set <key> <value>")
                else:
                    key, val = parts
                    set_config(cfg, key, val)
                    cfg = load_config()  # reload merged config
                    log_session(session_log_file, f"Config set {key} = {val}")

            elif command == "config reset":
                reset_config()
                cfg = load_config()
                log_session(session_log_file, "Config reset to default")

            elif command.startswith("module "):
                sub_parts = command.split()
                if len(sub_parts) == 1:
                    print("[MODULE] Usage: module list | module run <name> [args...] | module scaffold <name>")
                else:
                    sub = sub_parts[1]
                    if sub == "list":
                        module_list(cfg)
                        log_session(session_log_file, "Listed modules")
                    elif sub == "run":
                        if len(sub_parts) < 3:
                            print("[MODULE] Usage: module run <name> [args...]")
                        else:
                            modname = sub_parts[2]
                            margs = sub_parts[3:]
                            module_run(cfg, modname, margs)
                            log_session(session_log_file, f"Ran module {modname} args={margs}")
                    elif sub == "scaffold":
                        if len(sub_parts) != 3:
                            print("[MODULE] Usage: module scaffold <name>")
                        else:
                            module_scaffold(cfg, sub_parts[2])
                            log_session(session_log_file, f"Scaffolded module {sub_parts[2]}")
                    else:
                        print(f"[MODULE] Unknown subcommand: {sub}")

            elif command == "exit":
                print("Shutting down Command Center... Goodbye.")
                log_session(session_log_file, "Session ended by user")
                break

            else:
                print(f"[ERROR] Unknown command: {command}. Type 'help' for available commands.")
                log_session(session_log_file, f"Unknown command attempted: {command}")

        except (KeyboardInterrupt, EOFError):
            print("\nShutting down Command Center... Goodbye.")
            log_session(session_log_file, "Session interrupted by keyboard/EOF")
            break

        except Exception as e:
            # catch-all so CLI doesn't die
            print(f"[ERROR] {e}")
            log_session(session_log_file, f"Unhandled exception: {e}")

if __name__ == "__main__":
    main()
