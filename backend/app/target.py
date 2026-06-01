import json
import time
from pathlib import Path

from PIL import Image

THUMBNAIL_HEIGHT = 350
LUMINANCE_HEIGHT = 640


def generate_image_target(
    corrected_path: Path,
    target_dir: Path,
    name: str,
) -> str:
    """Generate 8thwall-compatible image target files from a corrected card image.

    Creates:
      - {name}.json (target metadata)
      - {name}_original.png
      - {name}_cropped.png (same as original for full-card targets)
      - {name}_thumbnail.png (resized to height 350)
      - {name}_luminance.png (grayscale, resized to height 640)

    Returns the relative path to the JSON file from uploads/.
    """
    target_dir.mkdir(parents=True, exist_ok=True)

    img = Image.open(str(corrected_path))
    w, h = img.size

    # Original
    original_name = f"{name}_original.png"
    img.save(str(target_dir / original_name), format="PNG")

    # Cropped (full image for planar card targets)
    cropped_name = f"{name}_cropped.png"
    img.save(str(target_dir / cropped_name), format="PNG")

    # Thumbnail
    thumbnail_name = f"{name}_thumbnail.png"
    thumb_w = int(w * THUMBNAIL_HEIGHT / h)
    thumb = img.resize((thumb_w, THUMBNAIL_HEIGHT), Image.Resampling.LANCZOS)
    thumb.save(str(target_dir / thumbnail_name), format="PNG")

    # Luminance (grayscale)
    luminance_name = f"{name}_luminance.png"
    lum_w = int(w * LUMINANCE_HEIGHT / h)
    lum = img.convert("L").resize((lum_w, LUMINANCE_HEIGHT), Image.Resampling.LANCZOS)
    lum.save(str(target_dir / luminance_name), format="PNG")

    # JSON metadata
    geometry = {
        "top": 0,
        "left": 0,
        "width": w,
        "height": h,
        "isRotated": False,
        "originalWidth": w,
        "originalHeight": h,
    }

    target_data = {
        "imagePath": f"image-targets/{luminance_name}",
        "metadata": None,
        "name": name,
        "type": "PLANAR",
        "properties": geometry,
        "resources": {
            "originalImage": original_name,
            "croppedImage": cropped_name,
            "thumbnailImage": thumbnail_name,
            "luminanceImage": luminance_name,
        },
        "created": int(time.time() * 1000),
        "updated": int(time.time() * 1000),
    }

    json_name = f"{name}.json"
    json_path = target_dir / json_name
    json_path.write_text(json.dumps(target_data, indent=2) + "\n")

    return json_name
