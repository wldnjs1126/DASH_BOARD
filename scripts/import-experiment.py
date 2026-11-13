import argparse
import csv
from datetime import datetime
import io
import json
from pathlib import Path
import re
from zipfile import ZipFile

PROFILES = [
    {"age": "30대", "gender": "여성", "height": 159, "weight": 62},
    {"age": "20대", "gender": "여성", "height": 160, "weight": 43},
    {"age": "20대", "gender": "여성", "height": 163, "weight": 58},
    {"age": "30대", "gender": "남성", "height": 174, "weight": 78},
]

def read_rows(archive, participant, suffix):
    pattern = re.compile(rf"{participant}_{suffix}\.csv$")
    matches = [name for name in archive.namelist() if pattern.search(name)]
    if len(matches) != 1:
        raise ValueError(f"Expected one {suffix} CSV for participant {participant}")
    with archive.open(matches[0]) as file:
        return list(csv.DictReader(io.TextIOWrapper(file, encoding="utf-8-sig")))


def date(value):
    return datetime.fromisoformat(value) if value not in (None, "", "\\N", "NULL") else None


def integer(value):
    return int(value) if value not in (None, "", "\\N", "NULL") else None


def prepare_room(archive, participant):
    raw = read_rows(archive, participant, "sensor_raw_test")
    events = read_rows(archive, participant, "life_event_test")
    origin = min(date(row["window_start"]) for row in raw)

    def offset(value):
        stamp = date(value)
        return int((stamp - origin).total_seconds()) if stamp is not None else None

    windows = sorted((offset(row["window_start"]), offset(row["window_end"]), integer(row["sample_count"]), row["presence"] == "1") for row in raw)
    if any(start is None or end is None or end <= start for start, end, _, _ in windows):
        raise ValueError(f"Invalid sensor window for participant {participant}")
    duration = max(end for _, end, _, _ in windows)
    gaps = []
    cursor = 0
    for start, end, samples, _ in windows:
        if start > cursor:
            gaps.append([cursor, start])
        if samples == 0:
            gaps.append([start, end])
        cursor = max(cursor, end)

    records = []
    for index, row in enumerate(events, 1):
        start = offset(row["start_time"])
        detected = offset(row["detect_at"])
        if start is None:
            raise ValueError(f"Missing event start for participant {participant}, row {index}")
        records.append({
            "id": index, "type": row["event_type"], "start": start,
            "detected": detected, "end": offset(row["end_time"]),
            "duration": integer(row["duration_sec"]),
            "zone": row["zone"] if row["zone"] in {"ROOM", "BED", "OUTSIDE", "EXIT"} else None,
        })

    return {"id": chr(64 + participant), "duration": duration, "occupied": windows[-1][3], "gaps": gaps, "events": records, "profile": PROFILES[participant - 1]}


def main():
    parser = argparse.ArgumentParser(description="Prepare relative experiment records for the local CareWave preview.")
    parser.add_argument("archive", type=Path)
    args = parser.parse_args()
    output = Path(__file__).resolve().parents[1] / "experiment.local.json"
    with ZipFile(args.archive) as archive:
        data = [prepare_room(archive, participant) for participant in range(1, 5)]
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for room in data:
        print(f"{room['id']}: {len(room['events'])} events, {room['duration']} seconds")


if __name__ == "__main__":
    main()
