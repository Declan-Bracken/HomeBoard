from dotenv import load_dotenv
import numpy as np
import cv2
import os
import tempfile
from roboflow import Roboflow
from pathlib import Path

load_dotenv()
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
BORDER_COLOR = (0, 165, 255)  # BGR soft blue

# Tiled inference settings
TILE_SIZE = 1280       # px — 2× the typical YOLO input; holds appear ~2× larger per tile
TILE_OVERLAP = 0.2     # fraction of tile_size shared between adjacent tiles
NMS_IOU_THRESHOLD = 0.5

# ─── Model (cached singleton) ──────────────────────────────────────────────────

_MODEL = None

def load_model():
    global _MODEL
    if _MODEL is None:
        rf = Roboflow(api_key=ROBOFLOW_API_KEY)
        project = rf.workspace().project("hold-detector-rnvkl")
        _MODEL = project.version(2).model
    return _MODEL


# ─── Tiling helpers ────────────────────────────────────────────────────────────

def _tile_starts(dim: int, tile_size: int, stride: int) -> list:
    """Return sorted, deduplicated tile start positions along one axis.
    The last position is always snapped so the tile ends exactly at `dim`."""
    if dim <= tile_size:
        return [0]
    starts = list(range(0, dim - tile_size, stride))
    starts.append(dim - tile_size)   # guarantee full edge coverage
    return sorted(set(starts))


def _offset_prediction(pred: dict, x_off: int, y_off: int) -> dict:
    """Translate a single prediction from tile-space to full-image space."""
    p = pred.copy()
    p["x"] = pred["x"] + x_off
    p["y"] = pred["y"] + y_off
    if "points" in p:
        p["points"] = [
            {"x": pt["x"] + x_off, "y": pt["y"] + y_off}
            for pt in p["points"]
        ]
    return p


# ─── NMS ───────────────────────────────────────────────────────────────────────

def _bbox_iou(a: dict, b: dict) -> float:
    """Bounding-box IoU between two predictions (x/y are box centres)."""
    ax1, ay1 = a["x"] - a["width"] / 2, a["y"] - a["height"] / 2
    ax2, ay2 = a["x"] + a["width"] / 2, a["y"] + a["height"] / 2
    bx1, by1 = b["x"] - b["width"] / 2, b["y"] - b["height"] / 2
    bx2, by2 = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2

    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0

    inter = (ix2 - ix1) * (iy2 - iy1)
    union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / union if union > 0 else 0.0


def _nms(predictions: list, iou_threshold: float = NMS_IOU_THRESHOLD) -> list:
    """Greedy NMS: keep highest-confidence box, suppress overlapping ones."""
    preds = sorted(predictions, key=lambda p: p["confidence"], reverse=True)
    kept = []
    while preds:
        best = preds.pop(0)
        kept.append(best)
        preds = [p for p in preds if _bbox_iou(best, p) < iou_threshold]
    return kept


# ─── Inference entry points ────────────────────────────────────────────────────

def run(image_path: str, confidence: int, model=None) -> dict:
    if model is None:
        model = load_model()
    return model.predict(image_path, confidence=confidence).json()


def run_tiled(image_path: str, confidence: int,
              tile_size: int = TILE_SIZE,
              overlap: float = TILE_OVERLAP) -> dict:
    """
    Tile the input image, run inference on each tile, map detections back to
    full-image coordinates, and deduplicate with NMS.

    Falls back to a single run() call when the image already fits in one tile.
    """
    model = load_model()

    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")

    img_h, img_w = img.shape[:2]

    # No tiling needed for small images
    if img_w <= tile_size and img_h <= tile_size:
        return run(image_path, confidence, model)

    stride = max(1, int(tile_size * (1 - overlap)))
    xs = _tile_starts(img_w, tile_size, stride)
    ys = _tile_starts(img_h, tile_size, stride)

    all_predictions = []

    for y_off in ys:
        for x_off in xs:
            tile = img[y_off: y_off + tile_size, x_off: x_off + tile_size]

            # Write tile to a temp file for the Roboflow SDK
            tmp_fd, tmp_path = tempfile.mkstemp(suffix=".jpg")
            os.close(tmp_fd)
            try:
                cv2.imwrite(tmp_path, tile)
                tile_result = model.predict(tmp_path, confidence=confidence).json()
            finally:
                os.unlink(tmp_path)

            for pred in tile_result.get("predictions", []):
                all_predictions.append(_offset_prediction(pred, x_off, y_off))

    return {"predictions": _nms(all_predictions)}


if __name__ == "__main__":
    image_path = "uploads/walls/1/9634ad00cac548bda9778dc6d77640ef_original.jpg"
    result = run_tiled(image_path, confidence=10)
    print(f"Tiled inference complete — {len(result['predictions'])} holds detected")
