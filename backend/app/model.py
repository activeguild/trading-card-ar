import io
import base64

import numpy as np
from PIL import Image, ImageOps
from rembg import remove, new_session

_session = None


def load_model() -> None:
    global _session
    _session = new_session("isnet-general-use")


def _image_to_base64(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def segment_image(image: Image.Image) -> dict[str, str]:
    image = ImageOps.exif_transpose(image.convert("RGB"))

    # rembg returns RGBA with background transparent
    person = remove(image, session=_session)

    # Background: invert the alpha channel
    person_arr = np.array(person)
    bg_arr = np.array(image.convert("RGBA"))
    bg_arr[:, :, 3] = 255 - person_arr[:, :, 3]
    background = Image.fromarray(bg_arr, "RGBA")

    return {
        "person": _image_to_base64(person),
        "background": _image_to_base64(background),
    }
