#!/usr/bin/env python3
"""
Generate a stylized icon for Code Edit Video.

Design concept: A warm, whimsical icon inspired by Studio Ghibli aesthetics.
- Soft gradient sky background (sunset tones)
- A stylized film reel / code editor window
- Floating code characters with a magical, hand-drawn feel
- Warm color palette: sunset orange, soft blue, cream, forest green
"""

import math
from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
CENTER = SIZE // 2
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)


# ─── Helper: draw a rounded rectangle ───
def rounded_rect(draw, xy, radius, fill=None, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


# ─── Helper: radial gradient background ───
def draw_gradient_circle(img, center, radius, color_inner, color_outer):
    """Draw a soft radial gradient circle."""
    for r in range(radius, 0, -1):
        t = r / radius
        color = tuple(
            int(color_inner[i] * (1 - t) + color_outer[i] * t) for i in range(3)
        ) + (255,)
        bbox = (center[0] - r, center[1] - r, center[0] + r, center[1] + r)
        draw_temp = ImageDraw.Draw(img)
        draw_temp.ellipse(bbox, fill=color)


# ─── 1. Background: Warm sunset gradient ───
for y in range(SIZE):
    t = y / SIZE
    # Ghibli-inspired sunset: soft peach → warm orange → gentle purple
    if t < 0.5:
        t2 = t / 0.5
        r = int(255 * (1 - t2) + 255 * t2)
        g = int(218 * (1 - t2) + 160 * t2)
        b = int(185 * (1 - t2) + 122 * t2)
    else:
        t2 = (t - 0.5) / 0.5
        r = int(255 * (1 - t2) + 180 * t2)
        g = int(160 * (1 - t2) + 120 * t2)
        b = int(122 * (1 - t2) + 160 * t2)
    for x in range(SIZE):
        img.putpixel((x, y), (r, g, b, 255))

# ─── 2. Soft circular mask (app icon shape) ───
mask = Image.new("L", (SIZE, SIZE), 0)
mask_draw = ImageDraw.Draw(mask)
# Rounded square mask
mask_draw.rounded_rectangle(
    [40, 40, SIZE - 40, SIZE - 40], radius=200, fill=255
)
# Apply mask
bg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
bg.paste(img, mask=mask)
img = bg
draw = ImageDraw.Draw(img)

# ─── 3. Floating clouds (Ghibli-style) ───
def draw_cloud(draw, cx, cy, scale=1.0, alpha=80):
    """Draw a soft, puffy cloud."""
    cloud_color = (255, 255, 255, alpha)
    offsets = [
        (0, 0, 60),
        (-40, 10, 45),
        (40, 10, 45),
        (-20, -15, 35),
        (20, -15, 35),
    ]
    for ox, oy, r in offsets:
        r = int(r * scale)
        ox = int(ox * scale)
        oy = int(oy * scale)
        bbox = (cx + ox - r, cy + oy - r, cx + ox + r, cy + oy + r)
        draw.ellipse(bbox, fill=cloud_color)


draw_cloud(draw, 180, 200, scale=1.2, alpha=60)
draw_cloud(draw, 800, 160, scale=0.9, alpha=50)
draw_cloud(draw, 520, 130, scale=0.7, alpha=40)

# ─── 4. Main element: Code editor window ───
# Window frame
win_x, win_y = 160, 250
win_w, win_h = 700, 520
win_radius = 24

# Window shadow
rounded_rect(
    draw,
    [win_x + 8, win_y + 8, win_x + win_w + 8, win_y + win_h + 8],
    win_radius,
    fill=(60, 40, 40, 80),
)

# Window body - dark editor background with warm tint
rounded_rect(
    draw,
    [win_x, win_y, win_x + win_w, win_y + win_h],
    win_radius,
    fill=(42, 38, 52, 240),
)

# Title bar
rounded_rect(
    draw,
    [win_x, win_y, win_x + win_w, win_y + 50],
    win_radius,
    fill=(58, 52, 68, 240),
)
# Fix bottom corners of title bar
draw.rectangle(
    [win_x, win_y + 30, win_x + win_w, win_y + 50],
    fill=(58, 52, 68, 240),
)

# Traffic light buttons (macOS style, Ghibli-warm colors)
btn_y = win_y + 25
for i, color in enumerate([(255, 120, 100), (255, 200, 100), (120, 210, 140)]):
    bx = win_x + 30 + i * 32
    draw.ellipse([bx - 9, btn_y - 9, bx + 9, btn_y + 9], fill=color)

# ─── 5. Code lines (stylized, colorful) ───
code_x = win_x + 35
code_y = win_y + 75
line_height = 36

# Simulated code lines with Ghibli-warm syntax colors
code_lines = [
    # (indent, segments: [(width, color)])
    (0, [(80, (200, 140, 220)), (15, (180, 180, 180)), (120, (140, 200, 255)), (15, (180, 180, 180)), (60, (255, 200, 120))]),
    (1, [(100, (255, 180, 140)), (15, (180, 180, 180)), (150, (160, 220, 180))]),
    (2, [(60, (200, 140, 220)), (15, (180, 180, 180)), (200, (140, 200, 255))]),
    (2, [(80, (255, 200, 120)), (10, (180, 180, 180)), (100, (255, 180, 140)), (10, (180, 180, 180)), (60, (160, 220, 180))]),
    (2, [(180, (140, 200, 255))]),
    (1, [(40, (200, 140, 220))]),
    (0, [(40, (200, 140, 220))]),
    (0, []),  # empty line
    (0, [(60, (255, 180, 140)), (15, (180, 180, 180)), (180, (160, 220, 180))]),
    (1, [(120, (140, 200, 255)), (15, (180, 180, 180)), (80, (255, 200, 120))]),
]

for i, (indent, segments) in enumerate(code_lines):
    ly = code_y + i * line_height
    if ly + line_height > win_y + win_h - 20:
        break
    lx = code_x + indent * 30
    for seg_w, seg_color in segments:
        # Draw rounded code segment
        seg_color_alpha = seg_color + (200,)
        rounded_rect(
            draw,
            [lx, ly, lx + seg_w, ly + 14],
            radius=7,
            fill=seg_color_alpha,
        )
        lx += seg_w + 8

# ─── 6. Typing cursor (blinking) ───
cursor_x = code_x + 2 * 30 + 60 + 8 + 200 + 8  # After last segment of line 3
cursor_y = code_y + 2 * line_height - 2
draw.rectangle(
    [cursor_x, cursor_y, cursor_x + 3, cursor_y + 18],
    fill=(255, 255, 255, 220),
)

# ─── 7. Film reel / recording indicator ───
# Red recording dot with glow
rec_cx, rec_cy = win_x + win_w - 50, win_y + 25
# Glow
for r in range(20, 0, -1):
    alpha = int(40 * (1 - r / 20))
    draw.ellipse(
        [rec_cx - r, rec_cy - r, rec_cx + r, rec_cy + r],
        fill=(255, 80, 80, alpha),
    )
# Solid dot
draw.ellipse(
    [rec_cx - 8, rec_cy - 8, rec_cx + 8, rec_cy + 8],
    fill=(255, 80, 80, 255),
)
# "REC" text indicator
try:
    font_small = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
except:
    font_small = ImageFont.load_default()
draw.text((rec_cx + 14, rec_cy - 8), "REC", fill=(255, 120, 120, 200), font=font_small)

# ─── 8. Film strip decoration on right side ───
strip_x = win_x + win_w + 30
strip_w = 60
strip_top = win_y + 40
strip_bot = win_y + win_h - 40

# Film strip body
draw.rectangle(
    [strip_x, strip_top, strip_x + strip_w, strip_bot],
    fill=(60, 50, 50, 180),
)

# Sprocket holes
for y in range(strip_top + 20, strip_bot - 10, 40):
    # Left holes
    draw.rounded_rectangle(
        [strip_x + 4, y, strip_x + 16, y + 20],
        radius=4,
        fill=(200, 180, 160, 100),
    )
    # Right holes
    draw.rounded_rectangle(
        [strip_x + strip_w - 16, y, strip_x + strip_w - 4, y + 20],
        radius=4,
        fill=(200, 180, 160, 100),
    )
    # Frame content (tiny gradient squares)
    frame_color = (
        int(180 + 40 * math.sin(y * 0.05)),
        int(150 + 30 * math.cos(y * 0.03)),
        int(140 + 40 * math.sin(y * 0.07)),
        160,
    )
    draw.rectangle(
        [strip_x + 18, y + 2, strip_x + strip_w - 18, y + 18],
        fill=frame_color,
    )

# ─── 9. Sparkle / magic particles (Ghibli dust motes) ───
import random

random.seed(42)  # Deterministic
sparkle_positions = [
    (140, 450),
    (880, 350),
    (300, 750),
    (750, 700),
    (500, 820),
    (200, 600),
    (850, 550),
    (650, 180),
    (400, 170),
]

for sx, sy in sparkle_positions:
    # Check if inside the rounded rect mask area
    dx = abs(sx - CENTER)
    dy = abs(sy - CENTER)
    if dx > SIZE // 2 - 80 or dy > SIZE // 2 - 80:
        continue

    size = random.randint(3, 8)
    alpha = random.randint(100, 200)
    color = (255, 255, random.randint(200, 255), alpha)

    # 4-pointed star
    for angle in [0, math.pi / 2]:
        x1 = int(sx + size * 2.5 * math.cos(angle))
        y1 = int(sy + size * 2.5 * math.sin(angle))
        x2 = int(sx - size * 2.5 * math.cos(angle))
        y2 = int(sy - size * 2.5 * math.sin(angle))
        draw.line([(x1, y1), (x2, y2)], fill=color, width=2)

    # Center dot
    draw.ellipse(
        [sx - size // 2, sy - size // 2, sx + size // 2, sy + size // 2],
        fill=(255, 255, 255, alpha),
    )

# ─── 10. Bottom text / brand ───
try:
    font_brand = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
except:
    font_brand = ImageFont.load_default()

# "< />" code symbol at bottom
code_symbol = "</>"
bbox = draw.textbbox((0, 0), code_symbol, font=font_brand)
tw = bbox[2] - bbox[0]
draw.text(
    (CENTER - tw // 2, SIZE - 130),
    code_symbol,
    fill=(255, 255, 255, 160),
    font=font_brand,
)

# ─── Save ───
output_path = "/Users/yunge/Desktop/codeSpace/code-edit-video/src-tauri/icons/icon.png"
img.save(output_path, "PNG")
print(f"✅ Icon saved to {output_path}")
print(f"   Size: {SIZE}x{SIZE}")

# Also save a copy for reference
ref_path = "/Users/yunge/Desktop/codeSpace/code-edit-video/src-tauri/icons/icon-1024.png"
img.save(ref_path, "PNG")
print(f"   Reference copy: {ref_path}")
