#!/usr/bin/env python3
"""
build_session_spritesheet.py
============================

Builds ONE per-session stimulus spritesheet + a logged index->identity map.
Replaces make_sprites.py and shuffle_spritesheets.py in the live asset path.

The map JSON is the single source of truth linking a sprite CELL to a stimulus
IDENTITY, and is what the game loads (assets/themes/<name>_map.json) so that
Boat can resolve cue -> sprite cell with no offset arithmetic. It is also the
traceability artifact: given a log + this map, every cue's (shape, texture,
manifest_index) is recoverable.

Layout matches objects.js SquareSpriteSheet.getImage(): row-major, cols columns,
sprite_index i -> (col=i%cols, row=i//cols). cols = ceil(sqrt(n)).

Because the locked design uses a FIXED pool (6 shapes x 3 textures; dotted
dropped), the sheet content is identical across sessions -- so in practice one
sheet serves all three sessions. It is still written per-session-named for
provenance and to stay future-proof if the pool ever varies.

Usage:
    python build_session_spritesheet.py \
        --stimuli-dir stimuli_out_final \
        --manifest stimuli_out_final/manifest.csv \
        --training-dir assets/training \
        --name session_stimuli \
        --out-dir assets/themes
"""

import csv
import json
import argparse
from math import ceil, sqrt
from pathlib import Path

from PIL import Image

ALL_TEXTURES = ["outline", "hatch", "solid", "dotted"]
DEFAULT_DROPPED = "dotted"
SPRITE_SIZE = 128


def load_manifest(path):
    rows = []
    with open(path, newline="") as f:
        for r in csv.DictReader(f):
            rows.append({
                "manifest_index": int(r["index"]),
                "shape": r["shape"].strip(),
                "texture": r["texture"].strip(),
                "filename": r["filename"].strip(),
            })
    return rows


def prepare(path, size):
    """Scale (preserve aspect) and center on a transparent size x size canvas."""
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    scale = min(size / w, size / h)
    img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2))
    return canvas


def build(stimuli_dir, manifest_path, training_dir, name, out_dir,
          dropped_texture=DEFAULT_DROPPED, sprite_size=SPRITE_SIZE):
    stimuli_dir = Path(stimuli_dir)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    manifest = load_manifest(manifest_path)
    # Canonical, stable ordering: stimulus pool sorted by manifest_index, then training.
    pool = sorted([m for m in manifest if m["texture"] != dropped_texture],
                  key=lambda m: m["manifest_index"])
    assert len(pool) == 18, f"Expected 18 pool images, got {len(pool)}"

    entries = []  # (identity dict, source path)
    for m in pool:
        entries.append((dict(m, training=False), stimuli_dir / m["filename"]))

    if training_dir:
        training_dir = Path(training_dir)
        train_files = sorted(
            p for p in training_dir.iterdir()
            if p.suffix.lower() in (".png", ".jpg", ".jpeg")
        )
        for p in train_files:
            entries.append((
                {"manifest_index": None, "shape": "training",
                 "texture": None, "filename": p.name, "training": True},
                p,
            ))

    n = len(entries)
    cols = int(ceil(sqrt(n)))
    rows = int(ceil(n / cols))

    sheet = Image.new("RGBA", (cols * sprite_size, rows * sprite_size), (0, 0, 0, 0))
    sprites_meta = []
    for i, (identity, src) in enumerate(entries):
        col, row = i % cols, i // cols
        sheet.paste(prepare(src, sprite_size), (col * sprite_size, row * sprite_size))
        sprites_meta.append({"sprite_index": i, **identity})

    sheet_path = out_dir / f"{name}.png"
    map_path = out_dir / f"{name}_map.json"
    sheet.save(sheet_path)

    sheet_map = {
        "name": name,
        "sprite_size": sprite_size,
        "cols": cols,
        "rows": rows,
        "n_sprites": n,
        "dropped_texture": dropped_texture,
        "sprites": sprites_meta,
    }
    with open(map_path, "w") as f:
        json.dump(sheet_map, f, indent=2)

    # Hard checks: identities unique, indices contiguous, layout consistent.
    assert [s["sprite_index"] for s in sprites_meta] == list(range(n)), "non-contiguous sprite indices"
    stim = [(s["shape"], s["texture"]) for s in sprites_meta if not s["training"]]
    assert len(set(stim)) == 18, "duplicate stimulus identities in sheet"

    print(f"Wrote {sheet_path}  ({cols}x{rows}, {n} sprites)")
    print(f"Wrote {map_path}")
    return sheet_path, map_path, sheet_map


def main():
    ap = argparse.ArgumentParser(description="Build one per-session spritesheet + index->identity map.")
    ap.add_argument("--stimuli-dir", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--training-dir", default=None, help="Folder of training images (optional).")
    ap.add_argument("--name", default="session_stimuli")
    ap.add_argument("--out-dir", default="assets/themes")
    ap.add_argument("--dropped-texture", default=DEFAULT_DROPPED, choices=ALL_TEXTURES)
    ap.add_argument("--sprite-size", type=int, default=SPRITE_SIZE)
    args = ap.parse_args()
    build(args.stimuli_dir, args.manifest, args.training_dir, args.name,
          args.out_dir, args.dropped_texture, args.sprite_size)


if __name__ == "__main__":
    main()
