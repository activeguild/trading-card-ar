import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


EFFECT_FPS = 24
EFFECT_DURATION = 3  # seconds
EFFECT_TOTAL_FRAMES = EFFECT_FPS * EFFECT_DURATION
BORDER_RATIO = 0.04  # 4% of card width as border thickness


def _create_border_mask(w: int, h: int) -> np.ndarray:
    """Create a mask where the card's border region is white (255) and interior is black (0)."""
    border = int(w * BORDER_RATIO)
    mask = np.zeros((h, w), dtype=np.uint8)
    # Fill entire mask with white
    mask[:] = 255
    # Cut out the interior (set to black)
    mask[border : h - border, border : w - border] = 0
    return mask


def _render_hologram_frame(
    w: int, h: int, border_mask: np.ndarray, frame_index: int
) -> tuple[np.ndarray, np.ndarray]:
    """Render a single hologram frame.
    Returns (color_rgb array, alpha_mask array) both shape (h, w, 3) and (h, w) respectively.
    """
    # Create rainbow gradient that shifts with frame_index
    hue_offset = (frame_index / EFFECT_TOTAL_FRAMES) * 360
    # Create a diagonal gradient across the card
    y_coords, x_coords = np.mgrid[0:h, 0:w]
    diagonal = (x_coords / w + y_coords / h) / 2  # 0..1 diagonal
    hue = ((diagonal * 360 + hue_offset) % 360).astype(np.float32)
    saturation = np.full((h, w), 0.7, dtype=np.float32)
    value = np.full((h, w), 1.0, dtype=np.float32)

    # Convert HSV to RGB
    hsv = np.stack([hue, saturation, value], axis=-1).astype(np.float32)
    # Manual HSV to RGB conversion
    h_i = (hsv[..., 0] / 60).astype(int) % 6
    f = hsv[..., 0] / 60 - (hsv[..., 0] / 60).astype(int)
    p = hsv[..., 2] * (1 - hsv[..., 1])
    q = hsv[..., 2] * (1 - f * hsv[..., 1])
    t = hsv[..., 2] * (1 - (1 - f) * hsv[..., 1])
    v = hsv[..., 2]

    rgb = np.zeros((h, w, 3), dtype=np.float32)
    for i, (r, g, b) in enumerate(
        [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    ):
        mask = h_i == i
        rgb[mask, 0] = r[mask]
        rgb[mask, 1] = g[mask]
        rgb[mask, 2] = b[mask]

    color = (rgb * 255).astype(np.uint8)
    # Apply border mask: only show color in border region
    color[border_mask == 0] = 0

    return color, border_mask


def generate_hologram_video(
    card_image_path: Path,
    output_path: Path,
) -> None:
    """Generate a hologram border effect video.
    Output is a stacked video: color on top, alpha mask on bottom.
    """
    card = Image.open(str(card_image_path))
    w, h = card.size
    border_mask = _create_border_mask(w, h)

    # Output dimensions: same width, double height (color + mask stacked)
    out_w, out_h = w, h * 2

    # Use ffmpeg with pipe input
    cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-pix_fmt", "rgb24",
        "-s", f"{out_w}x{out_h}",
        "-r", str(EFFECT_FPS),
        "-i", "pipe:0",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "23",
        str(output_path),
    ]

    output_path.parent.mkdir(parents=True, exist_ok=True)

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

    for i in range(EFFECT_TOTAL_FRAMES):
        color, alpha = _render_hologram_frame(w, h, border_mask, i)
        # Convert alpha mask to 3-channel for stacking
        alpha_rgb = np.stack([alpha, alpha, alpha], axis=-1)
        # Stack: color on top, mask on bottom
        frame = np.vstack([color, alpha_rgb])
        proc.stdin.write(frame.tobytes())

    proc.stdin.close()
    proc.wait()

    if proc.returncode != 0:
        stderr = proc.stderr.read().decode()
        raise RuntimeError(f"ffmpeg failed: {stderr}")
