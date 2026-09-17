#!/usr/bin/env python3
"""
validate_config_against_map.py
===============================

Mimics spriteIndexForCue() from sketch.js exactly:
    1. Try to resolve by manifest_index (primary path).
    2. Fall back to resolve by filename.
    3. If neither resolves -> this cue would silently render as sprite 0
       in-browser, with only a console.error to notice it by.

Walks every block, every cue, in a generated CONFIG_*.json and checks each one
against a session_stimuli_*_map.json, so a broken reference is caught here,
on the command line, before it can happen silently mid-session.

Usage:
    python validate_config_against_map.py --config CONFIG_s1.json --map session_stimuli_map.json
"""

import json
import argparse
import sys


def build_lookups(sheet_map):
    by_manifest = {}
    by_filename = {}
    for s in sheet_map["sprites"]:
        if s.get("manifest_index") is not None:
            by_manifest[s["manifest_index"]] = s["sprite_index"]
        if s.get("filename"):
            by_filename[s["filename"]] = s["sprite_index"]
    return by_manifest, by_filename


def resolve_cue(cue, by_manifest, by_filename, sprites_by_index):
    """Returns (sprite_index, method, identity_mismatch) where identity_mismatch
    is None if the resolved sprite's shape matches the cue's claimed shape, or
    a description string if it silently resolves to something else entirely."""
    mi = cue.get("manifest_index")
    sprite_index, method = None, None
    if mi is not None and mi in by_manifest:
        sprite_index, method = by_manifest[mi], "manifest_index"
    elif cue.get("filename") and cue["filename"] in by_filename:
        sprite_index, method = by_filename[cue["filename"]], "filename"

    if sprite_index is None:
        return None, "UNRESOLVED", None

    resolved_shape = sprites_by_index[sprite_index].get("shape")
    mismatch = None
    if resolved_shape != cue.get("shape"):
        mismatch = f"cue claims shape={cue.get('shape')!r} but resolves to sprite shape={resolved_shape!r}"
    return sprite_index, method, mismatch


def validate(config_path, map_path):
    blocks = json.load(open(config_path))
    sheet_map = json.load(open(map_path))
    by_manifest, by_filename = build_lookups(sheet_map)
    sprites_by_index = {s["sprite_index"]: s for s in sheet_map["sprites"]}

    total_cues = 0
    unresolved = []
    mismatched = []

    for block_idx, block in enumerate(blocks):
        for cue in block.get("cues", []):
            total_cues += 1
            sprite_index, method, mismatch = resolve_cue(cue, by_manifest, by_filename, sprites_by_index)
            record = {
                "block_idx": block_idx, "block_name": block["name"], "is_practice": block["is_practice"],
                "cue_index": cue.get("cue_index"), "shape": cue.get("shape"),
                "manifest_index": cue.get("manifest_index"), "filename": cue.get("filename"),
            }
            if sprite_index is None:
                unresolved.append(record)
            elif mismatch:
                record["detail"] = mismatch
                mismatched.append(record)

    print(f"Checked {total_cues} cues across {len(blocks)} blocks.")
    if not unresolved and not mismatched:
        print(f"PASS -- every cue resolved to the correct sprite (map has {sheet_map['n_sprites']} sprites).")
        return True

    if unresolved:
        print(f"\nFAIL -- {len(unresolved)} cue(s) UNRESOLVED (no matching sprite at all; "
              f"would default to sprite 0 in-browser with a console.error):")
        for p in unresolved:
            print(f"  block {p['block_idx']} ({p['block_name']}, practice={p['is_practice']}), "
                  f"cue_index={p['cue_index']}: shape={p['shape']!r} "
                  f"manifest_index={p['manifest_index']!r} filename={p['filename']!r}")

    if mismatched:
        print(f"\nFAIL -- {len(mismatched)} cue(s) resolve to a SPRITE THAT EXISTS BUT IS THE WRONG SHAPE "
              f"(no error would be thrown -- this fails silently in-browser):")
        for p in mismatched:
            print(f"  block {p['block_idx']} ({p['block_name']}, practice={p['is_practice']}), "
                  f"cue_index={p['cue_index']}: {p['detail']}")

    return False


def main():
    ap = argparse.ArgumentParser(description="Validate every cue in a CONFIG json against a spritesheet map.")
    ap.add_argument("--config", required=True, help="Path to a generated CONFIG_*.json")
    ap.add_argument("--map", required=True, help="Path to session_stimuli_*_map.json")
    args = ap.parse_args()

    ok = validate(args.config, args.map)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
