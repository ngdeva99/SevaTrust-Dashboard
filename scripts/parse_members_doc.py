#!/usr/bin/env python3
"""
parse_members_doc.py
====================

Parses the legacy LIFE_MEMBER_LIST Word document into a CSV that can be
reviewed and then imported into the members table.

Input:  a .docx file (convert .doc → .docx first using LibreOffice)
Output: members_parsed.csv with one row per member

Usage:
  # Convert .doc to .docx once:
  soffice --headless --convert-to docx LIFE_MEMBER_LIST__MASTER__-_MAR_2016.doc

  # Then run the parser:
  python scripts/parse_members_doc.py \\
      --input LIFE_MEMBER_LIST__MASTER__-_MAR_2016.docx \\
      --output members_parsed.csv

Requirements:
  pip install python-docx
"""

import argparse
import csv
import re
import sys
from pathlib import Path

try:
    from docx import Document
except ImportError:
    sys.exit("ERROR: python-docx not installed. Run: pip install python-docx")


TITLE_PATTERN = re.compile(
    r'^(SRI|SMT|MS|DR|SMT\.|SRI\.|MS\.|DR\.|RI)\s+',
    re.IGNORECASE
)

# A PIN code is 6 digits (India). Sometimes it has a hyphen prefix.
PIN_PATTERN = re.compile(r'(\d{6})')

# Parenthetical trailing note, e.g. (CHANGE OF ADDRESS – MAR16)
NOTE_PATTERN = re.compile(r'\(([^)]+)\)\s*\**\s*$')


def clean(s: str) -> str:
    """Strip bold markers, extra whitespace, and weird characters."""
    s = s.replace('**', '')
    s = s.replace('\u2018', "'").replace('\u2019', "'")
    s = s.replace('\u201c', '"').replace('\u201d', '"')
    s = s.replace('\u2013', '-').replace('\u2014', '-')
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def parse_cell(raw_text: str, import_id: str) -> dict:
    """
    Parse one table cell into a member record.
    Returns a dict; fields may be None if parsing is unsure.
    """
    if not raw_text or not raw_text.strip():
        return None

    # Split into non-empty lines
    lines = [clean(l) for l in raw_text.split('\n') if clean(l)]
    if not lines:
        return None

    record = {
        'legacy_import_id': import_id,
        'legacy_raw_text': raw_text.strip(),
        'title': '',
        'full_name': '',
        'address_line1': '',
        'address_line2': '',
        'address_line3': '',
        'city': '',
        'state': '',
        'pin_code': '',
        'country': 'India',
        'note_raw': '',
        'language_hint': '',
        'diary_copies': 1,
        'parse_confidence': 'high',
        'parse_warnings': '',
    }
    warnings = []

    # --- Extract trailing note, if any ---
    # Check each line from the end
    note_lines = []
    remaining_lines = lines[:]
    while remaining_lines:
        last = remaining_lines[-1]
        m = NOTE_PATTERN.search(last)
        if m and last.startswith('(') and last.endswith(')'):
            note_lines.insert(0, m.group(1).strip())
            remaining_lines.pop()
        else:
            break
    lines = remaining_lines

    if note_lines:
        record['note_raw'] = ' | '.join(note_lines)
        note_upper = record['note_raw'].upper()
        if 'TELUGU' in note_upper:
            record['language_hint'] = 'TELUGU'
        elif 'TAMIL' in note_upper:
            record['language_hint'] = 'TAMIL'
        elif 'ENGLISH' in note_upper:
            record['language_hint'] = 'ENGLISH'
        # Extract diary copies, e.g. "3 COPIES"
        copies_m = re.search(r'(\d+)\s*COP(Y|IES)', note_upper)
        if copies_m:
            record['diary_copies'] = int(copies_m.group(1))

    if not lines:
        warnings.append('no_content_lines')
        record['parse_confidence'] = 'low'
        record['parse_warnings'] = ','.join(warnings)
        return record

    # --- First line: title + name ---
    first = lines[0]
    title_match = TITLE_PATTERN.match(first)
    if title_match:
        record['title'] = title_match.group(1).upper().rstrip('.')
        if record['title'] == 'RI':  # likely OCR error for 'SRI'
            record['title'] = 'SRI'
            warnings.append('title_ri_assumed_sri')
        record['full_name'] = first[title_match.end():].strip()
    else:
        # No recognizable title — take the whole line as name.
        record['full_name'] = first
        record['title'] = 'OTHER'
        warnings.append('no_title_found')

    if not record['full_name']:
        warnings.append('empty_name')
        record['parse_confidence'] = 'low'

    # --- Remaining lines: address + PIN ---
    addr_lines = lines[1:]

    # Find the PIN code line (usually last, sometimes combined with city)
    pin_line_idx = None
    pin_value = None
    for i in range(len(addr_lines) - 1, -1, -1):
        m = PIN_PATTERN.search(addr_lines[i])
        if m:
            pin_value = m.group(1)
            pin_line_idx = i
            break

    if pin_value:
        record['pin_code'] = pin_value
        # Strip PIN from the line; whatever's left may be city
        pin_line = addr_lines[pin_line_idx]
        leftover = PIN_PATTERN.sub('', pin_line).strip(' -,')
        # Heuristic: if PIN is alone on its line, city is the previous line
        if not leftover and pin_line_idx > 0:
            record['city'] = addr_lines[pin_line_idx - 1]
            addr_lines = addr_lines[1:pin_line_idx - 1]
        else:
            record['city'] = leftover
            addr_lines = addr_lines[1:pin_line_idx]
    else:
        warnings.append('no_pin_found')
        record['parse_confidence'] = 'needs_review'

    # Skip the title/name that's already consumed
    # addr_lines now contains lines between name and city/pin
    if pin_value is None:
        addr_lines = lines[1:]

    # Assign address lines
    if len(addr_lines) >= 1:
        record['address_line1'] = addr_lines[0]
    if len(addr_lines) >= 2:
        record['address_line2'] = addr_lines[1]
    if len(addr_lines) >= 3:
        record['address_line3'] = addr_lines[2]
    if len(addr_lines) > 3:
        # Too many address lines — concatenate the rest into line3
        record['address_line3'] = ', '.join(addr_lines[2:])
        warnings.append('many_address_lines')

    # Detect USA addresses
    raw_upper = raw_text.upper()
    if 'USA' in raw_upper or ' NY ' in raw_upper or ' CA ' in raw_upper or ' TX ' in raw_upper:
        record['country'] = 'USA'

    # Final confidence
    if not record['full_name'] or not record['pin_code']:
        record['parse_confidence'] = 'needs_review'
    elif warnings:
        if record['parse_confidence'] == 'high':
            record['parse_confidence'] = 'ok'

    record['parse_warnings'] = ','.join(warnings)
    return record


def parse_document(doc_path: Path):
    """Iterate every table cell in the document and parse each one."""
    doc = Document(doc_path)
    records = []
    import_counter = 0

    for t_idx, table in enumerate(doc.tables):
        for r_idx, row in enumerate(table.rows):
            for c_idx, cell in enumerate(row.cells):
                # Some cells appear multiple times across merged rows; dedupe by cell id
                raw = cell.text
                if not raw or not raw.strip():
                    continue
                import_counter += 1
                import_id = f't{t_idx}r{r_idx}c{c_idx}#{import_counter}'
                rec = parse_cell(raw, import_id)
                if rec:
                    records.append(rec)

    # Dedupe on raw_text because merged cells repeat content
    seen = set()
    deduped = []
    for r in records:
        key = r['legacy_raw_text']
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)

    return deduped


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--input', required=True, help='Path to .docx file')
    ap.add_argument('--output', default='members_parsed.csv')
    args = ap.parse_args()

    src = Path(args.input)
    if not src.exists():
        sys.exit(f"ERROR: input file not found: {src}")

    if src.suffix.lower() == '.doc':
        sys.exit(
            "ERROR: .doc files must be converted to .docx first.\n"
            "  Install LibreOffice and run:\n"
            f"    soffice --headless --convert-to docx \"{src}\""
        )

    print(f"Parsing {src}...")
    records = parse_document(src)
    print(f"  Found {len(records)} unique member entries")

    # Write CSV
    fieldnames = [
        'legacy_import_id', 'parse_confidence', 'parse_warnings',
        'title', 'full_name',
        'address_line1', 'address_line2', 'address_line3',
        'city', 'state', 'pin_code', 'country',
        'note_raw', 'language_hint', 'diary_copies',
        'legacy_raw_text',
    ]
    with open(args.output, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in records:
            writer.writerow({k: r.get(k, '') for k in fieldnames})

    # Summary by confidence
    from collections import Counter
    conf_counts = Counter(r['parse_confidence'] for r in records)
    print(f"\nWrote {args.output}")
    print("Confidence breakdown:")
    for k, v in sorted(conf_counts.items()):
        print(f"  {k:15s} {v}")

    low = [r for r in records if r['parse_confidence'] in ('low', 'needs_review')]
    if low:
        print(f"\n{len(low)} records need human review. "
              f"Filter the CSV by parse_confidence != 'high' and fix those first.")


if __name__ == '__main__':
    main()
