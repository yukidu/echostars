"""Generate the install icons from a small vector drawing; no external images."""
from pathlib import Path
from PIL import Image, ImageDraw

target = Path(__file__).resolve().parents[1] / "public"
image = Image.new("RGB", (512, 512))
pixels = image.load()
for y in range(512):
    for x in range(512):
        t = (x + y) / 1022
        pixels[x, y] = tuple(round(a + (b - a) * t) for a, b in zip((217, 144, 166), (159, 79, 109)))
draw = ImageDraw.Draw(image)
draw.ellipse((118, 118, 394, 394), fill=(206, 140, 162))
draw.polygon([(204, 166), (341, 134), (341, 167), (230, 194), (230, 322), (204, 322)], fill="white")
draw.rectangle((315, 160, 341, 282), fill="white")
draw.ellipse((158, 295, 230, 347), fill="white")
draw.ellipse((269, 255, 341, 307), fill="white")
for x, y, r in [(106, 120, 12), (402, 114, 8), (406, 380, 11)]:
    draw.ellipse((x-r, y-r, x+r, y+r), fill="white")
for size in (192, 512):
    image.resize((size, size), Image.Resampling.LANCZOS).save(target / f"icon-{size}.png")
