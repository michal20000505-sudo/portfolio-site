import os
from PIL import Image, ImageCms
import io

# Configuration (paths anchored to the repo root, one level above tools/)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(ROOT, 'sources', 'grafika')
DEST_DIR = os.path.join(ROOT, 'thumbnails')
MAX_WIDTH = 800
QUALITY = 85

# Ensure destination directory exists
if not os.path.exists(DEST_DIR):
    os.makedirs(DEST_DIR)

# List of files identified from grafika.html
target_files = [
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

def generate_thumbnail(filename):
    source_path = os.path.join(SOURCE_DIR, filename)
    dest_path = os.path.join(DEST_DIR, filename)

    if not os.path.exists(source_path):
        print(f"Skipping {filename} - File not found.")
        return

    try:
        with Image.open(source_path) as img:
            # Handle CMYK conversion with profiles
            if img.mode == 'CMYK':
                print(f"Converting CMYK {filename} using ImageCms...")
                
                # Check for embedded profile
                icc = img.info.get('icc_profile')
                if icc:
                    f = io.BytesIO(icc)
                    src_profile = ImageCms.ImageCmsProfile(f)
                    dst_profile = ImageCms.createProfile('sRGB')
                    img = ImageCms.profileToProfile(img, src_profile, dst_profile, outputMode='RGB')
                else:
                    # Fallback to simple conversion if no profile
                    print("No ICC profile found, falling back to simple convert('RGB')")
                    img = img.convert('RGB')
            elif img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Calculate new height to maintain aspect ratio
            width_percent = (MAX_WIDTH / float(img.size[0]))
            
            # Only resize if the image is larger than the target width
            if width_percent < 1:
                hsize = int((float(img.size[1]) * float(width_percent)))
                img = img.resize((MAX_WIDTH, hsize), Image.Resampling.LANCZOS)
                print(f"Resized {filename} to {MAX_WIDTH}px width.")
            else:
                print(f"Copied {filename} (already small enough).")

            img.save(dest_path, "JPEG", quality=QUALITY)
            print(f"Saved thumbnail: {dest_path}")
            
    except Exception as e:
        print(f"Error processing {filename}: {e}")

def main():
    print("Starting thumbnail generation...")
    for filename in target_files:
        generate_thumbnail(filename)
    print("Thumbnail generation complete.")

if __name__ == "__main__":
    main()
