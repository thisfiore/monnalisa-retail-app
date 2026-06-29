#!/usr/bin/env python3
"""Build sample.csv from the full legacy export, picking rows that exercise
each branch of the normalization pipeline. See plan verification section."""
from __future__ import annotations

import csv
import random
from collections import Counter, defaultdict
from pathlib import Path

random.seed(42)  # deterministic sample

HERE = Path(__file__).parent
SRC = HERE / "5c2d03dded2e4bbcb4c7981ef0e1dc83.csv"
OUT = HERE / "sample.csv"

EMAIL_RE_BASIC = "@"  # any "@" is a fast filter; deeper validation happens in app


def is_data_row(r: list[str]) -> bool:
    if not r or len(r) < 9:
        return False
    if r[0].strip().lower() == "total":
        return False
    if r[3].strip() == "-" and r[4].strip() == "-":
        return False
    return True


def looks_corrupted(r: list[str]) -> bool:
    # Field counts off, embedded newlines (would already break csv.reader so we
    # detect via odd field shapes or stray quotes in source-row text).
    if len(r) != 17:
        return True
    for cell in r:
        if "\n" in cell or '"' in cell:
            return True
    return False


def has_email(r: list[str]) -> bool:
    e = r[7].strip()
    return bool(e) and e != "-"


def has_phone1(r: list[str]) -> bool:
    p = r[8].strip()
    return bool(p) and p != "-"


def phone_is_intl(r: list[str]) -> bool:
    p = r[8].strip()
    return p.startswith("+")


def has_compleanno1(r: list[str]) -> bool:
    c = r[10].strip()
    return bool(c) and c != "-"


def has_compleanno2(r: list[str]) -> bool:
    c = r[11].strip()
    return bool(c) and c != "-"


def email_looks_off(r: list[str]) -> bool:
    e = r[7].strip()
    if not has_email(r):
        return False
    if "@" not in e:
        return True
    if e.count("@") > 1:
        return True
    if " " in e:
        return True
    if ".." in e:
        return True
    if not e.split("@")[-1].count("."):
        return True
    return False


# Buckets to fill — each is (name, target_count, predicate)
BUCKETS: list[tuple[str, int, callable]] = [
    ("ready_path",        80,  lambda r: has_email(r) and has_phone1(r) and phone_is_intl(r)),
    ("only_phone",        40,  lambda r: not has_email(r) and has_phone1(r)),
    ("only_email",        20,  lambda r: has_email(r) and not has_phone1(r)),
    ("neither_contact",   25,  lambda r: not has_email(r) and not has_phone1(r)),
    ("phone_no_plus",     40,  lambda r: has_phone1(r) and not phone_is_intl(r)),
    ("email_malformed",   25,  lambda r: email_looks_off(r)),
    ("with_compleanno_1", 30,  lambda r: has_compleanno1(r) and not has_compleanno2(r)),
    ("with_compleanno_2", 20,  lambda r: has_compleanno1(r) and has_compleanno2(r)),
]

# We additionally pull a chunk of one Italian store so the manager has a
# realistic per-store view, plus a few international stores for locale variety.
ANCHOR_STORES = [
    ("Italy", "Forte dei Marmi", 60),
    ("Italy", "Arezzo temporary", 25),
    ("USA", "Sawgrass", 30),
    ("China", "Chongqing TS", 25),
    ("Turkey", "Istanbul Airport", 20),
    ("UK", "Harrods", 20),
]

def main() -> None:
    with SRC.open(encoding="utf-8-sig", newline="") as fh:
        reader = csv.reader(fh, delimiter=";")
        rows = list(reader)

    header, *body = rows
    print(f"Loaded {len(body):,} raw rows")

    data_rows = [r for r in body if is_data_row(r)]
    corrupted = [r for r in body if looks_corrupted(r) and is_data_row(r)]
    print(f"  data rows:     {len(data_rows):,}")
    print(f"  corrupted-ish: {len(corrupted):,}")

    by_id: dict[str, list[int]] = defaultdict(list)
    for i, r in enumerate(data_rows):
        cid = r[3].strip()
        if cid and cid != "-":
            by_id[cid].append(i)
    duplicate_ids = [cid for cid, idxs in by_id.items() if len(idxs) >= 2]
    print(f"  dup IDs (>=2 stores): {len(duplicate_ids):,}")

    selected_idx: set[int] = set()
    counts: Counter = Counter()

    # 1. Anchor stores
    for country, store, n in ANCHOR_STORES:
        pool = [i for i, r in enumerate(data_rows) if r[0].strip() == country and r[1].strip() == store]
        pick = random.sample(pool, min(n, len(pool)))
        for i in pick:
            selected_idx.add(i)
        counts[f"anchor_{country}_{store}"] = len(pick)

    # 2. Buckets
    for name, target, pred in BUCKETS:
        pool = [i for i, r in enumerate(data_rows) if i not in selected_idx and pred(r)]
        pick = random.sample(pool, min(target, len(pool)))
        for i in pick:
            selected_idx.add(i)
        counts[name] = len(pick)

    # 3. Duplicate-ID rows: pick 10 IDs, include all rows for each
    dup_pick = random.sample(duplicate_ids, min(10, len(duplicate_ids)))
    dup_added = 0
    for cid in dup_pick:
        for i in by_id[cid]:
            if i not in selected_idx:
                selected_idx.add(i)
                dup_added += 1
    counts["duplicate_ids"] = dup_added

    # 4. Corrupted rows: include up to 10
    corrupted_pool = [i for i, r in enumerate(data_rows) if i not in selected_idx and looks_corrupted(r)]
    corr_pick = random.sample(corrupted_pool, min(10, len(corrupted_pool)))
    for i in corr_pick:
        selected_idx.add(i)
    counts["corrupted"] = len(corr_pick)

    final_rows = [data_rows[i] for i in sorted(selected_idx)]
    print(f"\nSample size: {len(final_rows):,} rows")
    for k, v in counts.items():
        print(f"  {k}: {v}")

    with OUT.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh, delimiter=";")
        writer.writerow(header)
        writer.writerows(final_rows)
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
