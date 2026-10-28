#!/usr/bin/env python3
"""Machine-readable inspection of an exported PDF with non-PDFium tools.

Prints JSON: annotations as MuPDF sees them (type, page, rect in top-left
page space, text drawn by the FreeText appearance, AP /Matrix via pikepdf),
pdffonts embedding of the ezPDF font, qpdf --check, Poppler render errors.
Usage: python3 scripts/inspect_export.py file.pdf
"""
import json
import re
import subprocess
import sys
import tempfile
import unicodedata

import pikepdf
import pymupdf

path = sys.argv[1]


def norm(s):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", s or "")).strip()


out = {"annots": []}
doc = pymupdf.open(path)
pk = pikepdf.open(path)
for pno, page in enumerate(doc):
    pk_annots = {}
    for a in pk.pages[pno].get("/Annots", []):
        nm = str(a.get("/NM", ""))
        pk_annots[nm] = a
    for a in page.annots():
        entry = {
            "page": pno + 1,
            "type": a.type[1],
            "rect_device": [round(v, 2) for v in a.rect],
            "contents": a.info.get("content"),
        }
        if a.type[1] == "FreeText":
            entry["ap_text"] = norm(a.get_text())
            pa = pk_annots.get(a.info.get("id", ""))
            if pa is None:
                pa = next((x for x in pk.pages[pno].Annots if x.get("/Subtype") == "/FreeText"), None)
            n = pa.AP.N if pa is not None and "/AP" in pa else None
            entry["matrix"] = [float(v) for v in n.Matrix] if n is not None and "/Matrix" in n else None
        out["annots"].append(entry)

pf = subprocess.run(["pdffonts", path], capture_output=True, text=True).stdout
rows = [l.split() for l in pf.splitlines() if "ezPDFSansVN" in l]
out["vn_fonts_embedded"] = sum(1 for r in rows if r[-5] == "yes")
out["vn_fonts_not_embedded"] = sum(1 for r in rows if r[-5] != "yes")

q = subprocess.run(["qpdf", "--check", path], capture_output=True, text=True)
out["qpdf_ok"] = q.returncode in (0, 3)
out["qpdf_msg"] = (q.stdout + q.stderr).strip().splitlines()[-1] if (q.stdout + q.stderr).strip() else ""

with tempfile.TemporaryDirectory() as td:
    r = subprocess.run(["pdftoppm", "-r", "40", "-png", path, f"{td}/p"], capture_output=True, text=True)
    out["poppler_errors"] = [l for l in r.stderr.splitlines() if "Error" in l]

print(json.dumps(out, ensure_ascii=False))
