"""
Loads the constants shared with the JS frontend from shared/sim_config.json.
Python is the authoritative side: edit values in that file, not as copies here.
"""
import json
from pathlib import Path

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "shared" / "sim_config.json"

with open(_CONFIG_PATH, encoding="utf-8") as f:
    cfg = json.load(f)
