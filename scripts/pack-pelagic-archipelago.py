"""
Extracts the 8 cells from the generated 2x4 archipelago sheet (on pure black background),
converts the black background and any residual outer cyan water rim to clean alpha (0),
rescales to 2048x1024 (8 cells of 512x512), and saves to public/assets/arcade/pelagic-archipelago.webp.
"""
from collections import deque
from PIL import Image, ImageFilter

SRC = r"C:\Users\emers\.gemini\antigravity\brain\b3596df5-9f75-4a8d-802e-f10c1650a77d\pelagic_archipelago_black_bg_1794604569686.jpg"
DST = r"c:\Users\emers\PROJETOS\GAMES\BULLET_WAKE\public\assets\arcade\pelagic-archipelago.webp"
PREVIEW = r"C:\Users\emers\.gemini\antigravity\brain\b3596df5-9f75-4a8d-802e-f10c1650a77d\pelagic_archipelago_packed_preview.png"


def clean_cell(cell_img: Image.Image, cell_idx: int) -> Image.Image:
    rgba = cell_img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    # Step 1: Flood-fill pure black background from all 4 borders
    visited = [[False] * w for _ in range(h)]
    bg_dist = [[999] * w for _ in range(h)]
    q = deque()

    def is_black_bg(r: int, g: int, b: int) -> bool:
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        return lum < 26 and max(r, g, b) < 38

    for x in range(w):
        for y in (0, 1, h - 2, h - 1):
            r, g, b, _ = px[x, y]
            if is_black_bg(r, g, b) and not visited[y][x]:
                visited[y][x] = True
                bg_dist[y][x] = 0
                q.append((x, y))
    for y in range(h):
        for x in (0, 1, w - 2, w - 1):
            r, g, b, _ = px[x, y]
            if is_black_bg(r, g, b) and not visited[y][x]:
                visited[y][x] = True
                bg_dist[y][x] = 0
                q.append((x, y))

    while q:
        cx, cy = q.popleft()
        for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                r, g, b, _ = px[nx, ny]
                if is_black_bg(r, g, b):
                    visited[ny][nx] = True
                    bg_dist[ny][nx] = 0
                    q.append((nx, ny))

    # Step 2: For land/island cells (0, 1, 2, 3, 4, 6), also flood-fill any outer cyan/blue
    # sticker rim within 26px of the black background.
    # For Cell 5 (Submerged Coral Reef) and Cell 7 (Abyssal Vortex), keep all turquoise/cyan art!
    if cell_idx not in (5, 7):
        rim_q = deque()
        for y in range(h):
            for x in range(w):
                if visited[y][x]:
                    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                        if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                            rim_q.append((nx, ny, 1))

        def is_water_rim(r: int, g: int, b: int) -> bool:
            if r < 45 and g < 60 and b < 75:
                return True
            if r < 125 and b > r * 1.24 and g > r * 1.12 and b > 75:
                return True
            return False

        while rim_q:
            cx, cy, d = rim_q.popleft()
            if d > 26 or visited[cy][cx]:
                continue
            r, g, b, _ = px[cx, cy]
            if is_water_rim(r, g, b):
                visited[cy][cx] = True
                bg_dist[cy][cx] = d
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                        rim_q.append((nx, ny, d + 1))

    alpha = Image.new("L", (w, h), 255)
    apx = alpha.load()
    for y in range(h):
        for x in range(w):
            if visited[y][x]:
                apx[x, y] = 0
            else:
                r, g, b, _ = px[x, y]
                if r < 16 and g < 16 and b < 16:
                    apx[x, y] = 0

    alpha = alpha.filter(ImageFilter.GaussianBlur(radius=1.1))
    apx = alpha.load()
    for y in range(h):
        for x in range(w):
            a = apx[x, y]
            if a < 42:
                px[x, y] = (0, 0, 0, 0)
            else:
                r, g, b, _ = px[x, y]
                new_a = min(255, int((a - 42) * 255 / 195))
                if cell_idx not in (5, 7) and new_a < 200 and b > r * 1.2 and g > r * 1.1:
                    new_a = int(new_a * 0.35)
                px[x, y] = (r, g, b, new_a)

    return rgba


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    sw, sh = src.size
    cw, ch = sw // 4, sh // 2

    out = Image.new("RGBA", (2048, 1024), (0, 0, 0, 0))
    preview = Image.new("RGBA", (2048, 1024), (7, 71, 133, 255))

    for row in range(2):
        for col in range(4):
            idx = row * 4 + col
            pad = 4
            box = (
                col * cw + pad,
                row * ch + pad,
                (col + 1) * cw - pad,
                (row + 1) * ch - pad,
            )
            crop = src.crop(box).resize((512, 512), Image.Resampling.LANCZOS)
            cleaned = clean_cell(crop, idx)
            out.paste(cleaned, (col * 512, row * 512))
            preview.alpha_composite(cleaned, (col * 512, row * 512))

    out.save(DST, "WEBP", quality=94, method=6)
    preview.save(PREVIEW, "PNG")
    print(f"Saved {DST} ({out.size})")


if __name__ == "__main__":
    main()
