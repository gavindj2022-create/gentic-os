"""Generate the GenTIC OS gold-robot app icon (multi-size .ico + .png).

Draws a stylized gold AI-robot head with a glowing cyan visor on a dark
rounded tile, matching the dashboard's gold (#c9a227) + cyan (#00c8c8) brand.
Run:  python assets/make_icon.py
"""
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

S = 512  # base canvas (high-res, downsampled on save)
GOLD = (201, 162, 39, 255)
GOLD_HI = (232, 192, 74, 255)
GOLD_DK = (140, 110, 24, 255)
CYAN = (0, 200, 200, 255)
CYAN_HI = (120, 245, 245, 255)
DARK = (16, 15, 12, 255)


def rr(draw, box, radius, **kw):
    draw.rounded_rectangle(box, radius=radius, **kw)


def make():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # ── Dark rounded background tile with gold rim ──
    rr(d, (8, 8, S - 8, S - 8), 96, fill=DARK, outline=GOLD_DK, width=6)

    cx = S // 2

    # ── Antenna ──
    d.line((cx, 96, cx, 150), fill=GOLD_HI, width=10)
    # glowing cyan antenna tip
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((cx - 26, 70, cx + 26, 122), fill=CYAN)
    glow = glow.filter(ImageFilter.GaussianBlur(10))
    img.alpha_composite(glow)
    d.ellipse((cx - 18, 78, cx + 18, 114), fill=CYAN_HI, outline=CYAN, width=3)

    # ── Ears / side modules ──
    rr(d, (96, 250, 130, 330), 14, fill=GOLD_DK)
    rr(d, (S - 130, 250, S - 96, 330), 14, fill=GOLD_DK)

    # ── Head ──
    head = (140, 150, S - 140, S - 110)
    rr(d, head, 64, fill=GOLD, outline=GOLD_HI, width=6)
    # top sheen
    rr(d, (160, 168, S - 160, 240), 40, fill=GOLD_HI)

    # ── Visor band ──
    visor = (172, 250, S - 172, 360)
    rr(d, visor, 36, fill=(20, 22, 24, 255), outline=GOLD_DK, width=4)

    # ── Glowing cyan eyes ──
    eye_glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    eg = ImageDraw.Draw(eye_glow)
    for ex in (212, S - 212 - 56):
        eg.rounded_rectangle((ex, 282, ex + 56, 330), radius=18, fill=CYAN)
    eye_glow = eye_glow.filter(ImageFilter.GaussianBlur(8))
    img.alpha_composite(eye_glow)
    for ex in (212, S - 212 - 56):
        d.rounded_rectangle((ex, 282, ex + 56, 330), radius=18, fill=CYAN_HI, outline=CYAN, width=3)

    # ── Mouth grille ──
    for i in range(4):
        x = 200 + i * 30
        d.rounded_rectangle((x, 388, x + 18, 430), radius=6, fill=GOLD_DK)

    return img


def main():
    out = Path(__file__).parent
    img = make()
    png = out / "gentic.png"
    ico = out / "gentic.ico"
    img.save(png)
    img.save(ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    # SVG-less favicon: a 64px PNG for the browser tab
    img.resize((64, 64), Image.LANCZOS).save(out / "favicon.png")
    print(f"wrote {ico}\nwrote {png}")


if __name__ == "__main__":
    main()
