import os
import shutil
import argparse
from PIL import Image

def center_crop_square(img):
    """Crop image to square using the smaller dimension, centered."""
    w, h = img.size
    size = min(w, h)
    left = (w - size) // 2
    top = (h - size) // 2
    return img.crop((left, top, left + size, top + size))

def make_theme(src_folder, theme_name, sprite_size=128, shuffle=True):
    """
    Full pipeline to create a spritesheet from a folder of images.
    1. Check image sizes
    2. Rename files to theme_name-N format
    3. Build spritesheet
    4. Verify output
    """
    # ---- Step 1: Check sizes ----
    files = sorted([
        f for f in os.listdir(src_folder)
        if f.lower().endswith(('.png', '.jpg', '.jpeg'))
    ])
    print(f"Found {len(files)} images in {src_folder}")
    print("\nImage sizes:")
    small = []
    for f in files:
        img = Image.open(os.path.join(src_folder, f))
        w, h = img.size
        flag = " ⚠️  SMALL" if min(w, h) < sprite_size * 1.5 else ""
        print(f"  {f}: {w}x{h}{flag}")
        if flag:
            small.append(f)
    if small:
        print(f"\n⚠️  Warning: {len(small)} images may be too small and could look blurry.")
        print("Consider replacing them before proceeding.")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            return
        
    # ---- Step 2: Crop to square and rename files ----
    renamed_folder = os.path.join(
        os.path.dirname(src_folder),
        f'{theme_name}_renamed'
    )
    os.makedirs(renamed_folder, exist_ok=True)
    for idx, f in enumerate(files, 1):
        img = Image.open(os.path.join(src_folder, f)).convert("RGBA")
        img = center_crop_square(img)  # crop to square before saving
        dst = os.path.join(renamed_folder, f'{theme_name}-{idx}.png')  # always save as PNG
        img.save(dst)
    print(f"\nCropped to square and renamed {len(files)} files to {renamed_folder}")


    # ---- Step 3: Build spritesheet ----
    output_path = f'themes/{theme_name}.png'
    from make_sprites import build_spritesheet
    build_spritesheet(renamed_folder, sprite_size, output_path, shuffle=shuffle)

    # ---- Step 4: Verify ----
    img = Image.open(output_path)
    w, h = img.size
    cols = w // sprite_size
    rows = h // sprite_size
    print(f"\nVerification:")
    print(f"  Sheet size: {w}x{h}")
    print(f"  Grid: {cols}x{rows} = {cols*rows} sprites")
    print(f"\n✅ Done! Add this line to sketch.js:")
    print(f"  spriteSheets.{theme_name} = new SquareSpriteSheet('assets/themes/{theme_name}.png', spriteSize);")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build a spritesheet from a folder of images.")
    parser.add_argument("src_folder", help="Path to folder of source images")
    parser.add_argument("theme_name", help="Name of the theme (e.g. 'fractal')")
    parser.add_argument("--sprite_size", type=int, default=128, help="Size of each sprite in pixels")
    parser.add_argument("--no_shuffle", action="store_true", help="Disable shuffling")
    args = parser.parse_args()

    make_theme(args.src_folder, args.theme_name, args.sprite_size, not args.no_shuffle)