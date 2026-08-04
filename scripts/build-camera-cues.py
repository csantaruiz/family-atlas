#!/usr/bin/env python3
"""Build camera cue sheet from Whisper transcript analysis."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPT = ROOT / "public/documentary/transcript/santa-ruiz-story.json"
OUT = ROOT / "src/documentary-engine/data/documentary-camera-cues.json"
PUBLIC_OUT = ROOT / "public/documentary/documentary-camera-cues.json"

# Ordered rules: first match at/after min_time wins for each cue id.
# sceneId maps to documentaryManifest.ts scene templates.
CUE_RULES: list[dict] = [
    {
        "id": "opening",
        "sceneId": "opening",
        "chapter": "Opening",
        "patterns": [r"every family leaves a trail"],
        "minTimeMs": 0,
    },
    {
        "id": "span-of-time",
        "sceneId": "opening-time",
        "chapter": "Opening",
        "patterns": [r"500 years", r"this story reaches across"],
        "minTimeMs": 35_000,
    },
    {
        "id": "cheshire-intro",
        "sceneId": "cheshire-records",
        "chapter": "Origins in Cheshire",
        "placeId": "cheshire",
        "patterns": [r"earliest surviving thread begins in cheshire"],
        "minTimeMs": 40_000,
    },
    {
        "id": "william-lowndes",
        "sceneId": "gawsworth-william",
        "chapter": "Origins in Cheshire",
        "placeId": "gawsworth",
        "patterns": [r"william lounds", r"william lowndes", r"recorded in 1473"],
        "minTimeMs": 44_000,
    },
    {
        "id": "gawsworth-parishes",
        "sceneId": "cheshire-hold",
        "chapter": "Origins in Cheshire",
        "placeId": "gawsworth",
        "patterns": [r"gawzworth", r"gawsworth", r"aspery", r"sandbach"],
        "minTimeMs": 70_000,
    },
    {
        "id": "cheshire-timeline",
        "sceneId": "cheshire-timeline",
        "chapter": "Origins in Cheshire",
        "placeId": "cheshire",
        "patterns": [r"history beyond it is accelerating", r"dynasties rise and fall"],
        "minTimeMs": 90_000,
    },
    {
        "id": "spain-branch",
        "sceneId": "spain-branch",
        "chapter": "Spain & Chihuahua",
        "placeId": "spain",
        "patterns": [r"kingdoms of castile", r"another part of the story"],
        "minTimeMs": 108_000,
    },
    {
        "id": "chihuahua",
        "sceneId": "chihuahua-arrival",
        "chapter": "Spain & Chihuahua",
        "placeId": "chihuahua",
        "patterns": [r"appears in chihuahua", r"connected to chihuahua"],
        "minTimeMs": 118_000,
    },
    {
        "id": "ojinaga-frontier",
        "sceneId": "ojinaga-town",
        "chapter": "Spain & Chihuahua",
        "placeId": "ojinaga",
        "patterns": [r"oginaga", r"ojinaga", r"northern mexico was a vast frontier"],
        "minTimeMs": 128_000,
    },
    {
        "id": "ojinaga-rooted",
        "sceneId": "ojinaga-town",
        "chapter": "Spain & Chihuahua",
        "placeId": "ojinaga",
        "patterns": [r"family remained rooted there", r"modern mexico"],
        "minTimeMs": 148_000,
    },
    {
        "id": "migration-begin",
        "sceneId": "migration-border",
        "chapter": "Migration",
        "placeId": "ojinaga",
        "patterns": [r"geography begins to move"],
        "minTimeMs": 158_000,
    },
    {
        "id": "ojinaga-manuel",
        "sceneId": "ojinaga-town",
        "chapter": "Migration",
        "placeId": "ojinaga",
        "patterns": [r"born in oginaga", r"born in ojinaga", r"manuel loya ruiz was born"],
        "minTimeMs": 162_000,
    },
    {
        "id": "el-paso-crossing",
        "sceneId": "migration-border",
        "chapter": "Migration",
        "placeId": "el-paso",
        "patterns": [r"el paso, texas", r"across the border in el paso", r"life ends across the border"],
        "minTimeMs": 168_000,
    },
    {
        "id": "mexico-to-us",
        "sceneId": "migration-el-paso",
        "chapter": "Migration",
        "placeId": "el-paso",
        "patterns": [r"crosses from mexico into the united states"],
        "minTimeMs": 175_000,
    },
    {
        "id": "texas-california",
        "sceneId": "migration-california",
        "chapter": "Migration",
        "placeId": "california",
        "patterns": [
            r"connected to texas and eventually california",
            r"born in el paso in 1915",
        ],
        "minTimeMs": 182_000,
    },
    {
        "id": "california-monrovia",
        "sceneId": "migration-california",
        "chapter": "Migration",
        "placeId": "california",
        "patterns": [r"manrovia, california", r"die in manrovia", r"ojinaga to california"],
        "minTimeMs": 192_000,
    },
    {
        "id": "england-stubbs-branch",
        "sceneId": "convergence-threads",
        "chapter": "Convergence",
        "placeId": "england",
        "patterns": [r"stubbs line moves out of england", r"other branches were following"],
        "minTimeMs": 206_000,
    },
    {
        "id": "multi-branch",
        "sceneId": "convergence-threads",
        "chapter": "Convergence",
        "placeId": "england",
        "patterns": [
            r"lounds and stubbs in england",
            r"ruiz in northern mexico",
            r"hendry and jackson",
        ],
        "minTimeMs": 250_000,
    },
    {
        "id": "convergence-phrase",
        "sceneId": "convergence-threads",
        "chapter": "Convergence",
        "placeId": "california",
        "patterns": [r"story of convergence", r"separate lines gradually approach"],
        "minTimeMs": 272_000,
    },
    {
        "id": "california-meet",
        "sceneId": "convergence-present",
        "chapter": "Convergence",
        "placeId": "california",
        "patterns": [r"branches meet in california", r"once-distant branches meet"],
        "minTimeMs": 288_000,
    },
    {
        "id": "santa-clara",
        "sceneId": "convergence-present",
        "chapter": "Convergence",
        "placeId": "santa-clara",
        "patterns": [r"santa clara in 1975", r"born in santa clara"],
        "minTimeMs": 294_000,
    },
    {
        "id": "five-centuries",
        "sceneId": "atlas-timeline",
        "chapter": "Enter the Atlas",
        "placeId": "gawsworth",
        "patterns": [
            r"five centuries separate",
            r"earliest dated record from the family alive today",
        ],
        "minTimeMs": 304_000,
    },
    {
        "id": "atlas-intro",
        "sceneId": "atlas-timeline",
        "chapter": "Enter the Atlas",
        "placeId": "santa-clara",
        "patterns": [r"this atlas cannot recover", r"place each life back into geography"],
        "minTimeMs": 338_000,
    },
    {
        "id": "enter-atlas",
        "sceneId": "atlas-closing",
        "chapter": "Enter the Atlas",
        "placeId": "santa-clara",
        "patterns": [r"enter the atlas", r"explore the journey for yourself"],
        "minTimeMs": 372_000,
    },
]


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def find_cue_times(segments: list[dict]) -> list[dict]:
    cues: list[dict] = []

    for rule in CUE_RULES:
        best_time: float | None = None
        best_text = ""

        for segment in segments:
            start_ms = int(round(segment["start"] * 1000))
            if start_ms < rule.get("minTimeMs", 0):
                continue
            text = normalize(segment["text"])
            for pattern in rule["patterns"]:
                if re.search(pattern, text):
                    if best_time is None or start_ms < best_time:
                        best_time = start_ms
                        best_text = segment["text"].strip()
                    break

        if best_time is None:
            raise RuntimeError(f"No transcript match for cue rule: {rule['id']}")

        cue = {
            "id": rule["id"],
            "timeMs": best_time,
            "sceneId": rule["sceneId"],
            "chapter": rule["chapter"],
            "matchedText": best_text,
        }
        if "placeId" in rule:
            cue["placeId"] = rule["placeId"]
        cues.append(cue)

    # Enforce monotonic cue times.
    for index in range(1, len(cues)):
        if cues[index]["timeMs"] <= cues[index - 1]["timeMs"]:
            cues[index]["timeMs"] = cues[index - 1]["timeMs"] + 500

    return cues


def main() -> int:
    transcript = json.loads(TRANSCRIPT.read_text(encoding="utf-8"))
    segments = transcript["segments"]
    cues = find_cue_times(segments)

    payload = {
        "source": "whisper-base transcript analysis",
        "transcriptPath": "public/documentary/transcript/santa-ruiz-story.json",
        "durationMs": int(round(segments[-1]["end"] * 1000)),
        "cues": cues,
    }

    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    PUBLIC_OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} ({len(cues)} cues)")
    for cue in cues:
        sec = cue["timeMs"] / 1000
        print(f"  {sec:6.1f}s  {cue['id']:22} -> {cue['sceneId']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
