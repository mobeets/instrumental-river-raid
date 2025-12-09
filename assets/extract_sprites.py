from PIL import Image
import os

def split_image_into_squares(input_path, output_dir, tile_size, n_per_row=0):
    """
    Splits an image into square tiles of size (tile_size x tile_size).

    Args:
        input_path (str): Path to the input PNG image.
        tile_size (int): Width/height of each square tile.
        output_dir (str): Directory where tiles are saved.
    """

    # Load the source image
    img = Image.open(input_path)
    width, height = img.size
    if n_per_row > 0:
        # override tile_size
        tile_size = int(width / n_per_row)

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    tile_id = 0
    for y in range(0, height, tile_size):
        for x in range(0, width, tile_size):
            # Only take full tiles (optional)
            if x + tile_size <= width and y + tile_size <= height:
                tile = img.crop((x, y, x + tile_size, y + tile_size))
                tile.save(os.path.join(output_dir, f"tile_{tile_id}.png"))
                tile_id += 1

    print(f"Saved {tile_id} tiles to '{output_dir}'")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Generates a spritesheet from an image directory.")
    parser.add_argument("input_path", help="Path to input .png file")
    parser.add_argument("directory", help="Path to save resulting image files")
    parser.add_argument("--sprite_size", default=64, type=int, help="Final size of each sprite (n.b. will force square)")
    parser.add_argument("--n_per_row", default=0, type=int, help="Number of images per row (overrides sprite_size)")
    args = parser.parse_args()

    split_image_into_squares(args.input_path, args.directory, args.sprite_size, args.n_per_row)
