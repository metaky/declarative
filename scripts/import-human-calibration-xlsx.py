#!/usr/bin/env python3
"""Import Kyle's spreadsheet calibration labels back into JSON.

This intentionally uses only Python standard-library modules so the importer
does not depend on local npm spreadsheet packages.
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX = REPO_ROOT / "evals" / "human-calibration-review.xlsx"
DEFAULT_JSON = REPO_ROOT / "evals" / "human-calibration-set.json"
NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg_rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def column_index(cell_ref: str) -> int:
    letters = re.match(r"([A-Z]+)", cell_ref).group(1)
    value = 0
    for char in letters:
        value = value * 26 + (ord(char) - ord("A") + 1)
    return value - 1


def load_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    except KeyError:
        return []

    strings: list[str] = []
    for item in root.findall("main:si", NS):
        parts = [node.text or "" for node in item.findall(".//main:t", NS)]
        strings.append("".join(parts))
    return strings


def sheet_path_for_name(zf: zipfile.ZipFile, sheet_name: str) -> str:
    workbook = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    rel_targets = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall("pkg_rel:Relationship", NS)
    }

    for sheet in workbook.findall(".//main:sheet", NS):
        if sheet.attrib.get("name") == sheet_name:
            rel_id = sheet.attrib[f"{{{NS['rel']}}}id"]
            target = rel_targets[rel_id]
            return f"xl/{target.lstrip('/')}" if not target.startswith("xl/") else target

    raise ValueError(f"Could not find sheet named {sheet_name!r}")


def cell_value(cell: ET.Element, shared_strings: list[str]):
    cell_type = cell.attrib.get("t")
    value_node = cell.find("main:v", NS)
    inline_node = cell.find("main:is/main:t", NS)

    if cell_type == "inlineStr":
        return inline_node.text if inline_node is not None else ""

    if value_node is None:
        return None

    raw = value_node.text or ""
    if cell_type == "s":
        return shared_strings[int(raw)]
    if cell_type == "b":
        return raw == "1"

    try:
        number = float(raw)
    except ValueError:
        return raw

    return int(number) if number.is_integer() else number


def read_review_rows(xlsx_path: Path) -> dict[str, dict]:
    with zipfile.ZipFile(xlsx_path) as zf:
        shared_strings = load_shared_strings(zf)
        sheet_path = sheet_path_for_name(zf, "Review")
        root = ET.fromstring(zf.read(sheet_path))

        rows: dict[int, dict[int, object]] = {}
        for row in root.findall(".//main:sheetData/main:row", NS):
            row_number = int(row.attrib["r"])
            values: dict[int, object] = {}
            for cell in row.findall("main:c", NS):
                values[column_index(cell.attrib["r"])] = cell_value(cell, shared_strings)
            rows[row_number] = values

    imported: dict[str, dict] = {}
    for row_number in sorted(rows):
        if row_number == 1:
            continue
        values = rows[row_number]
        item_id = values.get(1)
        if not item_id:
            continue
        imported[str(item_id)] = {
            "bestOptionCount": str(values.get(11, "")).strip(),
            "hasExcellentOption": bool(values.get(12)),
            "hasHarmfulOption": bool(values.get(13)),
            "setVerdict": str(values.get(14, "")).strip(),
            "why": str(values.get(15, "") or "").strip(),
        }
    return imported


def validate_review(review: dict, item_id: str) -> list[str]:
    errors: list[str] = []
    if review["bestOptionCount"].isdigit() and int(review["bestOptionCount"]) >= 3:
        review["bestOptionCount"] = "3+"
    if review["bestOptionCount"] not in {"0", "1", "2", "3+"}:
        errors.append(f"{item_id}: bestOptionCount must be 0, 1, 2, or 3+")
    if review["setVerdict"] not in {"Pass", "Borderline", "Fail"}:
        errors.append(f"{item_id}: setVerdict must be Pass, Borderline, or Fail")
    return errors


def main() -> int:
    xlsx_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLSX
    json_path = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_JSON

    payload = json.loads(json_path.read_text())
    imported = read_review_rows(xlsx_path)
    errors: list[str] = []

    for item in payload["items"]:
        item_id = item["id"]
        if item_id not in imported:
            errors.append(f"{item_id}: missing spreadsheet row")
            continue
        review = imported[item_id]
        errors.extend(validate_review(review, item_id))
        item["review"] = review

    extra = sorted(set(imported) - {item["id"] for item in payload["items"]})
    for item_id in extra:
        errors.append(f"{item_id}: spreadsheet row does not match calibration JSON")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    json_path.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Imported {len(imported)} review rows into {json_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
