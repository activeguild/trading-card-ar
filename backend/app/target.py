import json
import subprocess
from pathlib import Path

SCRIPT_PATH = Path(__file__).resolve().parent.parent / "scripts" / "generate-target.mjs"


def generate_image_target(
    corrected_path: Path,
    target_dir: Path,
    name: str,
) -> str:
    """Generate 8thwall-compatible image target using the official CLI library."""
    result = subprocess.run(
        ["node", str(SCRIPT_PATH), str(corrected_path), str(target_dir), name],
        capture_output=True,
        text=True,
        cwd=str(SCRIPT_PATH.parent.parent),
    )
    if result.returncode != 0:
        raise RuntimeError(f"Target generation failed: {result.stderr}")

    return f"{name}.json"
