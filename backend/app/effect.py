import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

EFFECT_FPS = 24
EFFECT_DURATION = 3  # seconds
EFFECT_TOTAL_FRAMES = EFFECT_FPS * EFFECT_DURATION
SPEED = 1.5
BORDER_RATIO = 0.04  # 4% of card width for hologram border
GLOW_WIDTH = 0.06  # 6% of card width for outer glow falloff
NEON_INTENSITY = 1.2


def _compute_edge_map(img_arr: np.ndarray) -> np.ndarray:
    """Compute edge strength from card image using luminance differences."""
    gray = np.dot(img_arr[..., :3].astype(np.float32), [0.299, 0.587, 0.114]) / 255.0
    dx = np.zeros_like(gray)
    dy = np.zeros_like(gray)
    dx[:, 1:] = np.abs(gray[:, 1:] - gray[:, :-1])
    dy[1:, :] = np.abs(gray[1:, :] - gray[:-1, :])
    edge = dx + dy
    edge = np.clip((edge - 0.05) / (0.2 - 0.05), 0, 1)
    edge = edge * edge * (3 - 2 * edge)
    return edge


def _compute_edge_distance(h: int, w: int) -> np.ndarray:
    """Normalized distance from each pixel to nearest card edge. 0 at edges, 1 at center."""
    y, x = np.mgrid[0:h, 0:w]
    dx = np.minimum(x, w - 1 - x).astype(np.float32) / w
    dy = np.minimum(y, h - 1 - y).astype(np.float32) / h
    return np.minimum(dx, dy)


def _create_border_mask(w: int, h: int) -> np.ndarray:
    """1.0 in the border region, 0.0 inside."""
    border = int(w * BORDER_RATIO)
    mask = np.ones((h, w), dtype=np.float32)
    mask[border : h - border, border : w - border] = 0.0
    return mask


def _rainbow_color(x_norm: np.ndarray, y_norm: np.ndarray, t: float) -> np.ndarray:
    """Generate rainbow RGB color array from position and time."""
    hue = np.fmod(x_norm * 0.5 + y_norm * 0.3 + t * SPEED * 0.15, 1.0)
    hue = np.clip(hue, 0, 1)
    h6 = hue * 6.0
    hi = h6.astype(int) % 6
    f = h6 - h6.astype(int)
    s, v = 0.8, 1.0
    p = v * (1 - s)
    q = v * (1 - f * s)
    t_val = v * (1 - (1 - f) * s)

    rgb = np.zeros((*hue.shape, 3), dtype=np.float32)
    for i, (r, g, b) in enumerate(
        [(v, t_val, p), (q, v, p), (p, v, t_val), (p, q, v), (t_val, p, v), (v, p, q)]
    ):
        m = hi == i
        rgb[m, 0] = r if isinstance(r, float) else r[m]
        rgb[m, 1] = g if isinstance(g, float) else g[m]
        rgb[m, 2] = b if isinstance(b, float) else b[m]
    return rgb


def _render_frame(
    w: int,
    h: int,
    edge_map: np.ndarray,
    edge_dist: np.ndarray,
    border_mask: np.ndarray,
    frame_index: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Render a single frame: hologram border + neon inside + glow outside."""
    t = frame_index / EFFECT_FPS
    y_norm = np.arange(h, dtype=np.float32)[:, None] / h * np.ones((1, w), dtype=np.float32)
    x_norm = np.arange(w, dtype=np.float32)[None, :] / w * np.ones((h, 1), dtype=np.float32)

    rainbow = _rainbow_color(x_norm, y_norm, t)

    # === 1. HOLOGRAM BORDER (the card frame) ===
    holo_offset = (frame_index / EFFECT_TOTAL_FRAMES) * 2 * np.pi
    diagonal = (x_norm + y_norm) / 2
    holo_shift = np.sin(diagonal * 6.0 + holo_offset) * 0.3 + 0.7
    holo_strength = border_mask * holo_shift

    # === 2. NEON (inside the border - edge-based) ===
    # Only apply inside the border (where border_mask == 0)
    inner_mask = 1.0 - border_mask
    pulse = np.sin(t * SPEED * 3.0) * 0.3 + 0.7
    travel = np.sin(x_norm * 10.0 + y_norm * 8.0 - t * SPEED * 4.0) * 0.3 + 0.7
    neon_strength = edge_map * inner_mask * pulse * travel * NEON_INTENSITY
    # Bloom: blurred edges for soft halo
    edge_blurred = cv2.GaussianBlur(
        (edge_map * inner_mask).astype(np.float32), (0, 0), sigmaX=3
    )
    neon_strength = np.maximum(neon_strength, edge_blurred * 0.4 * pulse)

    # === 3. GLOW (outside the card edges) ===
    glow_strength = np.clip(1.0 - edge_dist / GLOW_WIDTH, 0, 1)
    glow_strength = glow_strength * glow_strength
    glow_pulse = np.sin(t * SPEED * 2.0) * 0.3 + 0.7
    glow_travel = np.sin((x_norm - y_norm) * 4.0 + t * SPEED * 2.5) * 0.5 + 0.5
    glow_strength *= glow_pulse * (0.7 + glow_travel * 0.3) * 0.7

    # === COMBINE (additive) ===
    total_strength = holo_strength + neon_strength + glow_strength
    combined = rainbow * np.clip(total_strength, 0, 1)[..., np.newaxis]
    combined = np.clip(combined, 0, 1)

    alpha = np.clip(total_strength, 0, 1)

    return (combined * 255).astype(np.uint8), (alpha * 255).astype(np.uint8)


def generate_hologram_video(
    card_image_path: Path,
    output_path: Path,
) -> None:
    """Generate hologram border + neon + glow effect video.
    Output is stacked: color on top, alpha mask on bottom.
    """
    card = Image.open(str(card_image_path)).convert("RGB")
    card_arr = np.array(card)
    w, h = card.size

    edge_map = _compute_edge_map(card_arr)
    edge_dist = _compute_edge_distance(h, w)
    border_mask = _create_border_mask(w, h)

    out_w, out_h = w, h * 2

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
        color, alpha = _render_frame(w, h, edge_map, edge_dist, border_mask, i)
        alpha_rgb = np.stack([alpha, alpha, alpha], axis=-1)
        frame = np.vstack([color, alpha_rgb])
        proc.stdin.write(frame.tobytes())

    proc.stdin.close()
    proc.wait()

    if proc.returncode != 0:
        stderr = proc.stderr.read().decode()
        raise RuntimeError(f"ffmpeg failed: {stderr}")
