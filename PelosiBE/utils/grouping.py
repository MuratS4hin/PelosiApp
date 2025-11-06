from collections import defaultdict

def group_by_purchase_date(rows):
    grouped = defaultdict(list)
    for row in rows:
        if len(row) < 5:
            continue
        purchase_date = row[3]
        grouped[purchase_date].append(row)
    return grouped

def merge_grouped_data(existing, new):
    for date, new_rows in new.items():
        if date not in existing:
            existing[date] = new_rows
        else:
            existing_keys = {f"{r[0]}|{r[2]}|{r[3]}" for r in existing[date]}
            for row in new_rows:
                if len(row) < 4:
                    continue
                key = f"{row[0]}|{row[2]}|{row[3]}"
                if key not in existing_keys:
                    existing[date].append(row)
                    existing_keys.add(key)
    return existing
