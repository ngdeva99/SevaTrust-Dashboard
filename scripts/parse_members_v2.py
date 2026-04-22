#!/usr/bin/env python3
"""
parse_members_v2.py
===================
Smart parser for Seva Trust member documents (.docx).

Improvements over v1:
  - PIN code → city/state lookup (India Post postal circle mapping + known cities)
  - Phone number extraction from any line
  - Handles "CITY – PIN", "CITY - PIN", "CITY PIN", "PIN" formats
  - Handles "PIN 603103", "600 033" (space in PIN)
  - State extraction from separate lines
  - Intelligent address line splitting
  - Mixed-case name normalization
  - Supports both life-member and mailing-list docs
  - Second pass: if city is missing, derive from PIN

Usage:
  python scripts/parse_members_v2.py \
      --input docs/life-member-2026.docx \
      --output docs/life-member-2026-parsed.csv \
      --type life_member

  python scripts/parse_members_v2.py \
      --input docs/mailing-list-2026.docx \
      --output docs/mailing-list-2026-parsed.csv \
      --type annual
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


# ─── PIN CODE → STATE MAPPING ────────────────────────────────────────────────
# First 2 digits of Indian PIN code → postal circle (state)
PIN_TO_STATE = {
    '11': 'Delhi', '12': 'Haryana', '13': 'Haryana', '14': 'Punjab',
    '15': 'Punjab', '16': 'Punjab', '17': 'Himachal Pradesh',
    '18': 'Jammu & Kashmir', '19': 'Jammu & Kashmir',
    '20': 'Uttar Pradesh', '21': 'Uttar Pradesh', '22': 'Uttar Pradesh',
    '23': 'Uttar Pradesh', '24': 'Uttar Pradesh', '25': 'Uttar Pradesh',
    '26': 'Uttar Pradesh', '27': 'Uttar Pradesh', '28': 'Uttar Pradesh',
    '30': 'Rajasthan', '31': 'Rajasthan', '32': 'Rajasthan',
    '33': 'Rajasthan', '34': 'Rajasthan',
    '36': 'Gujarat', '37': 'Gujarat', '38': 'Gujarat', '39': 'Gujarat',
    '40': 'Maharashtra', '41': 'Maharashtra', '42': 'Maharashtra',
    '43': 'Maharashtra', '44': 'Maharashtra', '45': 'Madhya Pradesh',
    '46': 'Madhya Pradesh', '47': 'Madhya Pradesh', '48': 'Madhya Pradesh',
    '49': 'Chhattisgarh',
    '50': 'Telangana', '51': 'Telangana', '52': 'Andhra Pradesh',
    '53': 'Andhra Pradesh', '54': 'Karnataka', '55': 'Karnataka',
    '56': 'Karnataka', '57': 'Karnataka', '58': 'Karnataka',
    '59': 'Karnataka',
    '60': 'Tamil Nadu', '61': 'Tamil Nadu', '62': 'Tamil Nadu',
    '63': 'Tamil Nadu', '64': 'Tamil Nadu',
    '67': 'Kerala', '68': 'Kerala', '69': 'Kerala',
    '70': 'West Bengal', '71': 'West Bengal', '72': 'West Bengal',
    '73': 'West Bengal', '74': 'West Bengal',
    '75': 'Odisha', '76': 'Odisha', '77': 'Odisha',
    '78': 'Assam', '79': 'Northeast',
    '80': 'Bihar', '81': 'Bihar', '82': 'Bihar', '83': 'Bihar',
    '84': 'Bihar', '85': 'Jharkhand',
    '90': 'Army Post',
}

# Known PIN → city for common cities in the trust data
PIN_TO_CITY = {
    '600001': 'Chennai', '600002': 'Chennai', '600003': 'Chennai',
    '600004': 'Chennai', '600005': 'Chennai', '600006': 'Chennai',
    '600008': 'Chennai', '600010': 'Chennai', '600011': 'Chennai',
    '600012': 'Chennai', '600014': 'Chennai', '600015': 'Chennai',
    '600017': 'Chennai', '600018': 'Chennai', '600019': 'Chennai',
    '600020': 'Chennai', '600024': 'Chennai', '600026': 'Chennai',
    '600028': 'Chennai', '600029': 'Chennai', '600030': 'Chennai',
    '600031': 'Chennai', '600032': 'Chennai', '600033': 'Chennai',
    '600034': 'Chennai', '600035': 'Chennai', '600036': 'Chennai',
    '600037': 'Chennai', '600038': 'Chennai', '600039': 'Chennai',
    '600040': 'Chennai', '600041': 'Chennai', '600042': 'Chennai',
    '600043': 'Chennai', '600044': 'Chennai', '600045': 'Chennai',
    '600047': 'Chennai', '600049': 'Chennai', '600050': 'Chennai',
    '600053': 'Chennai', '600055': 'Chennai', '600059': 'Chennai',
    '600061': 'Chennai', '600062': 'Chennai', '600064': 'Chennai',
    '600073': 'Chennai', '600078': 'Chennai', '600083': 'Chennai',
    '600086': 'Chennai', '600087': 'Chennai', '600088': 'Chennai',
    '600089': 'Chennai', '600091': 'Chennai', '600092': 'Chennai',
    '600093': 'Chennai', '600094': 'Chennai', '600095': 'Chennai',
    '600096': 'Chennai', '600097': 'Chennai', '600098': 'Chennai',
    '600100': 'Chennai', '600101': 'Chennai', '600102': 'Chennai',
    '600113': 'Chennai', '600116': 'Chennai', '600119': 'Chennai',
    '110001': 'New Delhi', '110003': 'New Delhi', '110019': 'New Delhi',
    '110024': 'New Delhi', '110048': 'New Delhi', '110049': 'New Delhi',
    '110051': 'New Delhi', '110060': 'New Delhi', '110065': 'New Delhi',
    '110085': 'New Delhi', '110092': 'New Delhi',
    '400001': 'Mumbai', '400003': 'Mumbai', '400004': 'Mumbai',
    '400007': 'Mumbai', '400010': 'Mumbai', '400014': 'Mumbai',
    '400016': 'Mumbai', '400019': 'Mumbai', '400022': 'Mumbai',
    '400024': 'Mumbai', '400028': 'Mumbai', '400049': 'Mumbai',
    '400050': 'Mumbai', '400051': 'Mumbai', '400052': 'Mumbai',
    '400053': 'Mumbai', '400054': 'Mumbai', '400055': 'Mumbai',
    '400056': 'Mumbai', '400057': 'Mumbai', '400058': 'Mumbai',
    '400059': 'Mumbai', '400060': 'Mumbai', '400061': 'Mumbai',
    '400062': 'Mumbai', '400064': 'Mumbai', '400066': 'Mumbai',
    '400067': 'Mumbai', '400068': 'Mumbai', '400069': 'Mumbai',
    '400070': 'Mumbai', '400071': 'Mumbai', '400072': 'Mumbai',
    '400074': 'Mumbai', '400076': 'Mumbai', '400077': 'Mumbai',
    '400078': 'Mumbai', '400080': 'Mumbai', '400086': 'Mumbai',
    '400088': 'Mumbai', '400089': 'Mumbai', '400092': 'Mumbai',
    '400093': 'Mumbai', '400097': 'Mumbai', '400098': 'Mumbai',
    '400099': 'Mumbai', '400101': 'Mumbai', '400104': 'Mumbai',
    '400706': 'Navi Mumbai',
    '500001': 'Hyderabad', '500003': 'Hyderabad', '500004': 'Hyderabad',
    '500007': 'Hyderabad', '500008': 'Hyderabad', '500010': 'Hyderabad',
    '500013': 'Hyderabad', '500015': 'Secunderabad',
    '500016': 'Hyderabad', '500018': 'Hyderabad', '500020': 'Hyderabad',
    '500026': 'Hyderabad', '500028': 'Hyderabad', '500032': 'Hyderabad',
    '500033': 'Hyderabad', '500034': 'Hyderabad', '500036': 'Hyderabad',
    '500044': 'Hyderabad', '500045': 'Hyderabad', '500049': 'Hyderabad',
    '500072': 'Hyderabad', '500073': 'Hyderabad', '500081': 'Hyderabad',
    '500082': 'Hyderabad', '500090': 'Hyderabad',
    '560001': 'Bangalore', '560003': 'Bangalore', '560004': 'Bangalore',
    '560007': 'Bangalore', '560008': 'Bangalore', '560009': 'Bangalore',
    '560010': 'Bangalore', '560011': 'Bangalore', '560016': 'Bangalore',
    '560017': 'Bangalore', '560018': 'Bangalore', '560019': 'Bangalore',
    '560021': 'Bangalore', '560022': 'Bangalore', '560023': 'Bangalore',
    '560024': 'Bangalore', '560025': 'Bangalore', '560034': 'Bangalore',
    '560036': 'Bangalore', '560037': 'Bangalore', '560038': 'Bangalore',
    '560040': 'Bangalore', '560041': 'Bangalore', '560043': 'Bangalore',
    '560045': 'Bangalore', '560047': 'Bangalore', '560048': 'Bangalore',
    '560050': 'Bangalore', '560052': 'Bangalore', '560054': 'Bangalore',
    '560055': 'Bangalore', '560060': 'Bangalore', '560061': 'Bangalore',
    '560062': 'Bangalore', '560064': 'Bangalore', '560066': 'Bangalore',
    '560068': 'Bangalore', '560069': 'Bangalore', '560070': 'Bangalore',
    '560072': 'Bangalore', '560073': 'Bangalore', '560076': 'Bangalore',
    '560078': 'Bangalore', '560079': 'Bangalore', '560085': 'Bangalore',
    '560086': 'Bangalore', '560093': 'Bangalore', '560094': 'Bangalore',
    '560097': 'Bangalore', '560098': 'Bangalore', '560100': 'Bangalore',
    '560103': 'Bangalore',
    '620001': 'Trichy', '620002': 'Trichy', '620003': 'Trichy',
    '620005': 'Trichy', '620006': 'Trichy', '620008': 'Trichy',
    '620010': 'Trichy', '620017': 'Trichy', '620018': 'Trichy',
    '620020': 'Trichy', '620021': 'Trichy', '620026': 'Trichy',
    '411001': 'Pune', '411002': 'Pune', '411004': 'Pune',
    '411005': 'Pune', '411006': 'Pune', '411007': 'Pune',
    '411008': 'Pune', '411009': 'Pune', '411011': 'Pune',
    '411014': 'Pune', '411015': 'Pune', '411016': 'Pune',
    '411017': 'Pune', '411018': 'Pune', '411020': 'Pune',
    '411021': 'Pune', '411027': 'Pune', '411028': 'Pune',
    '411030': 'Pune', '411033': 'Pune', '411036': 'Pune',
    '411037': 'Pune', '411038': 'Pune', '411040': 'Pune',
    '411041': 'Pune', '411043': 'Pune', '411044': 'Pune',
    '411045': 'Pune', '411046': 'Pune', '411048': 'Pune',
    '121001': 'Faridabad', '122001': 'Gurgaon', '122002': 'Gurgaon',
    '122003': 'Gurgaon', '122006': 'Gurgaon', '122009': 'Gurgaon',
    '122015': 'Gurgaon', '122018': 'Gurgaon',
    '201301': 'Noida', '201303': 'Noida', '201306': 'Greater Noida',
    '201307': 'Greater Noida', '201310': 'Noida',
    '226001': 'Lucknow', '226010': 'Lucknow', '226016': 'Lucknow',
    '226020': 'Lucknow', '226021': 'Lucknow', '226022': 'Lucknow',
    '226024': 'Lucknow',
    '380001': 'Ahmedabad', '380006': 'Ahmedabad', '380007': 'Ahmedabad',
    '380009': 'Ahmedabad', '380013': 'Ahmedabad', '380015': 'Ahmedabad',
    '380051': 'Ahmedabad', '380052': 'Ahmedabad', '380054': 'Ahmedabad',
    '380058': 'Ahmedabad', '380059': 'Ahmedabad',
    '700001': 'Kolkata', '700006': 'Kolkata', '700007': 'Kolkata',
    '700008': 'Kolkata', '700010': 'Kolkata', '700014': 'Kolkata',
    '700016': 'Kolkata', '700017': 'Kolkata', '700019': 'Kolkata',
    '700020': 'Kolkata', '700025': 'Kolkata', '700026': 'Kolkata',
    '700027': 'Kolkata', '700029': 'Kolkata', '700031': 'Kolkata',
    '700032': 'Kolkata', '700034': 'Kolkata', '700035': 'Kolkata',
    '700036': 'Kolkata', '700037': 'Kolkata', '700038': 'Kolkata',
    '700039': 'Kolkata', '700040': 'Kolkata', '700041': 'Kolkata',
    '700042': 'Kolkata', '700045': 'Kolkata', '700046': 'Kolkata',
    '700047': 'Kolkata', '700048': 'Kolkata', '700052': 'Kolkata',
    '700053': 'Kolkata', '700054': 'Kolkata', '700055': 'Kolkata',
    '700056': 'Kolkata', '700058': 'Kolkata', '700059': 'Kolkata',
    '700064': 'Kolkata', '700068': 'Kolkata', '700075': 'Kolkata',
    '700091': 'Kolkata', '700094': 'Kolkata', '700095': 'Kolkata',
    '700099': 'Kolkata', '700101': 'Kolkata', '700107': 'Kolkata',
    '605001': 'Puducherry', '605110': 'Puducherry',
    '635110': 'Hosur', '603103': 'Kelambakkam',
    '517501': 'Tirupati', '517502': 'Tirupati',
    '625001': 'Madurai', '625002': 'Madurai', '625003': 'Madurai',
    '625006': 'Madurai', '625009': 'Madurai', '625010': 'Madurai',
    '625014': 'Madurai', '625016': 'Madurai', '625020': 'Madurai',
    '641001': 'Coimbatore', '641002': 'Coimbatore', '641003': 'Coimbatore',
    '641004': 'Coimbatore', '641005': 'Coimbatore', '641006': 'Coimbatore',
    '641011': 'Coimbatore', '641012': 'Coimbatore', '641014': 'Coimbatore',
    '641018': 'Coimbatore', '641024': 'Coimbatore', '641025': 'Coimbatore',
    '641027': 'Coimbatore', '641028': 'Coimbatore', '641029': 'Coimbatore',
    '641030': 'Coimbatore', '641034': 'Coimbatore', '641035': 'Coimbatore',
    '641037': 'Coimbatore', '641038': 'Coimbatore', '641041': 'Coimbatore',
    '641043': 'Coimbatore', '641045': 'Coimbatore', '641046': 'Coimbatore',
    '641047': 'Coimbatore', '641062': 'Coimbatore',
    '421201': 'Dombivli',
    '410210': 'Navi Mumbai', '410206': 'Navi Mumbai',
}

# Known city name patterns (for lines that ARE city names)
KNOWN_CITIES = {
    'CHENNAI', 'BANGALORE', 'BENGALURU', 'MUMBAI', 'DELHI', 'NEW DELHI',
    'HYDERABAD', 'SECUNDERABAD', 'PUNE', 'KOLKATA', 'AHMEDABAD',
    'TRICHY', 'TIRUCHIRAPPALLI', 'MADURAI', 'COIMBATORE', 'SALEM',
    'TIRUNELVELI', 'HOSUR', 'MYSORE', 'MYSURU', 'MANGALORE',
    'PUDUCHERRY', 'PONDICHERRY', 'TIRUPATI', 'VISAKHAPATNAM', 'VIZAG',
    'KOCHI', 'COCHIN', 'TRIVANDRUM', 'THIRUVANANTHAPURAM',
    'GURGAON', 'GURUGRAM', 'NOIDA', 'FARIDABAD', 'GHAZIABAD',
    'LUCKNOW', 'KANPUR', 'VARANASI', 'JAIPUR', 'JODHPUR', 'UDAIPUR',
    'BHOPAL', 'INDORE', 'NAGPUR', 'SURAT', 'VADODARA', 'RAJKOT',
    'PATNA', 'RANCHI', 'BHUBANESWAR', 'CHANDIGARH', 'DEHRADUN',
    'NAVI MUMBAI', 'THANE', 'DOMBIVLI', 'KALYAN',
    'SRIRANGAM', 'SRI RANGAM', 'KELAMBAKKAM', 'VILLIVAKKAM',
    'ADYAR', 'TAMBARAM', 'CHROMEPET', 'PORUR', 'ANNA NAGAR',
    'T.NAGAR', 'T NAGAR', 'MYLAPORE', 'WEST MAMBALAM', 'MAMBALAM',
    'K.K. NAGAR', 'KODAMBAKKAM', 'NUNGAMBAKKAM', 'CHETPET',
    'VADAPALANI', 'ASHOK NAGAR', 'THIRUVANMIYUR', 'VELACHERY',
    'PALLIKARANAI', 'SHOLINGANALLUR', 'PERUNGUDI', 'MADIPAKKAM',
    'NANGANALLUR', 'ALANDUR', 'GUINDY', 'SAIDAPET', 'KILPAUK',
}

# Known Indian states (to identify state lines)
KNOWN_STATES = {
    'TAMIL NADU', 'TAMILNADU', 'KARNATAKA', 'KERALA', 'ANDHRA PRADESH',
    'TELANGANA', 'TELENGANA', 'TELENGANA STATE', 'MAHARASHTRA', 'GUJARAT',
    'RAJASTHAN', 'UTTAR PRADESH', 'MADHYA PRADESH', 'WEST BENGAL',
    'BIHAR', 'ODISHA', 'ORISSA', 'JHARKHAND', 'CHHATTISGARH',
    'PUNJAB', 'HARYANA', 'HIMACHAL PRADESH', 'UTTARAKHAND',
    'GOA', 'ASSAM', 'TRIPURA', 'MEGHALAYA', 'MANIPUR', 'MIZORAM',
    'NAGALAND', 'ARUNACHAL PRADESH', 'SIKKIM',
    'JAMMU & KASHMIR', 'JAMMU AND KASHMIR', 'LADAKH',
    'DELHI', 'PUDUCHERRY', 'PONDICHERRY', 'CHANDIGARH',
}


# ─── REGEX PATTERNS ──────────────────────────────────────────────────────────
TITLE_PATTERN = re.compile(
    r'^(SRI|SMT|MS|DR|MRS|MR|SMT\.|SRI\.|MS\.|DR\.|MRS\.|MR\.|RI)\s+',
    re.IGNORECASE
)

# PIN: 6 digits, possibly with spaces (e.g., "600 033"), preceded by dash/space
# Also handles "PIN 603103"
PIN_PATTERN = re.compile(r'(?:PIN\s*)?(\d{3}\s?\d{3})\b')
PIN_STRICT = re.compile(r'\b(\d{6})\b')

# Phone patterns
PHONE_PATTERN = re.compile(
    r'(?:PH\s*:\s*|PHONE\s*:\s*|MOB\s*:\s*|M\s*:\s*|Ph\s*:\s*)?'
    r'(\+?\d[\d\s,/-]{8,})',
    re.IGNORECASE
)
PHONE_LINE_PATTERN = re.compile(r'PH\s*:', re.IGNORECASE)

# Note in parentheses at end
NOTE_PATTERN = re.compile(r'\(([^)]+)\)\s*\**\s*$')

# "CITY – PIN" or "CITY - PIN" or "CITY PIN"
CITY_PIN_PATTERN = re.compile(
    r'^(.+?)\s*[-–—]\s*(\d{3}\s?\d{3})\b',
)


def clean(s: str) -> str:
    s = s.replace('**', '')
    s = s.replace('\u2018', "'").replace('\u2019', "'")
    s = s.replace('\u201c', '"').replace('\u201d', '"')
    s = s.replace('\u2013', '-').replace('\u2014', '-')
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def normalize_pin(p: str) -> str:
    """Remove spaces from PIN code."""
    return p.replace(' ', '')


def city_from_pin(pin: str) -> str:
    """Look up city from PIN code."""
    return PIN_TO_CITY.get(pin, '')


def state_from_pin(pin: str) -> str:
    """Look up state from first 2 digits of PIN."""
    return PIN_TO_STATE.get(pin[:2], '')


def is_city_name(line: str) -> bool:
    """Check if a line is a known city name."""
    upper = line.upper().strip().rstrip('.')
    return upper in KNOWN_CITIES


def is_state_name(line: str) -> bool:
    """Check if a line is a known state name."""
    upper = line.upper().strip().rstrip('.')
    # Remove "STATE" suffix for matching
    cleaned = re.sub(r'\s*STATE\s*$', '', upper, flags=re.IGNORECASE)
    return upper in KNOWN_STATES or cleaned in KNOWN_STATES


def extract_phone(lines: list[str]) -> tuple[str, list[str]]:
    """Extract phone numbers from lines. Returns (phone, remaining_lines)."""
    phones = []
    remaining = []
    for line in lines:
        m = re.search(r'PH\s*:\s*(.+)$', line, re.IGNORECASE)
        if m:
            phone_part = m.group(1).strip().rstrip('.')
            for part in re.split(r'[,/]', phone_part):
                num = part.strip()
                if re.match(r'\+?\d[\d\s-]{7,}', num):
                    phones.append(re.sub(r'[\s-]', '', num))
            # Keep the part of the line before PH:
            cleaned = line[:m.start()].strip().rstrip(',. ')
            if cleaned:
                remaining.append(cleaned)
        else:
            remaining.append(line)
    return ', '.join(phones), remaining


def parse_cell(raw_text: str, import_id: str) -> dict | None:
    """Parse one table cell into a member record."""
    if not raw_text or not raw_text.strip():
        return None

    lines = [clean(l) for l in raw_text.split('\n') if clean(l)]
    # Filter out lines that are just punctuation
    lines = [l for l in lines if l not in ('.', ',', '-', '(', ')')]
    if not lines:
        return None

    record = {
        'legacy_import_id': import_id,
        'legacy_raw_text': raw_text.strip(),
        'title': '', 'full_name': '',
        'address_line1': '', 'address_line2': '', 'address_line3': '',
        'city': '', 'state': '', 'pin_code': '', 'country': 'India',
        'phone': '',
        'note_raw': '', 'language_hint': '', 'diary_copies': 1,
        'parse_confidence': 'high', 'parse_warnings': '',
    }
    warnings = []

    # --- Extract trailing notes ---
    remaining_lines = lines[:]
    note_lines = []
    while remaining_lines:
        last = remaining_lines[-1]
        m = NOTE_PATTERN.search(last)
        if m:
            note_text = m.group(1).strip()
            note_lines.insert(0, note_text)
            leftover = last[:m.start()].strip()
            remaining_lines.pop()
            if leftover:
                remaining_lines.append(leftover)
        else:
            break
    lines = remaining_lines

    if note_lines:
        record['note_raw'] = ' | '.join(note_lines)
        note_upper = record['note_raw'].upper()
        if 'TELUGU' in note_upper: record['language_hint'] = 'TELUGU'
        elif 'TAMIL' in note_upper: record['language_hint'] = 'TAMIL'
        elif 'ENGLISH' in note_upper: record['language_hint'] = 'ENGLISH'
        copies_m = re.search(r'(\d+)\s*COP(Y|IES)', note_upper)
        if copies_m:
            record['diary_copies'] = int(copies_m.group(1))

    if not lines:
        return None

    # --- Extract phone from all lines ---
    phone, lines = extract_phone(lines)
    record['phone'] = phone

    if not lines:
        return None

    # --- First line: title + name ---
    first = lines[0]
    title_match = TITLE_PATTERN.match(first)
    if title_match:
        raw_title = title_match.group(1).upper().rstrip('.')
        if raw_title == 'RI': raw_title = 'SRI'
        if raw_title == 'MRS': raw_title = 'SMT'
        if raw_title == 'MR': raw_title = 'SRI'
        record['title'] = raw_title
        record['full_name'] = first[title_match.end():].strip().rstrip(',.')
    else:
        # Check if name starts with initial like "S.Thiruvenkatachari"
        record['full_name'] = first.strip().rstrip(',.')
        record['title'] = 'OTHER'
        warnings.append('no_title_found')

    if not record['full_name']:
        warnings.append('empty_name')
        record['parse_confidence'] = 'low'
        record['parse_warnings'] = ','.join(warnings)
        return record

    # --- Process address lines ---
    addr_lines = lines[1:]

    # Detect foreign addresses
    raw_upper = raw_text.upper()
    if 'USA' in raw_upper or ' NY ' in raw_upper or ' CA ' in raw_upper or ' TX ' in raw_upper:
        record['country'] = 'USA'
    elif 'CANADA' in raw_upper:
        record['country'] = 'Canada'
    elif 'UK' in raw_upper or 'UNITED KINGDOM' in raw_upper or 'ENGLAND' in raw_upper:
        record['country'] = 'UK'
    elif 'SINGAPORE' in raw_upper:
        record['country'] = 'Singapore'
    elif 'AUSTRALIA' in raw_upper:
        record['country'] = 'Australia'

    # --- Find PIN code ---
    pin_value = None
    pin_line_idx = None

    # Strategy 1: Look for "CITY – PIN" pattern
    for i, line in enumerate(addr_lines):
        m = CITY_PIN_PATTERN.match(line)
        if m:
            city_part = m.group(1).strip().rstrip(',.')
            pin_raw = normalize_pin(m.group(2))
            if len(pin_raw) == 6 and pin_raw.isdigit():
                pin_value = pin_raw
                pin_line_idx = i
                # The city part before the PIN
                if city_part and not record['city']:
                    record['city'] = city_part
                break

    # Strategy 2: Look for standalone PIN or "PIN XXXXXX"
    if not pin_value:
        for i in range(len(addr_lines) - 1, -1, -1):
            m = PIN_PATTERN.search(addr_lines[i])
            if m:
                pin_raw = normalize_pin(m.group(1))
                if len(pin_raw) == 6 and pin_raw.isdigit():
                    pin_value = pin_raw
                    pin_line_idx = i
                    # Check what's left on this line after removing PIN
                    leftover = PIN_PATTERN.sub('', addr_lines[i]).strip(' -–—,.')
                    leftover = re.sub(r'^PIN\s*', '', leftover, flags=re.IGNORECASE).strip()
                    if leftover and not record['city']:
                        # Could be "CITY" or "CITY. STATE"
                        parts = re.split(r'[.,]\s*', leftover)
                        record['city'] = parts[0].strip()
                        if len(parts) > 1:
                            for p in parts[1:]:
                                if is_state_name(p.strip()):
                                    record['state'] = p.strip()
                    break

    if pin_value:
        record['pin_code'] = pin_value
    else:
        warnings.append('no_pin_found')
        if record['country'] == 'India':
            record['parse_confidence'] = 'needs_review'

    # --- Extract state from lines ---
    state_line_idx = None
    for i, line in enumerate(addr_lines):
        if i == pin_line_idx:
            continue
        if is_state_name(line):
            record['state'] = line.strip()
            state_line_idx = i
            break

    # --- If city not found yet, check line before PIN ---
    if not record['city'] and pin_line_idx is not None:
        # Check if PIN was alone on its line
        pin_line_stripped = PIN_PATTERN.sub('', addr_lines[pin_line_idx]).strip(' -–—,.')
        if not pin_line_stripped:
            # PIN was alone — city is likely the line before
            candidate_idx = pin_line_idx - 1
            while candidate_idx >= 0 and candidate_idx == state_line_idx:
                candidate_idx -= 1
            if candidate_idx >= 0:
                candidate = addr_lines[candidate_idx].strip().rstrip(',.')
                # Check if it looks like a city (short, possibly known)
                if len(candidate.split()) <= 4 or is_city_name(candidate):
                    record['city'] = candidate

    # --- PIN-based city/state resolution ---
    if pin_value:
        if not record['city']:
            record['city'] = city_from_pin(pin_value)
            if record['city']:
                warnings.append('city_from_pin')
        if not record['state']:
            record['state'] = state_from_pin(pin_value)
            if record['state']:
                warnings.append('state_from_pin')

    # --- Build address lines from remaining ---
    used_indices = set()
    if pin_line_idx is not None:
        used_indices.add(pin_line_idx)
    if state_line_idx is not None:
        used_indices.add(state_line_idx)

    # If the city was extracted from a line before PIN, mark it
    if record['city'] and pin_line_idx is not None:
        for i, line in enumerate(addr_lines):
            if i in used_indices:
                continue
            clean_line = line.strip().rstrip(',.')
            if clean_line.upper() == record['city'].upper():
                used_indices.add(i)
                break

    # Collect remaining lines as address
    address_parts = []
    for i, line in enumerate(addr_lines):
        if i in used_indices:
            continue
        clean_line = line.strip().rstrip('.')
        if clean_line:
            address_parts.append(clean_line)

    # Assign to address_line1, 2, 3
    if len(address_parts) >= 1:
        record['address_line1'] = address_parts[0]
    if len(address_parts) >= 2:
        record['address_line2'] = address_parts[1]
    if len(address_parts) >= 3:
        record['address_line3'] = ', '.join(address_parts[2:])
        if len(address_parts) > 3:
            warnings.append('many_address_lines')

    # --- Final confidence ---
    if not record['full_name']:
        record['parse_confidence'] = 'low'
    elif not record['pin_code'] and record['country'] == 'India':
        record['parse_confidence'] = 'needs_review'
    elif warnings:
        if record['parse_confidence'] == 'high':
            record['parse_confidence'] = 'ok'

    record['parse_warnings'] = ','.join(warnings)
    return record


def parse_document(doc_path: Path):
    """Parse all unique cells from a Word document."""
    doc = Document(doc_path)
    records = []
    counter = 0

    for t_idx, table in enumerate(doc.tables):
        for r_idx, row in enumerate(table.rows):
            for c_idx, cell in enumerate(row.cells):
                raw = cell.text
                if not raw or not raw.strip():
                    continue
                counter += 1
                import_id = f't{t_idx}r{r_idx}c{c_idx}#{counter}'
                rec = parse_cell(raw, import_id)
                if rec:
                    records.append(rec)

    # Dedupe on raw text (merged cells repeat)
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
    ap = argparse.ArgumentParser(description='Smart parser for Seva Trust member docs')
    ap.add_argument('--input', required=True, help='Path to .docx')
    ap.add_argument('--output', required=True, help='Output CSV path')
    ap.add_argument('--type', choices=['life_member', 'annual'], default='life_member',
                    help='Subscription type (life_member or annual)')
    args = ap.parse_args()

    src = Path(args.input)
    if not src.exists():
        sys.exit(f"ERROR: {src} not found")
    if src.suffix.lower() == '.doc':
        sys.exit("ERROR: convert .doc to .docx first: soffice --headless --convert-to docx ...")

    print(f"Parsing {src} (type: {args.type})...")
    records = parse_document(src)
    print(f"  Found {len(records)} unique entries")

    # Add subscription type
    for r in records:
        r['subscription_type'] = args.type

    fieldnames = [
        'legacy_import_id', 'parse_confidence', 'parse_warnings',
        'subscription_type',
        'title', 'full_name', 'phone',
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

    from collections import Counter
    conf = Counter(r['parse_confidence'] for r in records)
    print(f"\nWrote {args.output}")
    print("Confidence breakdown:")
    for k, v in sorted(conf.items()):
        print(f"  {k:15s} {v}")

    # Show city/state resolution stats
    with_city = sum(1 for r in records if r['city'])
    with_state = sum(1 for r in records if r['state'])
    with_pin = sum(1 for r in records if r['pin_code'])
    with_phone = sum(1 for r in records if r['phone'])
    print(f"\nResolution stats:")
    print(f"  PIN found:   {with_pin}/{len(records)}")
    print(f"  City found:  {with_city}/{len(records)}")
    print(f"  State found: {with_state}/{len(records)}")
    print(f"  Phone found: {with_phone}/{len(records)}")

    low = [r for r in records if r['parse_confidence'] in ('low', 'needs_review')]
    if low:
        print(f"\n{len(low)} records need review. Sample:")
        for r in low[:5]:
            print(f"  [{r['parse_confidence']}] {r['full_name']}: {r['parse_warnings']}")
            print(f"    raw: {r['legacy_raw_text'][:100]}")


if __name__ == '__main__':
    main()
