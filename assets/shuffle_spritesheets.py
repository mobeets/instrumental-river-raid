"""
shuffle_spritesheets.py

Creates N shuffled versions of existing spritesheets.

Usage (run from assets/):
    python shuffle_spritesheets.py abstract_1 abstract_2 --n_versions 3

For each base theme, produces:
    themes/abstract_1_v1.png
    themes/abstract_1_v2.png
    themes/abstract_1_v3.png
    ... etc.
"""

import os
import sys
import random
import shutil
import tempfile
import argparse
from PIL import Image

# ---- reuse extract logic from extract_sprites.py ----
def extract_sprites(input_path, sprite_size=128):
    """Extract individual sprites from a spritesheet, return as list of PIL Images."""
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    sprites = []
    for y in range(0, height, sprite_size):
        for x in range(0, width, sprite_size):
            if x + sprite_size <= width and y + sprite_size <= height:
                tile = img.crop((x, y, x + sprite_size, y + sprite_size))
                sprites.append(tile)
    print(f"  Extracted {len(sprites)} sprites from {input_path}")
    return sprites


def unique_shuffles(n_items, n_versions, max_attempts=10000):
    """
    Generate n_versions guaranteed-unique random orderings of range(n_items).
    Retries if a new shuffle matches any already accepted one.
    """
    accepted = []
    attempts = 0
    while len(accepted) < n_versions:
        if attempts > max_attempts:
            raise RuntimeError(
                f"Could not generate {n_versions} unique shuffles of {n_items} items "
                f"after {max_attempts} attempts."
            )
        order = list(range(n_items))
        random.shuffle(order)
        if order not in accepted:
            accepted.append(order)
        attempts += 1
    return accepted


def assemble_spritesheet(sprites, order, output_path, sprite_size=128):
    """
    Assemble sprites into a square-ish grid in the given order and save.
    order: list of indices into sprites
    """
    from math import ceil, sqrt
    ordered = [sprites[i] for i in order]
    n = len(ordered)
    cols = int(ceil(sqrt(n)))
    rows = int(ceil(n / cols))

    sheet = Image.new("RGBA", (cols * sprite_size, rows * sprite_size), (0, 0, 0, 0))
    for idx, sprite in enumerate(ordered):
        col = idx % cols
        row = idx // cols
        sheet.paste(sprite, (col * sprite_size, row * sprite_size))

    sheet.save(output_path)
    print(f"  Saved {output_path}  ({cols}x{rows} grid, {n} sprites)")


def process_theme(base_name, n_versions, sprite_size, themes_dir):
    """Extract sprites from base theme and write n_versions shuffled spritesheets."""
    input_path = os.path.join(themes_dir, f"{base_name}.png")
    if not os.path.exists(input_path):
        print(f"ERROR: {input_path} not found, skipping.")
        return []

    print(f"\nProcessing {base_name}...")
    sprites = extract_sprites(input_path, sprite_size)
    n = len(sprites)
    print(f"  Generating {n_versions} unique shuffles of {n} sprites...")

    orders = unique_shuffles(n, n_versions)

    output_names = []
    for v, order in enumerate(orders, start=1):
        out_name = f"{base_name}_v{v}"
        out_path = os.path.join(themes_dir, f"{out_name}.png")
        assemble_spritesheet(sprites, order, out_path, sprite_size)
        output_names.append(out_name)

    return output_names


def main():
    parser = argparse.ArgumentParser(
        description="Create shuffled versions of existing spritesheets."
    )
    parser.add_argument(
        "base_themes", nargs="+",
        help="Base theme names (e.g. abstract_1 abstract_2)"
    )
    parser.add_argument(
        "--n_versions", type=int, default=3,
        help="Number of shuffled versions to create per theme (default: 3)"
    )
    parser.add_argument(
        "--sprite_size", type=int, default=128,
        help="Size of each sprite in pixels (default: 128)"
    )
    parser.add_argument(
        "--themes_dir", default="themes",
        help="Directory containing spritesheets (default: themes/)"
    )
    args = parser.parse_args()

    all_output_names = []
    for base_name in args.base_themes:
        names = process_theme(base_name, args.n_versions, args.sprite_size, args.themes_dir)
        all_output_names.extend(names)

    print("\n✅ Done! Add these lines to sketch.js preload():")
    for name in all_output_names:
        print(f"  spriteSheets.{name} = new SquareSpriteSheet('assets/themes/{name}.png', spriteSize);")


if __name__ == "__main__":
    main()