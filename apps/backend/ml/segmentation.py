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


# ─── Boundary fragment merging ─────────────────────────────────────────────────

def _bbox_overlap_1d(a_min, a_max, b_min, b_max) -> float:
    """Overlap length of two 1-D intervals."""
    return max(0.0, min(a_max, b_max) - max(a_min, b_min))


def _merge_two(a: dict, b: dict) -> dict:
    """Merge two fragment predictions into one by unioning their bboxes and
    computing the convex hull of their combined polygon points."""
    ax1 = a["x"] - a["width"] / 2
    ay1 = a["y"] - a["height"] / 2
    ax2 = a["x"] + a["width"] / 2
    ay2 = a["y"] + a["height"] / 2
    bx1 = b["x"] - b["width"] / 2
    by1 = b["y"] - b["height"] / 2
    bx2 = b["x"] + b["width"] / 2
    by2 = b["y"] + b["height"] / 2

    mx1, my1 = min(ax1, bx1), min(ay1, by1)
    mx2, my2 = max(ax2, bx2), max(ay2, by2)

    merged = a.copy()
    merged["x"] = (mx1 + mx2) / 2
    merged["y"] = (my1 + my2) / 2
    merged["width"] = mx2 - mx1
    merged["height"] = my2 - my1
    merged["confidence"] = max(a["confidence"], b["confidence"])

    # Merge polygon points via convex hull if both have them
    pts_a = a.get("points", [])
    pts_b = b.get("points", [])
    if pts_a and pts_b:
        all_pts = np.array(
            [[p["x"], p["y"]] for p in pts_a + pts_b], dtype=np.float32
        )
        hull_idx = cv2.convexHull(all_pts, returnPoints=False)
        hull_pts = all_pts[hull_idx.flatten()]
        merged["points"] = [{"x": float(p[0]), "y": float(p[1])} for p in hull_pts]
    elif pts_a or pts_b:
        merged["points"] = pts_a or pts_b

    return merged


def _merge_boundary_fragments(
    predictions: list,
    tile_xs: list,
    tile_ys: list,
    tile_size: int,
    overlap: float,
) -> list:
    """
    For every interior tile boundary, find pairs of predictions that are
    fragments of the same hold split by the boundary, merge them, and return
    the cleaned prediction list.

    A prediction is a candidate fragment near boundary B if its bbox edge
    (the side facing B) is within `snap_px` pixels of B.  Two candidates on
    opposite sides of B are paired when their bboxes overlap along the axis
    parallel to B by at least `min_overlap_frac` of the smaller bbox dimension.
    """
    snap_px = tile_size * overlap          # e.g. 256 px for 1280 * 0.2
    min_overlap_frac = 0.3                 # 30 % along the parallel axis

    preds = list(predictions)
    merged_indices: set = set()

    # Vertical boundaries (between tiles at x = x_off + tile_size for each
    # tile except the last column).  tile_xs gives the left edge of each tile
    # column; the boundary between column i and i+1 is tile_xs[i] + tile_size.
    v_boundaries = [x + tile_size for x in tile_xs[:-1]]
    h_boundaries = [y + tile_size for y in tile_ys[:-1]]

    def _try_merge_axis(boundaries, is_vertical):
        nonlocal preds, merged_indices
        new_preds = []
        used = set()

        for bnd in boundaries:
            # Collect left/top candidates (bbox right/bottom edge near bnd)
            # and right/bottom candidates (bbox left/top edge near bnd)
            left_cands = []   # predictions whose far edge ≈ bnd
            right_cands = []  # predictions whose near edge ≈ bnd

            for i, p in enumerate(preds):
                if i in used:
                    continue
                if is_vertical:
                    far  = p["x"] + p["width"]  / 2   # right edge
                    near = p["x"] - p["width"]  / 2   # left edge
                else:
                    far  = p["y"] + p["height"] / 2   # bottom edge
                    near = p["y"] - p["height"] / 2   # top edge

                if abs(far - bnd) <= snap_px:
                    left_cands.append(i)
                elif abs(near - bnd) <= snap_px:
                    right_cands.append(i)

            # Try to pair each left candidate with the best right candidate
            for li in left_cands:
                if li in used:
                    continue
                lp = preds[li]
                best_ri, best_overlap = None, 0.0

                for ri in right_cands:
                    if ri in used:
                        continue
                    rp = preds[ri]
                    if is_vertical:
                        lmin, lmax = lp["y"] - lp["height"] / 2, lp["y"] + lp["height"] / 2
                        rmin, rmax = rp["y"] - rp["height"] / 2, rp["y"] + rp["height"] / 2
                    else:
                        lmin, lmax = lp["x"] - lp["width"] / 2, lp["x"] + lp["width"] / 2
                        rmin, rmax = rp["x"] - rp["width"] / 2, rp["x"] + rp["width"] / 2

                    ov = _bbox_overlap_1d(lmin, lmax, rmin, rmax)
                    min_dim = min(lmax - lmin, rmax - rmin)
                    if min_dim > 0 and ov / min_dim >= min_overlap_frac and ov > best_overlap:
                        best_overlap = ov
                        best_ri = ri

                if best_ri is not None:
                    used.add(li)
                    used.add(best_ri)
                    new_preds.append(_merge_two(preds[li], preds[best_ri]))

        # Rebuild preds: keep unmerged, append merged
        preds = [p for i, p in enumerate(preds) if i not in used] + new_preds

    _try_merge_axis(v_boundaries, is_vertical=True)
    _try_merge_axis(h_boundaries, is_vertical=False)

    return preds


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

    merged = _merge_boundary_fragments(all_predictions, xs, ys, tile_size, overlap)
    return {"predictions": _nms(merged)}


if __name__ == "__main__":
    image_path = "uploads/walls/1/9634ad00cac548bda9778dc6d77640ef_original.jpg"
    result = run_tiled(image_path, confidence=10)
    print(f"Tiled inference complete — {len(result['predictions'])} holds detected")
