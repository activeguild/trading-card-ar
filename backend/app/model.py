import io
import base64
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torchvision import transforms

from u2net.u2net import U2NET

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "u2net_human_seg.pth"

_net: U2NET | None = None
_device: torch.device | None = None


def load_model() -> None:
    global _net, _device
    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _net = U2NET(3, 1)
    _net.load_state_dict(torch.load(str(MODEL_PATH), map_location=_device, weights_only=True))
    _net.to(_device)
    _net.eval()


def _normalize_mask(mask: torch.Tensor) -> torch.Tensor:
    ma = torch.max(mask)
    mi = torch.min(mask)
    return (mask - mi) / (ma - mi + 1e-8)


def _predict_mask(image: Image.Image) -> Image.Image:
    original_size = image.size  # (w, h)
    transform = transforms.Compose([
        transforms.Resize((320, 320)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])
    input_tensor = transform(image).unsqueeze(0).to(_device)

    with torch.no_grad():
        d0, *_ = _net(input_tensor)

    mask = _normalize_mask(d0.squeeze())
    mask_np = (mask.cpu().numpy() * 255).astype(np.uint8)
    mask_image = Image.fromarray(mask_np, mode="L")
    return mask_image.resize(original_size, Image.BILINEAR)


def _image_to_base64(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def segment_image(image: Image.Image) -> dict[str, str]:
    image = image.convert("RGB")
    mask = _predict_mask(image)
    mask_np = np.array(mask)

    # Person: original image with background made transparent
    rgba = image.convert("RGBA")
    person = rgba.copy()
    person_arr = np.array(person)
    person_arr[:, :, 3] = mask_np
    person = Image.fromarray(person_arr, "RGBA")

    # Background: original image with person made transparent
    background = rgba.copy()
    bg_arr = np.array(background)
    bg_arr[:, :, 3] = 255 - mask_np
    background = Image.fromarray(bg_arr, "RGBA")

    return {
        "person": _image_to_base64(person),
        "background": _image_to_base64(background),
    }
