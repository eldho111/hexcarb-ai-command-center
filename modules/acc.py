"""
modules/acc.py

Accounting module for HexCarb AI Command Center.

Data files (in data/):
  - acc_income.json
  - acc_expenses.json

Commands via run(args, cfg):
  add_income <date YYYY-MM-DD> <amount> <category> <source> <notes>
  add_expense <date YYYY-MM-DD> <amount> <category> <vendor> <notes>
  list_income
  list_expenses
  summary [month|quarter|year]
  export csv
  export md

All commands are tolerant of missing optional fields and will fall back to sensible defaults.
"""

import os
import json
from datetime import datetime
from typing import List
from decimal import Decimal, InvalidOperation

meta = {
    "name": "acc",
    "description": "Accounting: income, expenses, summary, export"
}

def data_dir(cfg):
    return cfg.get("paths", {}).get("data", "data")

def income_path(cfg):
    p = os.path.join(data_dir(cfg), "acc_income.json")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p

def expenses_path(cfg):
    p = os.path.join(data_dir(cfg), "acc_expenses.json")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p

# --- load/save helpers ---
def _load_json(path):
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return []

def _save_json(path, obj):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2)

# --- add entries ---
def _parse_date(d):
    try:
        return datetime.strptime(d, "%Y-%m-%d").date()
    except Exception:
        return datetime.now().date()

def _parse_amount(a):
    try:
        return float(Decimal(str(a)))
    except (InvalidOperation, ValueError, TypeError):
        return 0.0

def add_income(cfg, date_str, amount, category="", source="", notes=""):
    incomes = _load_json(income_path(cfg))
    entry = {
        "id": len(incomes) + 1,
        "date": _parse_date(date_str).isoformat(),
        "amount": _parse_amount(amount),
        "category": category or "General",
        "source": source or "Unknown",
        "notes": notes or "",
        "created_at": datetime.now().isoformat()
    }
    incomes.append(entry)
    _save_json(income_path(cfg), incomes)
    return f"[ACC] Income added: {entry['amount']} on {entry['date']} ({entry['category']})"

def add_expense(cfg, date_str, amount, category="", vendor="", notes=""):
    expenses = _load_json(expenses_path(cfg))
    entry = {
        "id": len(expenses) + 1,
        "date": _parse_date(date_str).isoformat(),
        "amount": _parse_amount(amount),
        "category": category or "General",
        "vendor": vendor or "Unknown",
        "notes": notes or "",
        "created_at": datetime.now().isoformat()
    }
    expenses.append(entry)
    _save_json(expenses_path(cfg), expenses)
    return f"[ACC] Expense added: {entry['amount']} on {entry['date']} ({entry['category']})"

# --- list ---
def list_income(cfg):
    incomes = _load_json(income_path(cfg))
    if not incomes:
        return "[ACC] No income records."
    lines = []
    for i in incomes:
        lines.append(f"{i['id']}. [{i['date']}] {i['amount']} — {i['category']} / {i.get('source','')}\n    {i.get('notes','')}")
    return "\n".join(lines)

def list_expenses(cfg):
    expenses = _load_json(expenses_path(cfg))
    if not expenses:
        return "[ACC] No expenses recorded."
    lines = []
    for e in expenses:
        lines.append(f"{e['id']}. [{e['date']}] {e['amount']} — {e['category']} / {e.get('vendor','')}\n    {e.get('notes','')}")
    return "\n".join(lines)

# --- summaries ---
def _sum_for_period(records, period=None):
    # period: None/all-time, "month", "quarter", "year" -> uses current date
    if not records:
        return 0.0
    if period is None:
        return sum(r.get("amount", 0.0) for r in records)
    today = datetime.now().date()
    total = 0.0
    for r in records:
        try:
            d = datetime.strptime(r.get("date"), "%Y-%m-%d").date()
        except Exception:
            continue
        if period == "month":
            if d.year == today.year and d.month == today.month:
                total += r.get("amount", 0.0)
        elif period == "quarter":
            # compute quarter by month
            q_cur = (today.month - 1) // 3 + 1
            q_r = (d.month - 1) // 3 + 1
            if d.year == today.year and q_r == q_cur:
                total += r.get("amount", 0.0)
        elif period == "year":
            if d.year == today.year:
                total += r.get("amount", 0.0)
    return total

def summary(cfg, period=None):
    incomes = _load_json(income_path(cfg))
    expenses = _load_json(expenses_path(cfg))
    inc_total = _sum_for_period(incomes, period)
    exp_total = _sum_for_period(expenses, period)
    net = inc_total - exp_total
    hdr = f"[ACC] Summary for {period or 'all-time'}\n"
    hdr += f"  Total Income: {inc_total:.2f}\n"
    hdr += f"  Total Expenses: {exp_total:.2f}\n"
    hdr += f"  Net: {net:.2f}\n"
    # quick category breakdowns (top 5)
    from collections import defaultdict
    inc_by_cat = defaultdict(float)
    for i in incomes:
        inc_by_cat[i.get("category","General")] += i.get("amount",0.0)
    exp_by_cat = defaultdict(float)
    for e in expenses:
        exp_by_cat[e.get("category","General")] += e.get("amount",0.0)
    hdr += "\nIncome by category:\n"
    for k,v in sorted(inc_by_cat.items(), key=lambda x: -x[1])[:5]:
        hdr += f"  - {k}: {v:.2f}\n"
    hdr += "\nExpenses by category:\n"
    for k,v in sorted(exp_by_cat.items(), key=lambda x: -x[1])[:5]:
        hdr += f"  - {k}: {v:.2f}\n"
    return hdr

# --- exports ---
def export_csv(cfg, outdir=None):
    outdir = outdir or data_dir(cfg)
    os.makedirs(outdir, exist_ok=True)
    incomes = _load_json(income_path(cfg))
    expenses = _load_json(expenses_path(cfg))
    import csv
    inc_file = os.path.join(outdir, "acc_income.csv")
    exp_file = os.path.join(outdir, "acc_expenses.csv")
    with open(inc_file, "w", newline='', encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id","date","amount","category","source","notes","created_at"])
        for i in incomes:
            w.writerow([i.get("id"), i.get("date"), i.get("amount"), i.get("category"), i.get("source"), i.get("notes"), i.get("created_at")])
    with open(exp_file, "w", newline='', encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id","date","amount","category","vendor","notes","created_at"])
        for e in expenses:
            w.writerow([e.get("id"), e.get("date"), e.get("amount"), e.get("category"), e.get("vendor"), e.get("notes"), e.get("created_at")])
    return f"[ACC] Exported CSVs to {outdir}"

def export_md(cfg, outdir=None):
    outdir = outdir or data_dir(cfg)
    os.makedirs(outdir, exist_ok=True)
    incomes = _load_json(income_path(cfg))
    expenses = _load_json(expenses_path(cfg))
    mdfile = os.path.join(outdir, "acc_export.md")
    with open(mdfile, "w", encoding="utf-8") as fh:
        fh.write("# Accounting Export\n\n")
        fh.write("## Income\n\n")
        for i in incomes:
            fh.write(f"- [{i.get('date')}] {i.get('amount'):.2f} — {i.get('category')} / {i.get('source')} \n  - notes: {i.get('notes','')}\n")
        fh.write("\n## Expenses\n\n")
        for e in expenses:
            fh.write(f"- [{e.get('date')}] {e.get('amount'):.2f} — {e.get('category')} / {e.get('vendor')} \n  - notes: {e.get('notes','')}\n")
        fh.write("\n## Summary\n\n")
        fh.write(summary(cfg))
    return f"[ACC] Exported markdown to {mdfile}"

# --- run entrypoint ---
def run(args: List[str], cfg):
    if not args:
        return "[ACC] Commands: add_income, add_expense, list_income, list_expenses, summary [period], export csv, export md"
    cmd = args[0].lower()
    try:
        if cmd == "add_income":
            d = args[1] if len(args) > 1 else datetime.now().strftime("%Y-%m-%d")
            amt = args[2] if len(args) > 2 else "0"
            cat = args[3] if len(args) > 3 else ""
            src = args[4] if len(args) > 4 else ""
            notes = args[5] if len(args) > 5 else ""
            return add_income(cfg, d, amt, cat, src, notes)
        if cmd == "add_expense":
            d = args[1] if len(args) > 1 else datetime.now().strftime("%Y-%m-%d")
            amt = args[2] if len(args) > 2 else "0"
            cat = args[3] if len(args) > 3 else ""
            vendor = args[4] if len(args) > 4 else ""
            notes = args[5] if len(args) > 5 else ""
            return add_expense(cfg, d, amt, cat, vendor, notes)
        if cmd == "list_income":
            return list_income(cfg)
        if cmd == "list_expenses":
            return list_expenses(cfg)
        if cmd == "summary":
            period = args[1].lower() if len(args) > 1 else None
            if period not in (None, "month", "quarter", "year"):
                return "[ACC] summary period must be: month, quarter, year or empty"
            return summary(cfg, period)
        if cmd == "export":
            if len(args) >= 2 and args[1] == "csv":
                out = args[2] if len(args) >= 3 else None
                return export_csv(cfg, out)
            if len(args) >= 2 and args[1] == "md":
                out = args[2] if len(args) >= 3 else None
                return export_md(cfg, out)
            return "[ACC] Usage: export csv|md [outdir]"
    except Exception as e:
        return f"[ACC] Error: {e}"
    return "[ACC] Unknown command."
