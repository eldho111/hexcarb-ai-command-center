"""
modules/proc.py

Procurement module for HexCarb AI Command Center.

Supported run(args, cfg) interface.

Commands:
  add_vendor "<name>" "<contact>" "<category>" "<notes>"
  list_vendors
  search_vendors <keyword>

  add_material "<name>" "<spec>" "<vendor_name>" "<notes>"
  list_materials
  search_materials <keyword>

  log_purchase "<date(YYYY-MM-DD)>" "<material_name>" "<vendor_name>" <qty> <price> "<invoice_no>" "<notes>"
  list_purchases
  search_purchases <keyword>

  export csv            -> exports vendors, materials, purchases CSVs to data/
  export md             -> exports a markdown summary to data/
"""

import os
import json
import csv
from datetime import datetime
from typing import List

meta = {
    "name": "proc",
    "description": "Procurement: vendors, materials, purchases, export"
}

# ---- paths ----
def data_dir(cfg):
    return cfg.get("paths", {}).get("data", "data")

def vendors_path(cfg):
    p = os.path.join(data_dir(cfg), "proc_vendors.json")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p

def materials_path(cfg):
    p = os.path.join(data_dir(cfg), "proc_materials.json")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p

def purchases_path(cfg):
    p = os.path.join(data_dir(cfg), "proc_purchases.json")
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p

# ---- load/save helpers ----
def load_json(path):
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return []

def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2)

# ---- vendor ops ----
def add_vendor(cfg, name, contact="", category="", notes=""):
    vendors = load_json(vendors_path(cfg))
    entry = {
        "id": len(vendors) + 1,
        "name": name,
        "contact": contact,
        "category": category,
        "notes": notes,
        "created_at": datetime.now().isoformat()
    }
    vendors.append(entry)
    save_json(vendors_path(cfg), vendors)
    return f"[PROC] Vendor added: {name}"

def list_vendors(cfg):
    vendors = load_json(vendors_path(cfg))
    if not vendors:
        return "[PROC] No vendors found."
    out = []
    for v in vendors:
        out.append(f"{v['id']}. {v['name']} | contact: {v.get('contact','—')} | category: {v.get('category','—')}\n   notes: {v.get('notes','—')}")
    return "\n".join(out)

def search_vendors(cfg, kw):
    vendors = load_json(vendors_path(cfg))
    matches = [v for v in vendors if kw.lower() in json.dumps(v).lower()]
    if not matches:
        return f"[PROC] No vendors matching '{kw}'"
    out = []
    for v in matches:
        out.append(f"{v['id']}. {v['name']} | contact: {v.get('contact','—')} | category: {v.get('category','—')}")
    return "\n".join(out)

# ---- material ops ----
def add_material(cfg, name, spec="", vendor_name="", notes=""):
    materials = load_json(materials_path(cfg))
    entry = {
        "id": len(materials) + 1,
        "name": name,
        "spec": spec,
        "vendor_name": vendor_name,
        "notes": notes,
        "created_at": datetime.now().isoformat()
    }
    materials.append(entry)
    save_json(materials_path(cfg), materials)
    return f"[PROC] Material added: {name}"

def list_materials(cfg):
    materials = load_json(materials_path(cfg))
    if not materials:
        return "[PROC] No materials found."
    out = []
    for m in materials:
        out.append(f"{m['id']}. {m['name']} | vendor: {m.get('vendor_name','—')} | spec: {m.get('spec','—')}\n   notes: {m.get('notes','—')}")
    return "\n".join(out)

def search_materials(cfg, kw):
    materials = load_json(materials_path(cfg))
    matches = [m for m in materials if kw.lower() in json.dumps(m).lower()]
    if not matches:
        return f"[PROC] No materials matching '{kw}'"
    out = []
    for m in matches:
        out.append(f"{m['id']}. {m['name']} | vendor: {m.get('vendor_name','—')} | spec: {m.get('spec','—')}")
    return "\n".join(out)

# ---- purchases ops ----
def log_purchase(cfg, date_str, material_name, vendor_name, qty, price, invoice_no="", notes=""):
    purchases = load_json(purchases_path(cfg))
    try:
        # basic validation/parse
        _ = datetime.strptime(date_str, "%Y-%m-%d")
    except Exception:
        date_str = datetime.now().strftime("%Y-%m-%d")
    entry = {
        "id": len(purchases) + 1,
        "date": date_str,
        "material_name": material_name,
        "vendor_name": vendor_name,
        "qty": qty,
        "price": price,
        "invoice_no": invoice_no,
        "notes": notes,
        "created_at": datetime.now().isoformat()
    }
    purchases.append(entry)
    save_json(purchases_path(cfg), purchases)
    return f"[PROC] Purchase logged: {material_name} from {vendor_name} ({qty} @ {price})"

def list_purchases(cfg):
    purchases = load_json(purchases_path(cfg))
    if not purchases:
        return "[PROC] No purchases logged."
    out = []
    for p in purchases:
        out.append(f"{p['id']}. [{p['date']}] {p['material_name']} from {p['vendor_name']} - qty:{p['qty']} price:{p['price']} invoice:{p.get('invoice_no','—')}\n   notes: {p.get('notes','—')}")
    return "\n".join(out)

def search_purchases(cfg, kw):
    purchases = load_json(purchases_path(cfg))
    matches = [p for p in purchases if kw.lower() in json.dumps(p).lower()]
    if not matches:
        return f"[PROC] No purchases matching '{kw}'"
    out = []
    for p in matches:
        out.append(f"{p['id']}. [{p['date']}] {p['material_name']} from {p['vendor_name']} - qty:{p['qty']} price:{p['price']}")
    return "\n".join(out)

# ---- exports ----
def export_csv_all(cfg, out_dir=None):
    out_dir = out_dir or data_dir(cfg)
    os.makedirs(out_dir, exist_ok=True)
    vendors = load_json(vendors_path(cfg))
    materials = load_json(materials_path(cfg))
    purchases = load_json(purchases_path(cfg))
    vfile = os.path.join(out_dir, "proc_vendors.csv")
    mfile = os.path.join(out_dir, "proc_materials.csv")
    pfile = os.path.join(out_dir, "proc_purchases.csv")
    # vendors
    with open(vfile, "w", newline='', encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id","name","contact","category","notes","created_at"])
        for v in vendors:
            w.writerow([v.get("id"), v.get("name"), v.get("contact"), v.get("category"), v.get("notes"), v.get("created_at")])
    # materials
    with open(mfile, "w", newline='', encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id","name","spec","vendor_name","notes","created_at"])
        for m in materials:
            w.writerow([m.get("id"), m.get("name"), m.get("spec"), m.get("vendor_name"), m.get("notes"), m.get("created_at")])
    # purchases
    with open(pfile, "w", newline='', encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id","date","material_name","vendor_name","qty","price","invoice_no","notes","created_at"])
        for p in purchases:
            w.writerow([p.get("id"), p.get("date"), p.get("material_name"), p.get("vendor_name"), p.get("qty"), p.get("price"), p.get("invoice_no"), p.get("notes"), p.get("created_at")])
    return f"[PROC] Exported CSVs to {out_dir}"

def export_md_all(cfg, out_dir=None):
    out_dir = out_dir or data_dir(cfg)
    os.makedirs(out_dir, exist_ok=True)
    vendors = load_json(vendors_path(cfg))
    materials = load_json(materials_path(cfg))
    purchases = load_json(purchases_path(cfg))
    mdfile = os.path.join(out_dir, "proc_export.md")
    with open(mdfile, "w", encoding="utf-8") as fh:
        fh.write("# Procurement Export\n\n")
        fh.write("## Vendors\n\n")
        for v in vendors:
            fh.write(f"- **{v.get('name')}** ({v.get('category','—')}), contact: {v.get('contact','—')}\n  - notes: {v.get('notes','—')}\n")
        fh.write("\n## Materials\n\n")
        for m in materials:
            fh.write(f"- **{m.get('name')}** — vendor: {m.get('vendor_name','—')}\n  - spec: {m.get('spec','—')}\n  - notes: {m.get('notes','—')}\n")
        fh.write("\n## Purchases\n\n")
        for p in purchases:
            fh.write(f"- [{p.get('date')}] **{p.get('material_name')}** from {p.get('vendor_name')} — qty:{p.get('qty')} price:{p.get('price')} (invoice: {p.get('invoice_no','—')})\n  - notes: {p.get('notes','—')}\n")
    return f"[PROC] Exported markdown to {mdfile}"

# ---- public run entrypoint ----
def run(args: List[str], cfg):
    if not args:
        return "[PROC] Commands: add_vendor, list_vendors, search_vendors, add_material, list_materials, search_materials, log_purchase, list_purchases, search_purchases, export csv, export md"

    cmd = args[0].lower()

    try:
        if cmd == "add_vendor":
            # args: name, contact, category, notes
            name = args[1] if len(args) > 1 else ""
            contact = args[2] if len(args) > 2 else ""
            category = args[3] if len(args) > 3 else ""
            notes = args[4] if len(args) > 4 else ""
            return add_vendor(cfg, name, contact, category, notes)

        if cmd == "list_vendors":
            return list_vendors(cfg)

        if cmd == "search_vendors":
            if len(args) < 2:
                return "[PROC] Usage: search_vendors <keyword>"
            return search_vendors(cfg, args[1])

        if cmd == "add_material":
            name = args[1] if len(args) > 1 else ""
            spec = args[2] if len(args) > 2 else ""
            vendor_name = args[3] if len(args) > 3 else ""
            notes = args[4] if len(args) > 4 else ""
            return add_material(cfg, name, spec, vendor_name, notes)

        if cmd == "list_materials":
            return list_materials(cfg)

        if cmd == "search_materials":
            if len(args) < 2:
                return "[PROC] Usage: search_materials <keyword>"
            return search_materials(cfg, args[1])

        if cmd == "log_purchase":
            # date, material_name, vendor_name, qty, price, invoice_no, notes
            date_str = args[1] if len(args) > 1 else datetime.now().strftime("%Y-%m-%d")
            material_name = args[2] if len(args) > 2 else ""
            vendor_name = args[3] if len(args) > 3 else ""
            qty = args[4] if len(args) > 4 else ""
            price = args[5] if len(args) > 5 else ""
            invoice_no = args[6] if len(args) > 6 else ""
            notes = args[7] if len(args) > 7 else ""
            return log_purchase(cfg, date_str, material_name, vendor_name, qty, price, invoice_no, notes)

        if cmd == "list_purchases":
            return list_purchases(cfg)

        if cmd == "search_purchases":
            if len(args) < 2:
                return "[PROC] Usage: search_purchases <keyword>"
            return search_purchases(cfg, args[1])

        if cmd == "export":
            if len(args) >= 2 and args[1] == "csv":
                out = args[2] if len(args) >= 3 else None
                return export_csv_all(cfg, out)
            if len(args) >= 2 and args[1] == "md":
                out = args[2] if len(args) >= 3 else None
                return export_md_all(cfg, out)
            return "[PROC] Usage: export csv [outdir] | export md [outdir]"

    except Exception as e:
        return f"[PROC] Error: {e}"

    return "[PROC] Unknown command."
