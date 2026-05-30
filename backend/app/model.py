import io
import base64

import cv2
import numpy as np
from PIL import Image, ImageOps
from rembg import remove, new_session

_session = None

# Trading card dimensions (mm) → pixel ratio
CARD_W = 590
CARD_H = 860


def load_model() -> None:
    global _session
    _session = new_session("isnet-general-use")


def _image_to_base64(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def _order_points(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]   # top-left
    rect[2] = pts[np.argmax(s)]   # bottom-right
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]  # top-right
    rect[3] = pts[np.argmax(diff)]  # bottom-left
    return rect


def _correct_perspective(original: Image.Image, alpha: np.ndarray) -> Image.Image | None:
    # Binarize alpha channel
    _, binary = cv2.threshold(alpha, 128, 255, cv2.THRESH_BINARY)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    contour = max(contours, key=cv2.contourArea)

    # Approximate to quadrilateral
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, 0.02 * peri, True)

    if len(approx) != 4:
        return None

    pts = _order_points(approx.reshape(4, 2).astype(np.float32))

    # Detect orientation from quadrilateral dimensions
    w_top = np.linalg.norm(pts[1] - pts[0])
    w_bot = np.linalg.norm(pts[2] - pts[3])
    h_left = np.linalg.norm(pts[3] - pts[0])
    h_right = np.linalg.norm(pts[2] - pts[1])

    avg_w = (w_top + w_bot) / 2
    avg_h = (h_left + h_right) / 2

    if avg_w > avg_h:
        card_w, card_h = CARD_H, CARD_W  # landscape
    else:
        card_w, card_h = CARD_W, CARD_H  # portrait

    dst = np.array([
        [0, 0],
        [card_w - 1, 0],
        [card_w - 1, card_h - 1],
        [0, card_h - 1],
    ], dtype=np.float32)

    M = cv2.getPerspectiveTransform(pts, dst)
    original_arr = np.array(original.convert("RGB"))
    warped = cv2.warpPerspective(original_arr, M, (card_w, card_h))

    return Image.fromarray(warped, "RGB")


def segment_image(image: Image.Image) -> dict[str, str | None]:
    image = ImageOps.exif_transpose(image.convert("RGB"))

    # rembg returns RGBA with background transparent
    person = remove(image, session=_session)

    # Background: invert the alpha channel
    person_arr = np.array(person)
    bg_arr = np.array(image.convert("RGBA"))
    bg_arr[:, :, 3] = 255 - person_arr[:, :, 3]
    background = Image.fromarray(bg_arr, "RGBA")

    # Perspective correction using alpha mask
    corrected = _correct_perspective(image, person_arr[:, :, 3])

    result: dict[str, str | None] = {
        "person": _image_to_base64(person),
        "background": _image_to_base64(background),
        "corrected": _image_to_base64(corrected) if corrected else None,
    }
    return result
