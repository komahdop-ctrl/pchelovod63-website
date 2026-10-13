"""Create web-ready copies without modifying the original event photographs."""

from pathlib import Path
from PIL import Image, ImageOps

SOURCE = Path(r"D:\ChatGPT\Мои фото и видео\Дружба 2026\Фото")
OUTPUT = Path(__file__).parents[1] / "public" / "assets" / "photos"

SELECTION = {
    "druzhba-hero.webp": "IMG_20261010_123824.jpg",
    "druzhba-event.webp": "IMG_20261010_123833.jpg",
    "druzhba-video.webp": "IMG_20261010_120845.jpg",
    "druzhba-01.webp": "IMG_20261010_120527.jpg",
    "druzhba-02.webp": "IMG_20261010_120631.jpg",
    "druzhba-03.webp": "IMG_20261010_120845.jpg",
    "druzhba-04.webp": "IMG_20261010_123635.jpg",
    "druzhba-05.webp": "IMG_20261010_131458.jpg",
    "druzhba-06.webp": "IMG_20261010_131512.jpg",
    "druzhba-07.webp": "IMG_20261010_142959.jpg",
    "druzhba-08.webp": "IMG_20261010_163142.jpg",
    "druzhba-09.webp": "IMG_20261011_101649_385.jpg",
    "druzhba-10.webp": "IMG_20261011_101649_355.jpg",
    "druzhba-11.webp": "IMG_20261010_171227.jpg",
    "druzhba-12.webp": "IMG_20261011_101649_187.jpg",
}

OUTPUT.mkdir(parents=True, exist_ok=True)
for output_name, source_name in SELECTION.items():
    with Image.open(SOURCE / source_name) as image:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
        image.save(OUTPUT / output_name, "WEBP", quality=84, method=6)
        print(f"{source_name} -> {output_name} ({image.width}x{image.height})")
