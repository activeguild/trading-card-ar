import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

EFFECT_FPS = 24
EFFECT_DURATION = 3  # seconds
EFFECT_TOTAL_FRAMES = EFFECT_FPS * EFFECT_DURATION
NEON_SPEED = 1.5
GLOW_WIDTH = 0.06  # 6% of card width for outer glow falloff
NEON_INTENSITY = 1.5


def _compute_edge_map(img_arr: np.ndarray) -> np.ndarray:
    """Compute edge strength from card image using luminance differences.
    Based on glbdraco neon shader's edge detection.
    """
    gray = np.dot(img_arr[..., :3].astype(np.float32), [0.299, 0.587, 0.114]) / 255.0
    # 4-neighbor luminance differences
    dx = np.zeros_like(gray)
    dy = np.zeros_like(gray)
    dx[:, 1:] = np.abs(gray[:, 1:] - gray[:, :-1])
    dy[1:, :] = np.abs(gray[1:, :] - gray[:-1, :])
    edge = dx + dy
    # Smoothstep: smoothstep(0.05, 0.2, edge)
    edge = np.clip((edge - 0.05) / (0.2 - 0.05), 0, 1)
    edge = edge * edge * (3 - 2 * edge)  # hermite smoothstep
    return edge


def _compute_edge_distance(h: int, w: int) -> np.ndarray:
    """Compute normalized distance from each pixel to the nearest card edge.
    0.0 at edges, 1.0 at center.
    """
    y, x = np.mgrid[0:h, 0:w]
    dx = np.minimum(x, w - 1 - x).astype(np.float32) / w
    dy = np.minimum(y, h - 1 - y).astype(np.float32) / h
    return np.minimum(dx, dy)


def _hsv_to_rgb_vec(h: np.ndarray, s: float, v: float) -> np.ndarray:
    """Convert hue array (0-1) to RGB array with fixed s,v."""
    h6 = h * 6.0
    hi = h6.astype(int) % 6
    f = h6 - h6.astype(int)
    p = v * (1 - s)
    q = v * (1 - f * s)
    t = v * (1 - (1 - f) * s)

    rgb = np.zeros((*h.shape, 3), dtype=np.float32)
    for i, (r, g, b) in enumerate(
        [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    ):
        mask = hi == i
        rgb[mask, 0] = r if isinstance(r, float) else r[mask]
        rgb[mask, 1] = g if isinstance(g, float) else g[mask]
        rgb[mask, 2] = b if isinstance(b, float) else b[mask]
    return rgb


def _render_frame(
    w: int,
    h: int,
    edge_map: np.ndarray,
    edge_dist: np.ndarray,
    frame_index: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Render a single effect frame with neon (inner) + glow (outer).
    Returns (color_rgb uint8, alpha uint8).
    """
    t = frame_index / EFFECT_FPS  # time in seconds
    y_norm, x_norm = np.mgrid[0:h, 0:w].astype(np.float32)
    y_norm /= h
    x_norm /= w

    # === NEON (inner border - edge-based) ===
    # Pulsating animation
    pulse = np.sin(t * NEON_SPEED * 3.0) * 0.3 + 0.7
    travel = np.sin(x_norm * 10.0 + y_norm * 8.0 - t * NEON_SPEED * 4.0) * 0.3 + 0.7
    neon_strength = edge_map * pulse * travel * NEON_INTENSITY

    # Bloom: blur the edge map for soft halo
    edge_blurred = cv2.GaussianBlur(edge_map.astype(np.float32), (0, 0), sigmaX=3)
    neon_strength = np.maximum(neon_strength, edge_blurred * 0.5 * pulse)

    # Rainbow color cycling (prism mode from glbdraco)
    hue = np.fmod(x_norm * 0.5 + y_norm * 0.3 + t * NEON_SPEED * 0.15, 1.0)
    neon_color = _hsv_to_rgb_vec(hue, 0.8, 1.0)

    # === GLOW (outer edge - distance-based) ===
    glow_strength = np.clip(1.0 - edge_dist / GLOW_WIDTH, 0, 1)
    glow_strength = glow_strength * glow_strength  # quadratic falloff
    # Pulsating glow
    glow_pulse = np.sin(t * NEON_SPEED * 2.0) * 0.3 + 0.7
    glow_travel = (
        np.sin((x_norm - y_norm) * 4.0 + t * NEON_SPEED * 2.5) * 0.5 + 0.5
    )
    glow_strength *= glow_pulse * (0.7 + glow_travel * 0.3) * 0.8

    # Glow uses same rainbow color
    glow_color = neon_color

    # === COMBINE ===
    # Additive blending of neon and glow
    combined = (
        neon_color * neon_strength[..., np.newaxis]
        + glow_color * glow_strength[..., np.newaxis]
    )
    combined = np.clip(combined, 0, 1)

    alpha = np.clip(neon_strength + glow_strength, 0, 1)

    color = (combined * 255).astype(np.uint8)
    alpha_u8 = (alpha * 255).astype(np.uint8)

    return color, alpha_u8


def generate_hologram_video(
    card_image_path: Path,
    output_path: Path,
) -> None:
    """Generate neon + glow effect video.
    Output is a stacked video: color on top, alpha mask on bottom.
    """
    card = Image.open(str(card_image_path)).convert("RGB")
    card_arr = np.array(card)
    w, h = card.size

    # Precompute static maps
    edge_map = _compute_edge_map(card_arr)
    edge_dist = _compute_edge_distance(h, w)

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
        color, alpha = _render_frame(w, h, edge_map, edge_dist, i)
        alpha_rgb = np.stack([alpha, alpha, alpha], axis=-1)
        frame = np.vstack([color, alpha_rgb])
        proc.stdin.write(frame.tobytes())

    proc.stdin.close()
    proc.wait()

    if proc.returncode != 0:
        stderr = proc.stderr.read().decode()
        raise RuntimeError(f"ffmpeg failed: {stderr}")
