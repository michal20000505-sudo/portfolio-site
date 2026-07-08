import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(ROOT, 'sources', 'grafika')
THUMB_DIR = os.path.join(ROOT, 'thumbnails')

files = [
    "Lipali-koncert-roboczy-PLAKAT-3.jpg",
    "Food-point-final-ciemne-tlo.jpg",
    "Grom-art-b5-front.jpg",
    "dunajewska-ulotka.jpg",
    "digicamoblue-powder.jpg",
    "Dunajewska-voucher.jpg",
    "Wizytówka-9x5-sudbal.jpg",
    "Wizytówka-9x5.jpg",
    "Grzegorz-pirog-wizytowka.jpg",
    "render2.jpg",
    "wizytówka-max-bucz.jpg"
]

print("Checking source files:")
for f in files:
    try:
        with Image.open(os.path.join(SOURCE_DIR, f)) as img:
            print(f"{f}: {img.mode}")
    except FileNotFoundError:
        print(f"{f}: Not found")

print("\nChecking thumbnails:")
for f in files:
    try:
        with Image.open(os.path.join(THUMB_DIR, f)) as img:
            print(f"thumbnails/{f}: {img.mode}")
    except FileNotFoundError:
        print(f"thumbnails/{f}: Not found")
