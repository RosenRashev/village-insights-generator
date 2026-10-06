"""Генерира всички икони на приложението от един източник (public/icon-512.png).

Пускане: python3 scripts/generate-icons.py   (изисква Pillow: pip install pillow)

Резултат в public/:
- icon-maskable-192.png / icon-maskable-512.png — „maskable“ икони за Android (плътен фон, логото в безопасната зона);
- apple-touch-icon.png — 180×180 на плътен бял фон (iOS показва прозрачното като черно);
- favicon.ico — 16/32/48 в един файл;
- favicon-16x16.png / favicon-32x32.png.
"""

from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / "public"
BG = (255, 255, 255, 255)

src = Image.open(PUBLIC / "icon-512.png").convert("RGBA")
# Изрязваме празните полета около логото, за да го мащабираме точно.
logo = src.crop(src.getchannel("A").getbbox())


def on_canvas(size: int, fill: float) -> Image.Image:
    """Логото, вписано във `fill` от страната на квадрат с плътен фон, центрирано."""
    canvas = Image.new("RGBA", (size, size), BG)
    target = int(size * fill)
    scale = target / max(logo.width, logo.height)
    scaled = logo.resize((round(logo.width * scale), round(logo.height * scale)), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    return canvas


# Maskable: Android реже до окръжност с диаметър 80% — логото е в централните ~62%.
for size in (192, 512):
    on_canvas(size, 0.62).convert("RGB").save(PUBLIC / f"icon-maskable-{size}.png", optimize=True)

# iOS: плътен фон, леки полета.
on_canvas(180, 0.82).convert("RGB").save(PUBLIC / "apple-touch-icon.png", optimize=True)

# Favicon-и: прозрачен фон, логото почти до ръба.
def transparent(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    scale = (size * 0.96) / max(logo.width, logo.height)
    scaled = logo.resize((round(logo.width * scale), round(logo.height * scale)), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2))
    return canvas


transparent(16).save(PUBLIC / "favicon-16x16.png", optimize=True)
transparent(32).save(PUBLIC / "favicon-32x32.png", optimize=True)
transparent(48).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("Готово.")
