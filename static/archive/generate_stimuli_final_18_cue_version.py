"""
River Raid stimulus generator (v2 shape set).

Task shapes (row order): triangle, circle, heart, diamond, star, hexagon
Textures (column order):  outline, hatch, solid, dotted
  (dotted is dropped from the live pool by the design layer; it is still
   generated here so the 24-image manifest indexing stays stable.)

Also emits the two TRAINING images into <OUTPUT_DIR>/training/:
    train_square_white.png    -- square, white fill, black border
    train_crescent_dotted.png -- crescent, dotted texture
These deliberately use shapes/textures that never appear in the task pool
(square and crescent are not task shapes; dotted is the dropped texture), so
practice cues can't be confused with real cues.

All shapes are auto-centered and scaled to a common bounding-box extent so
apparent size is matched across the set.

Output:
    stimuli_out_final/01_triangle_outline.png ... 24_hexagon_dotted.png
    stimuli_out_final/manifest.csv
    stimuli_out_final/training/train_square_white.png
    stimuli_out_final/training/train_crescent_dotted.png
"""

import csv
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.path import Path as MplPath

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CANVAS_SIZE_PX = 128
DPI = 100
FIGSIZE_INCHES = CANVAS_SIZE_PX / DPI

BACKGROUND_COLOR = "#f2f2f2"
OUTPUT_DIR = Path("stimuli_out_final")

# Task shape set (v2).
SHAPES = ["triangle", "circle", "heart", "diamond", "star", "hexagon"]

# (name, matplotlib hatch pattern or None, facecolor)
TEXTURES = [
    ("outline", None, "none"),
    ("hatch", "//", "none"),
    ("solid", None, "black"),
    ("dotted", "...", "none"),
]

TARGET_MAX_DIM = 0.66  # common bounding-box extent target, in 0-1 coords
plt.rcParams["hatch.linewidth"] = 1.6

M = MplPath.MOVETO
L = MplPath.LINETO
C = MplPath.CLOSEPOLY


# ---------------------------------------------------------------------------
# Generic centering/scaling
# ---------------------------------------------------------------------------
def normalize_verts(verts, target_max_dim=TARGET_MAX_DIM):
    xs = [v[0] for v in verts]
    ys = [v[1] for v in verts]
    xmin, xmax = min(xs), max(xs)
    ymin, ymax = min(ys), max(ys)
    cx, cy = (xmin + xmax) / 2, (ymin + ymax) / 2
    raw_max_dim = max(xmax - xmin, ymax - ymin)
    scale = target_max_dim / raw_max_dim
    return [(0.5 + (x - cx) * scale, 0.5 + (y - cy) * scale) for x, y in verts]


def circle_subpath(cx, cy, r, n=100, reverse=False):
    t = np.linspace(0, 2 * np.pi, n, endpoint=True)
    if reverse:
        t = t[::-1]
    x = cx + r * np.cos(t)
    y = cy + r * np.sin(t)
    verts = list(zip(x, y))
    codes = [M] + [L] * (len(verts) - 2) + [C]
    return verts, codes


# ---------------------------------------------------------------------------
# Raw shape definitions
# ---------------------------------------------------------------------------
def triangle_raw():
    verts = [(0.5, 0.86), (0.12, 0.16), (0.88, 0.16), (0.5, 0.86)]
    codes = [M, L, L, C]
    return verts, codes


def square_raw():
    # Training-only shape (not in task pool).
    s = 0.56
    off = (1 - s) / 2
    verts = [(off, off), (off + s, off), (off + s, off + s), (off, off + s), (off, off)]
    codes = [M, L, L, L, C]
    return verts, codes


def circle_raw():
    verts, codes = circle_subpath(0.5, 0.5, 0.37)
    return verts, codes


def heart_raw():
    t = np.linspace(0, 2 * np.pi, 300)
    x = 16 * np.sin(t) ** 3
    y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
    verts = list(zip(x, y))
    verts.append(verts[0])
    codes = [M] + [L] * (len(verts) - 2) + [C]
    return verts, codes


def crescent_raw():
    # Training-only shape (not in task pool). One true boundary so it strokes
    # correctly under every texture.
    C1 = np.array([0.0, 0.0])
    r0 = 0.37
    C2 = np.array([0.23, 0.0])
    r1 = 0.32

    n = 400
    t = np.linspace(0, 2 * np.pi, n)
    outer_pts = np.stack([C1[0] + r0 * np.cos(t), C1[1] + r0 * np.sin(t)], axis=1)
    outer_arc = outer_pts[np.linalg.norm(outer_pts - C2, axis=1) >= r1]
    inner_pts = np.stack([C2[0] + r1 * np.cos(t), C2[1] + r1 * np.sin(t)], axis=1)
    inner_arc = inner_pts[np.linalg.norm(inner_pts - C1, axis=1) <= r0]
    verts = np.concatenate([outer_arc, inner_arc[::-1]], axis=0)
    verts = [tuple(v) for v in verts]
    verts.append(verts[0])
    codes = [M] + [L] * (len(verts) - 2) + [C]
    return verts, codes


def star_raw(outer_r=0.4, inner_ratio=0.42, n_points=5):
    verts = []
    for i in range(2 * n_points):
        angle = np.pi / 2 + i * np.pi / n_points
        r = outer_r if i % 2 == 0 else outer_r * inner_ratio
        verts.append((r * np.cos(angle), r * np.sin(angle)))
    verts.append(verts[0])
    codes = [M] + [L] * (len(verts) - 2) + [C]
    return verts, codes


def diamond_raw():
    # Narrow, tall rhombus (playing-card diamond); width ~= 0.49 * height so it
    # is clearly distinct from a 45-degree-rotated square.
    verts = [(0.5, 0.95), (0.72, 0.5), (0.5, 0.05), (0.28, 0.5), (0.5, 0.95)]
    codes = [M, L, L, L, C]
    return verts, codes


def hexagon_raw(r=0.4, n_points=6):
    # Pointy-top regular hexagon.
    verts = []
    for i in range(n_points):
        angle = np.pi / 2 + i * (2 * np.pi / n_points)
        verts.append((r * np.cos(angle), r * np.sin(angle)))
    verts.append(verts[0])
    codes = [M] + [L] * (len(verts) - 2) + [C]
    return verts, codes


SHAPE_RAW_FUNCS = {
    "triangle": triangle_raw,
    "square": square_raw,      # training only
    "circle": circle_raw,
    "heart": heart_raw,
    "crescent": crescent_raw,  # training only
    "star": star_raw,
    "diamond": diamond_raw,
    "hexagon": hexagon_raw,
}


def build_path(shape_name):
    verts, codes = SHAPE_RAW_FUNCS[shape_name]()
    verts = normalize_verts(verts)
    return MplPath(verts, codes)


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------
def render_shape(shape_name, hatch, facecolor, out_path, edge_lw=1.8):
    fig = plt.figure(figsize=(FIGSIZE_INCHES, FIGSIZE_INCHES), dpi=DPI)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    fig.patch.set_facecolor(BACKGROUND_COLOR)
    ax.set_facecolor(BACKGROUND_COLOR)

    path = build_path(shape_name)
    patch = patches.PathPatch(
        path, facecolor=facecolor, edgecolor="black", hatch=hatch, linewidth=edge_lw
    )
    ax.add_patch(patch)

    fig.savefig(out_path, dpi=DPI, facecolor=BACKGROUND_COLOR)
    plt.close(fig)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    idx = 1
    for shape_name in SHAPES:
        for texture_name, hatch, facecolor in TEXTURES:
            fname = f"{idx:02d}_{shape_name}_{texture_name}.png"
            out_path = OUTPUT_DIR / fname
            render_shape(shape_name, hatch, facecolor, out_path)
            manifest.append((idx, shape_name, texture_name, fname))
            idx += 1

    with open(OUTPUT_DIR / "manifest.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["index", "shape", "texture", "filename"])
        writer.writerows(manifest)

    # ---- Training pair (off-set shapes/textures, not in the task pool) ----
    train_dir = OUTPUT_DIR / "training"
    train_dir.mkdir(parents=True, exist_ok=True)
    # White square: white fill, black border, slightly heavier edge for visibility.
    render_shape("square", None, "white", train_dir / "train_square_white.png", edge_lw=2.4)
    # Dotted crescent.
    render_shape("crescent", "...", "none", train_dir / "train_crescent_dotted.png")

    print(f"Wrote {idx - 1} pool images + manifest to {OUTPUT_DIR}/")
    print(f"Wrote 2 training images to {train_dir}/")


if __name__ == "__main__":
    main()
