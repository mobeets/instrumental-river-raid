import os
import sys
from math import ceil, sqrt
from PIL import Image

def spaced_class_sort(filenames):
    """
    Sort filenames of the form '<class>-<number>' so that
    files of the same class are maximally spaced apart.
    """

    from collections import defaultdict, deque

    # Step 1: Group by class
    groups = defaultdict(list)
    for name in filenames:
        cls, num = name.rsplit("-", 1)
        groups[cls].append(name)

    # Step 2: Sort each class internally by number
    for cls in groups:
        groups[cls].sort(key=lambda s: int(s.split("-")[-1].split('.')[0]))
        groups[cls] = deque(groups[cls])  # faster pops

    # Step 3: Round-robin distribute
    classes = list(groups.keys())
    result = []

    while any(groups[c] for c in classes):
        for c in classes:
            if groups[c]:
                result.append(groups[c].popleft())

    return result

def load_and_prepare_image(path, sprite_size):
    """Load an image, scale to fit inside sprite_size x sprite_size,
    and center it inside a new sprite canvas."""
    img = Image.open(path).convert("RGBA")
    
    # Determine scaling while preserving aspect ratio
    w, h = img.size
    scale = min(sprite_size / w, sprite_size / h)
    new_w = int(w * scale)
    new_h = int(h * scale)

    img = img.resize((new_w, new_h), Image.LANCZOS)

    # Create centered canvas
    canvas = Image.new("RGBA", (sprite_size, sprite_size), (0, 0, 0, 0))
    offset_x = (sprite_size - new_w) // 2
    offset_y = (sprite_size - new_h) // 2
    canvas.paste(img, (offset_x, offset_y))

    return canvas

def build_spritesheet(directory, sprite_size, output_path, unsort=True):
    # Collect all image files
    files = [
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if f.lower().endswith(('.png', '.jpg', '.jpeg'))
    ]
    if not files:
        raise ValueError("No image files found in directory.")

    files = sorted(files)
    if unsort:
        files = spaced_class_sort(files)

    # Load & prepare all images
    sprites = [load_and_prepare_image(f, sprite_size) for f in files]
    n = len(sprites)

    # Determine sheet layout (square-ish grid)
    cols = int(ceil(sqrt(n)))
    rows = int(ceil(n / cols))

    sheet_width = cols * sprite_size
    sheet_height = rows * sprite_size

    # Create sheet
    sheet = Image.new("RGBA", (sheet_width, sheet_height), (0, 0, 0, 0))

    # Paste sprites into final sheet
    for idx, sprite in enumerate(sprites):
        col = idx % cols
        row = idx // cols
        x = col * sprite_size
        y = row * sprite_size
        sheet.paste(sprite, (x, y))

    # Save output
    sheet.save(output_path)
    print(f"Sprite sheet saved as {output_path}")
    print(f"Total sprites: {n}, Grid: {cols}x{rows}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python make_spritesheet.py <directory> <sprite_size> <output.png>")
        sys.exit(1)

    directory = sys.argv[1]
    sprite_size = int(sys.argv[2])
    output_path = sys.argv[3]
    print(len(sys.argv), sys.argv)
    if len(sys.argv) > 4:
        do_unsort = False if sys.argv[4].lower().startswith('f') else True
    else:
        do_unsort = True

    build_spritesheet(directory, sprite_size, output_path, do_unsort)
