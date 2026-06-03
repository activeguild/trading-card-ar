import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

EFFECT_FPS = 24
EFFECT_DURATION = 8  # seconds
EFFECT_TOTAL_FRAMES = EFFECT_FPS * EFFECT_DURATION
SPEED = 0.7
BORDER_RATIO = 0.04  # 4% of card width for hologram border
GLOW_WIDTH = 0.06  # 6% of card width for outer glow falloff
GLOW_PADDING_RATIO = 0.05  # 5% padding on each side for outer glow
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


def _compute_edge_distance(
    th: int, tw: int, ch: int, cw: int, pad_x: int, pad_y: int
) -> np.ndarray:
    """Distance from each pixel to nearest card edge on the padded canvas.
    Outside the card: Euclidean distance to card boundary / cw.
    Inside the card: min distance to edge / cw.
    """
    y, x = np.mgrid[0:th, 0:tw]
    cx = x - pad_x
    cy = y - pad_y

    inside = (cx >= 0) & (cx < cw) & (cy >= 0) & (cy < ch)

    # Inside: min distance to card edge
    dx_in = np.minimum(cx, cw - 1 - cx).astype(np.float32)
    dy_in = np.minimum(cy, ch - 1 - cy).astype(np.float32)
    dist_inside = np.minimum(dx_in, dy_in) / cw

    # Outside: Euclidean distance to card boundary
    dx_out = np.where(cx < 0, -cx, np.where(cx >= cw, cx - cw + 1, 0)).astype(np.float32)
    dy_out = np.where(cy < 0, -cy, np.where(cy >= ch, cy - ch + 1, 0)).astype(np.float32)
    dist_outside = np.sqrt(dx_out**2 + dy_out**2) / cw

    return np.where(inside, dist_inside, dist_outside)


def _create_border_mask(
    th: int, tw: int, ch: int, cw: int, pad_x: int, pad_y: int
) -> np.ndarray:
    """1.0 in the border region of the card on the padded canvas, 0.0 elsewhere."""
    border = int(cw * BORDER_RATIO)
    mask = np.zeros((th, tw), dtype=np.float32)
    # Fill card area with 1
    mask[pad_y : pad_y + ch, pad_x : pad_x + cw] = 1.0
    # Clear inner area
    mask[pad_y + border : pad_y + ch - border, pad_x + border : pad_x + cw - border] = 0.0
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
    tw: int,
    th: int,
    cw: int,
    ch: int,
    pad_x: int,
    pad_y: int,
    edge_map_padded: np.ndarray,
    edge_dist: np.ndarray,
    border_mask: np.ndarray,
    frame_index: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Render a single frame on padded canvas: hologram border + neon inside + glow outside."""
    t = frame_index / EFFECT_FPS
    y_norm = np.arange(th, dtype=np.float32)[:, None] / th * np.ones((1, tw), dtype=np.float32)
    x_norm = np.arange(tw, dtype=np.float32)[None, :] / tw * np.ones((th, 1), dtype=np.float32)

    rainbow = _rainbow_color(x_norm, y_norm, t)

    # Card area mask on padded canvas
    card_mask = np.zeros((th, tw), dtype=np.float32)
    card_mask[pad_y : pad_y + ch, pad_x : pad_x + cw] = 1.0

    # === 1. HOLOGRAM BORDER (the card frame) ===
    holo_offset = (frame_index / EFFECT_TOTAL_FRAMES) * 2 * np.pi
    diagonal = (x_norm + y_norm) / 2
    holo_shift = np.sin(diagonal * 6.0 + holo_offset) * 0.3 + 0.7
    holo_strength = border_mask * holo_shift

    # === 2. NEON (inside the border - edge-based) ===
    inner_mask = card_mask * (1.0 - border_mask)
    pulse = np.sin(t * SPEED * 3.0) * 0.3 + 0.7
    travel = np.sin(x_norm * 10.0 + y_norm * 8.0 - t * SPEED * 4.0) * 0.3 + 0.7
    neon_strength = edge_map_padded * inner_mask * pulse * travel * NEON_INTENSITY
    edge_blurred = cv2.GaussianBlur(
        (edge_map_padded * inner_mask).astype(np.float32), (0, 0), sigmaX=3
    )
    neon_strength = np.maximum(neon_strength, edge_blurred * 0.4 * pulse)

    # === 3. GLOW (outside the card) ===
    outside_mask = 1.0 - card_mask
    glow_raw = np.clip(1.0 - edge_dist / GLOW_WIDTH, 0, 1)
    glow_strength = np.sqrt(glow_raw) * outside_mask  # sqrt falloff for softer, brighter glow
    glow_pulse = np.sin(t * SPEED * 2.0) * 0.2 + 0.8
    glow_travel = np.sin((x_norm - y_norm) * 4.0 + t * SPEED * 2.5) * 0.3 + 0.7
    glow_strength *= glow_pulse * glow_travel * 1.5

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
    cw, ch = card.size

    # Add padding for glow
    pad_x = round(cw * GLOW_PADDING_RATIO)
    pad_y = round(ch * GLOW_PADDING_RATIO)
    tw = cw + pad_x * 2
    th = ch + pad_y * 2

    edge_map = _compute_edge_map(card_arr)
    # Place edge_map on padded canvas
    edge_map_padded = np.zeros((th, tw), dtype=np.float32)
    edge_map_padded[pad_y : pad_y + ch, pad_x : pad_x + cw] = edge_map

    edge_dist = _compute_edge_distance(th, tw, ch, cw, pad_x, pad_y)
    border_mask = _create_border_mask(th, tw, ch, cw, pad_x, pad_y)

    out_w, out_h = tw, th * 2

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
        color, alpha = _render_frame(tw, th, cw, ch, pad_x, pad_y, edge_map_padded, edge_dist, border_mask, i)
        alpha_rgb = np.stack([alpha, alpha, alpha], axis=-1)
        frame = np.vstack([color, alpha_rgb])
        proc.stdin.write(frame.tobytes())

    proc.stdin.close()
    proc.wait()

    if proc.returncode != 0:
        stderr = proc.stderr.read().decode()
        raise RuntimeError(f"ffmpeg failed: {stderr}")
