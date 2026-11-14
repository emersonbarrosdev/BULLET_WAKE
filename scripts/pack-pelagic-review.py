"""
Builds the 12-frame connected 2.5D coastal archipelago atlas (public/assets/arcade/pelagic-review/formations.webp,
3072x2304, 12 cells of 768x768), generates the 12-frame 2.5D perspective seagull spritesheet (seagulls.webp: 0..5 fly,
6..8 glide, 9..11 perched), refines the 4-frame boat wake spritesheet (wakes.webp), and writes exact measured silhouette
profiles to src/game/arcade/PelagicAlphaProfiles.ts.
"""
from collections import deque
import hashlib
import json
import math
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

root = Path(__file__).resolve().parents[1]
out = root / "public/assets/arcade/pelagic-review"
out.mkdir(exist_ok=True)

base_8_path = out / "base-formations-8.webp"
formations_path = out / "formations.webp"
if not base_8_path.exists():
    shutil.copyfile(formations_path, base_8_path)

continuous_src = Path(
    r"C:\Users\emers\.gemini\antigravity\brain\b3596df5-9f75-4a8d-802e-f10c1650a77d\coastal_formations_2x2_atlas_1794614874115.jpg"
)
base_cont_path = out / "base-continuous-4.webp"
if continuous_src.exists() and not base_cont_path.exists():
    Image.open(continuous_src).convert("RGB").save(base_cont_path, "WEBP", quality=96, method=6)


def strip_black_and_round_ends(img: Image.Image, side: int) -> Image.Image:
    """
    Flood-fills pure black exterior background (#000000) to transparent, keeps roofs/lagoons/corals intact,
    and rounds off flat top/bottom quadrant crop edges into organic coastal headlands.
    """
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    visited = [[False] * w for _ in range(h)]
    q = deque()

    def is_pure_black(r: int, g: int, b: int, a: int) -> bool:
        return a < 20 or (r < 22 and g < 22 and b < 24 and (r + g + b) < 52)

    for x in range(w):
        for y in (0, 1, h - 2, h - 1):
            if not visited[y][x] and is_pure_black(*px[x, y]):
                visited[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, 1, w - 2, w - 1):
            if not visited[y][x] and is_pure_black(*px[x, y]):
                visited[y][x] = True
                q.append((x, y))

    while q:
        cx, cy = q.popleft()
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if is_pure_black(*px[nx, ny]):
                    visited[ny][nx] = True
                    q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if visited[y][x]:
                px[x, y] = (0, 0, 0, 0)

    bbox = rgba.getbbox()
    if bbox:
        top_y, bot_y = bbox[1], bbox[3] - 1
        span_w = max(1, bbox[2] - bbox[0])
        for y in range(top_y, bot_y + 1):
            ty = min(y - top_y, bot_y - y)
            end_fade = 1.0 if ty >= 18 else (ty / 18.0) ** 1.15
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                # Soften bright cyan lagoon water slightly so live ocean caustics show through
                if r < 95 and g > 155 and b > 175 and b > r + 80 and g > r + 65:
                    r, g, b, a = int(r * 0.72 + 12), int(g * 0.84 + 18), int(b * 0.90 + 18), int(a * 0.80)

                taper = 1.0
                if ty < 96:
                    dist_from_wall = (x - bbox[0]) if side < 0 else (bbox[2] - 1 - x)
                    allowed = span_w * (0.06 + 0.94 * ((ty / 96.0) ** 0.62))
                    if dist_from_wall > allowed:
                        taper = max(0.0, 1.0 - (dist_from_wall - allowed) / 26.0)
                na = int(round(a * end_fade * taper))
                px[x, y] = (r, g, b, na) if na >= 20 else (0, 0, 0, 0)

    alpha = rgba.getchannel("A").filter(ImageFilter.GaussianBlur(radius=0.8))
    a_px = alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            na = a_px[x, y] if a > 0 else 0
            if na < 24:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (r, g, b, min(a, na))
    return rgba


def strip_cyan_rim(img: Image.Image) -> Image.Image:
    """Flood-fills artificial cyan water rims from exterior transparent pixels while keeping foam, sand, rock, and foliage."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    visited = [[False] * w for _ in range(h)]
    q = deque()

    def is_cyan_rim(r: int, g: int, b: int, a: int) -> bool:
        if a < 24:
            return True
        if r > 185 and g > 205 and b > 205:
            return False
        if r >= g - 10 or g > b + 18:
            return False
        return b > r + 28 and g > r + 14 and r < 165

    for x in range(w):
        for y in (0, 1, h - 2, h - 1):
            if not visited[y][x] and is_cyan_rim(*px[x, y]):
                visited[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, 1, w - 2, w - 1):
            if not visited[y][x] and is_cyan_rim(*px[x, y]):
                visited[y][x] = True
                q.append((x, y))

    while q:
        cx, cy = q.popleft()
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if is_cyan_rim(*px[nx, ny]):
                    visited[ny][nx] = True
                    q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if visited[y][x]:
                px[x, y] = (0, 0, 0, 0)

    alpha = rgba.getchannel("A").filter(ImageFilter.GaussianBlur(radius=0.8))
    a_px = alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            na = a_px[x, y] if a > 0 else 0
            if na < 24:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (r, g, b, min(a, na))
    return rgba


def crop_nonzero(img: Image.Image) -> Image.Image:
    bbox = img.getchannel("A").getbbox()
    return img.crop(bbox) if bbox else img


def place_coastal(
    piece: Image.Image,
    side: int,
    max_w: int = 520,
    max_h: int = 744,
    edge_pad: int = -18,
    backing: Image.Image | None = None,
) -> Image.Image:
    """Places a single unstacked coastal formation into a 768x768 cell, anchored flush to the coastal edge."""
    canvas = Image.new("RGBA", (768, 768), (0, 0, 0, 0))
    if backing is not None and side != 0:
        b_crop = crop_nonzero(backing)
        bw, bh = b_crop.size
        b_scale = min(460 / max(1, bw), 748 / max(1, bh))
        bnw, bnh = max(1, int(round(bw * b_scale))), max(1, int(round(bh * b_scale)))
        b_res = b_crop.resize((bnw, bnh), Image.Resampling.LANCZOS)
        # Place upper and lower coastal shoulder backing tucked against the wall so there is never a V-notch at the border
        bx = -36 if side < 0 else (768 - bnw + 36)
        canvas.alpha_composite(b_res, (bx, 10))
        canvas.alpha_composite(b_res, (bx, 758 - bnh))

    cropped = crop_nonzero(piece)
    w, h = cropped.size
    scale = min(max_w / max(1, w), max_h / max(1, h))
    nw, nh = max(1, int(round(w * scale))), max(1, int(round(h * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    if side < 0:
        x_dst = edge_pad
    elif side > 0:
        x_dst = 768 - nw - edge_pad
    else:
        x_dst = (768 - nw) // 2
    y_dst = (768 - nh) // 2
    canvas.alpha_composite(resized, (x_dst, y_dst))
    return canvas


def build_seagulls_spritesheet(out_path: Path) -> None:
    """
    Generates a 12-frame (1536x128, 12 cells of 128x128) 2.5D three-quarter perspective seagull spritesheet:
      - Frames 0..5 (6 frames): 'seagull-fly' — 2.5D cambered wingbeat cycle facing right-upward (3/4 isometric view)
      - Frames 6..8 (3 frames): 'seagull-glide' — 2.5D soaring coastal glide matching the reference illustration
      - Frames 9..11 (3 frames): 'seagull-perch' — 2.5D perched gull standing on rock/pier with folded wings
    """
    sheet = Image.new("RGBA", (1536, 128), (0, 0, 0, 0))

    outline = (20, 44, 74, 255)
    white_pure = (252, 254, 255, 255)
    white_warm = (238, 246, 255, 255)
    under_shade = (182, 208, 232, 255)
    mantle_grey = (196, 214, 232, 255)
    wing_tip_dark = (36, 56, 82, 255)
    beak_gold = (255, 194, 44, 255)
    leg_orange = (238, 146, 42, 255)

    flight_poses = [
        (1.0, 26, -8, -4),     # 0: High upstroke V-arch
        (0.45, 18, -2, -2),    # 1: Mid-downstroke power sweep
        (-0.35, 6, 8, 2),      # 2: Deep downstroke
        (-0.85, -10, 14, 4),   # 3: Full downstroke (wings arched below body)
        (-0.20, 8, 6, 1),      # 4: Upstroke recovery
        (0.55, 20, -4, -2),    # 5: Upper recovery
        (0.18, 16, 2, 0),      # 6: Glide neutral
        (0.26, 19, 0, -1),     # 7: Glide thermal lift
        (0.12, 14, 4, 1),      # 8: Glide tip flex
    ]

    for idx, (flap, arch, sweep, lift) in enumerate(flight_poses):
        cell = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        d = ImageDraw.Draw(cell)
        cx, cy = 128, 134 + lift

        far_root_f = (cx - 4, cy - 12)
        far_root_b = (cx - 16, cy - 2)
        far_elbow = (cx - 46 - sweep // 2, cy - 42 - int(flap * 26) - arch // 2)
        far_wrist = (cx - 82 - sweep, cy - 52 - int(flap * 38) - arch // 3)
        far_tip = (cx - 106 - sweep, cy - 44 - int(flap * 44))
        far_trail = (cx - 64 - sweep // 2, cy - 22 - int(flap * 20))

        far_wing = [far_root_f, far_elbow, far_wrist, far_tip, far_trail, far_root_b]
        d.polygon(far_wing, fill=white_warm, outline=outline, width=4)
        far_tip_poly = [far_wrist, far_tip, far_trail, (cx - 74 - sweep // 2, cy - 34 - int(flap * 28))]
        d.polygon(far_tip_poly, fill=wing_tip_dark, outline=outline, width=3)

        tail_poly = [
            (cx - 18, cy + 6),
            (cx - 42, cy + 20),
            (cx - 34, cy + 28),
            (cx - 26, cy + 32),
            (cx - 8, cy + 16),
        ]
        d.polygon(tail_poly, fill=under_shade, outline=outline, width=4)

        body_poly = [
            (cx - 22, cy + 12),
            (cx - 8, cy - 10),
            (cx + 18, cy - 22),
            (cx + 32, cy - 20),
            (cx + 24, cy - 4),
            (cx + 2, cy + 14),
        ]
        d.polygon(body_poly, fill=under_shade, outline=outline, width=4)
        d.polygon(
            [(cx - 16, cy + 6), (cx - 4, cy - 9), (cx + 20, cy - 20), (cx + 26, cy - 12), (cx + 4, cy + 6)],
            fill=white_pure,
        )

        d.ellipse([cx + 14, cy - 30, cx + 38, cy - 10], fill=white_pure, outline=outline, width=4)
        beak_poly = [(cx + 34, cy - 24), (cx + 52, cy - 26), (cx + 48, cy - 18), (cx + 34, cy - 16)]
        d.polygon(beak_poly, fill=beak_gold, outline=outline, width=3)
        d.ellipse([cx + 26, cy - 24, cx + 30, cy - 20], fill=outline)

        near_root_f = (cx + 12, cy - 8)
        near_root_b = (cx - 6, cy + 8)
        near_elbow = (cx + 34 + sweep // 2, cy + 14 - int(flap * 28) - arch // 2)
        near_wrist = (cx + 68 + sweep, cy + 28 - int(flap * 44) - arch // 3)
        near_tip = (cx + 98 + sweep, cy + 44 - int(flap * 52))
        near_trail_outer = (cx + 72 + sweep, cy + 48 - int(flap * 42))
        near_trail_inner = (cx + 28 + sweep // 2, cy + 26 - int(flap * 18))

        near_wing = [near_root_f, near_elbow, near_wrist, near_tip, near_trail_outer, near_trail_inner, near_root_b]
        d.polygon(near_wing, fill=mantle_grey, outline=outline, width=4)
        near_hi = [
            (cx + 10, cy - 5),
            near_elbow,
            near_wrist,
            (cx + 52 + sweep // 2, cy + 28 - int(flap * 30)),
            (cx + 4, cy + 6),
        ]
        d.polygon(near_hi, fill=white_pure)
        near_tip_poly = [
            near_wrist,
            near_tip,
            near_trail_outer,
            (cx + 58 + sweep, cy + 38 - int(flap * 36)),
        ]
        d.polygon(near_tip_poly, fill=wing_tip_dark, outline=outline, width=3)

        small = cell.resize((128, 128), Image.Resampling.LANCZOS)
        sheet.alpha_composite(small, (idx * 128, 0))

    perch_poses = [
        (0, 0, 0),
        (3, -2, 2),
        (-2, 1, -1),
    ]
    for p_idx, (head_dx, head_dy, wing_dy) in enumerate(perch_poses):
        idx = 9 + p_idx
        cell = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        d = ImageDraw.Draw(cell)
        cx, cy = 128, 138

        d.ellipse([cx - 24, cy + 24, cx + 22, cy + 38], fill=(16, 38, 62, 95))
        d.line([(cx - 4, cy + 10), (cx - 6, cy + 28)], fill=leg_orange, width=5)
        d.line([(cx + 6, cy + 10), (cx + 4, cy + 28)], fill=leg_orange, width=5)
        d.polygon(
            [(cx - 18, cy + 2), (cx - 48, cy + 12 + wing_dy), (cx - 42, cy + 22 + wing_dy), (cx - 12, cy + 14)],
            fill=wing_tip_dark,
            outline=outline,
            width=4,
        )
        d.ellipse([cx - 26, cy - 16, cx + 24, cy + 20], fill=under_shade, outline=outline, width=4)
        d.ellipse([cx - 22, cy - 14, cx + 22, cy + 14], fill=white_pure)
        d.polygon(
            [
                (cx - 20, cy - 8),
                (cx + 10, cy - 12),
                (cx + 14, cy + 4 + wing_dy),
                (cx - 26, cy + 10 + wing_dy),
            ],
            fill=mantle_grey,
            outline=outline,
            width=4,
        )
        hx, hy = cx + 16 + head_dx, cy - 22 + head_dy
        d.ellipse([hx - 14, hy - 12, hx + 14, hy + 12], fill=white_pure, outline=outline, width=4)
        d.polygon(
            [(hx + 10, hy - 4), (hx + 28, hy - 2), (hx + 24, hy + 5), (hx + 10, hy + 4)],
            fill=beak_gold,
            outline=outline,
            width=3,
        )
        d.ellipse([hx + 2, hy - 4, hx + 6, hy], fill=outline)

        small = cell.resize((128, 128), Image.Resampling.LANCZOS)
        sheet.alpha_composite(small, (idx * 128, 0))

    sheet.save(out_path, "WEBP", lossless=True)


def build_refined_wakes(base_wakes_path: Path, wakes_path: Path) -> None:
    """Refines wakes.webp so the wake is a sleek, continuous, tapering foamy propeller trail without rigid split horns."""
    src = Image.open(base_wakes_path).convert("RGBA")
    s_px = src.load()
    dst = Image.new("RGBA", src.size, (0, 0, 0, 0))
    d_px = dst.load()

    for frame in range(4):
        fx0 = frame * 256
        phase = frame * (math.pi / 2.0)
        for y in range(512):
            t = max(0.0, min(1.0, (440.0 - y) / 370.0))
            squeeze = 1.0 + 0.55 * (t ** 1.15)
            tail_fade = 1.0 if y >= 230 else max(0.0, (y - 75.0) / 155.0) ** 1.4
            tip_fade = 1.0 if y <= 442 else max(0.0, (468.0 - y) / 26.0)
            env_fade = tail_fade * tip_fade
            if env_fade <= 0.001:
                continue

            for x_local in range(256):
                dx = x_local - 128.0
                src_x = int(round(128.0 + dx * squeeze))
                r, g, b, a = (0, 0, 0, 0)
                if 0 <= src_x < 256:
                    r, g, b, a = s_px[fx0 + src_x, y]

                half_width = 10.0 + t * 44.0
                abs_dx = abs(dx)
                prop_foam = 0.0
                if abs_dx < half_width and 90 <= y <= 438:
                    radial = 1.0 - (abs_dx / half_width) ** 1.6
                    ripple1 = 0.5 + 0.5 * math.sin(y * 0.14 + phase + abs_dx * 0.12)
                    ripple2 = 0.5 + 0.5 * math.cos(y * 0.08 - phase * 1.0 + dx * 0.09)
                    prop_foam = radial * (0.45 + 0.55 * ripple1 * ripple2) * (1.0 - 0.35 * t)

                base_a = min(255.0, a * 1.75) * env_fade
                fill_a = prop_foam * 195.0 * env_fade
                final_a = int(min(255.0, max(base_a, fill_a)))
                if final_a <= 4:
                    continue

                lum = (r + g + b) / 3.0 if a > 0 else 210.0
                if prop_foam > 0.48 or lum > 205:
                    d_px[fx0 + x_local, y] = (242, 255, 255, final_a)
                else:
                    d_px[fx0 + x_local, y] = (68, 218, 242, final_a)

    dst.save(wakes_path, lossless=True)


def main() -> None:
    base_8 = Image.open(base_8_path).convert("RGBA")
    orig = [
        base_8.crop(((i % 4) * 768, (i // 4) * 768, ((i % 4) + 1) * 768, ((i // 4) + 1) * 768))
        for i in range(8)
    ]

    coast_sheet = Image.open(root / "public/assets/arcade/pelagic-coast.webp").convert("RGBA")
    coast_cells = [
        strip_cyan_rim(
            coast_sheet.crop(((i % 4) * 512, (i // 4) * 512, ((i % 4) + 1) * 512, ((i // 4) + 1) * 512))
        )
        for i in range(8)
    ]

    arch_sheet = Image.open(root / "public/assets/arcade/pelagic-archipelago.webp").convert("RGBA")
    arch_cells = [
        strip_cyan_rim(
            arch_sheet.crop(((i % 4) * 512, (i // 4) * 512, ((i % 4) + 1) * 512, ((i // 4) + 1) * 512))
        )
        for i in range(8)
    ]

    cont_img = Image.open(base_cont_path).convert("RGBA")
    cont_cells = [
        strip_black_and_round_ends(cont_img.crop((0, 0, 505, 500)), -1),        # 0: Left Beach, Cliff & Boulders
        strip_black_and_round_ends(cont_img.crop((510, 0, 1024, 500)), 1),      # 1: Right Harbor Pier & Cliffs
        strip_black_and_round_ends(cont_img.crop((0, 500, 505, 1024)), -1),     # 2: Left Lagoon Beach & Boathouse
        strip_black_and_round_ends(cont_img.crop((510, 500, 1024, 1024)), 1),   # 3: Right Beach Cove & Coral Reef
    ]

    # Build rich painterly 2.5D coastal beach variations (zero flat vector cutouts or straight crop edges)
    frame6_coast = place_coastal(orig[0], -1, max_w=520, max_h=744, edge_pad=-18, backing=orig[4])
    frame6_fg = place_coastal(coast_cells[0], -1, max_w=490, max_h=710, edge_pad=10)
    frame6_coast.alpha_composite(frame6_fg)

    frame8_coast = place_coastal(orig[4], -1, max_w=525, max_h=744, edge_pad=-18, backing=orig[0])
    frame8_fg = place_coastal(coast_cells[1], -1, max_w=470, max_h=680, edge_pad=14)
    frame8_coast.alpha_composite(frame8_fg)

    frame10_coast = place_coastal(orig[0], -1, max_w=525, max_h=744, edge_pad=-18, backing=orig[4])
    frame10_fg = place_coastal(coast_cells[6], -1, max_w=465, max_h=660, edge_pad=12)
    frame10_coast.alpha_composite(frame10_fg)

    frame11_coast = place_coastal(orig[3], 1, max_w=525, max_h=744, edge_pad=-18, backing=orig[3])
    frame11_fg = place_coastal(coast_cells[6], 1, max_w=465, max_h=660, edge_pad=12)
    frame11_coast.alpha_composite(frame11_fg)

    # All 12 frames are single, unstacked, crisp painterly 2.5D coastal formations anchored flush to the edge
    frames = [
        place_coastal(orig[0], -1, max_w=525, max_h=744, edge_pad=-18, backing=orig[0]),       # 0 (Left): Crescent Sandy Beach & Palm Headland
        place_coastal(orig[1], 1, max_w=520, max_h=720, edge_pad=-14, backing=orig[3]),        # 1 (Right): Cliff Lighthouse & Stone Stairs
        place_coastal(orig[2], -1, max_w=530, max_h=720, edge_pad=-14, backing=orig[0]),       # 2 (Left): Grand Harbor Complex
        place_coastal(orig[3], 1, max_w=525, max_h=744, edge_pad=-18, backing=orig[3]),        # 3 (Right): Sandy Beach Cove & Palm Cliffs
        place_coastal(orig[4], -1, max_w=520, max_h=744, edge_pad=-18, backing=orig[4]),       # 4 (Left): Fishing Village Beach & Huts
        orig[5],                                                                               # 5 (Accent): Sculpted Sea Stack Boulders
        frame6_coast,                                                                          # 6 (Left): Lush Palm & Hibiscus Sandy Beach Peninsula
        place_coastal(arch_cells[3], 1, max_w=520, max_h=744, edge_pad=-18, backing=orig[3]),  # 7 (Right): Terraced Cliff & Golden Sand Cove
        frame8_coast,                                                                          # 8 (Left): Continuous Golden Beach & Tide-Pool Boulders
        place_coastal(coast_cells[5], 1, max_w=520, max_h=720, edge_pad=-14, backing=orig[3]), # 9 (Right): Right Harbor Pier & Yellow Crane
        frame10_coast,                                                                         # 10 (Left): Tropical Lagoon Palm Cove
        frame11_coast,                                                                         # 11 (Right): Golden Sand Beach Cove & Palm Cliffs
    ]

    seagulls_path = out / "seagulls.webp"
    build_seagulls_spritesheet(seagulls_path)

    atlas = Image.new("RGBA", (3072, 2304))
    profiles = []
    for idx, cell in enumerate(frames):
        col, row_idx = idx % 4, idx // 4
        atlas.alpha_composite(cell, (col * 768, row_idx * 768))
        alpha = cell.getchannel("A")
        rows = []
        for r in range(96):
            occupied = [
                xx
                for yy in range(r * 8, (r + 1) * 8)
                for xx in range(768)
                if alpha.getpixel((xx, yy)) > 100
            ]
            rows.append(
                [round(min(occupied) / 768, 4), round((max(occupied) + 1) / 768, 4)]
                if occupied
                else [1, 0]
            )
        profiles.append(rows)

    atlas.save(formations_path, "WEBP", quality=94, method=6)

    wakes_path = out / "wakes.webp"
    base_wakes_path = out / "base-wakes.webp"
    if not base_wakes_path.exists():
        shutil.copyfile(wakes_path, base_wakes_path)
    build_refined_wakes(base_wakes_path, wakes_path)

    (root / "src/game/arcade/PelagicAlphaProfiles.ts").write_text(
        "// Generated by pack-pelagic-review.py from the exact rendered alpha. Do not hand edit.\n"
        "export const COAST_ALPHA_PROFILES: ReadonlyArray<ReadonlyArray<readonly [number,number]>> = "
        + json.dumps(profiles, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
    (out / "manifest.json").write_text(
        json.dumps(
            {
                "generator": "native imagegen",
                "packing": "12-frame connected archipelago chains; exact alpha profiles",
                "sources": [
                    {"file": p.name, "sha256": sha(p)}
                    for p in [
                        base_8_path,
                        base_cont_path,
                        out.parent / "pelagic-archipelago.webp",
                        out.parent / "pelagic-coast.webp",
                    ]
                ],
                "outputs": [
                    {"file": p.name, "sha256": sha(p)}
                    for p in [formations_path, out / "water.webp", wakes_path, seagulls_path]
                ],
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print("Packed 12-frame formations.webp:", atlas.size, "and 12-frame seagulls.webp")


if __name__ == "__main__":
    main()
