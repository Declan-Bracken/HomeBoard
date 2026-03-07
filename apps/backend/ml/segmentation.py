from dotenv import load_dotenv
import numpy as np
import cv2
import os
from roboflow import Roboflow
from pathlib import Path

load_dotenv()
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
BORDER_COLOR = (0, 165, 255)  # BGR soft blue

def load_model():
    rf = Roboflow(api_key=ROBOFLOW_API_KEY)
    project = rf.workspace().project("hold-detector-rnvkl")
    model = project.version(2).model
    return model

# def annotate(wall_id, image_path, result):
#     image = cv2.imread(image_path)
#     h, w = image.shape[:2]

#     # Create darkened background
#     darkened = (image * 0.35).astype(np.uint8)

#     # Create empty mask
#     mask = np.zeros((h, w), dtype=np.uint8)

#     # Draw filled polygons on mask
#     for pred in result["predictions"]:
#         points = np.array(
#             [[int(p["x"]), int(p["y"])] for p in pred["points"]],
#             dtype=np.int32
#         )
#         cv2.fillPoly(mask, [points], 255)

#     # Blend original image only where mask == 255
#     spotlight = np.where(mask[:, :, None] == 255, image, darkened)

#     # Draw thick borders
#     THICKNESS = 4

#     for pred in result["predictions"]:
#         points = np.array(
#             [[int(p["x"]), int(p["y"])] for p in pred["points"]],
#             dtype=np.int32
#         )
#         cv2.polylines(
#             spotlight,
#             [points],
#             isClosed=True,
#             color=BORDER_COLOR,
#             thickness=THICKNESS
#         )

#     # Save image
#     upload_dir = Path(f"uploads/walls/{wall_id}")
#     upload_dir.mkdir(parents=True, exist_ok=True)

#     original_image_name = Path(image_path).name.split("_")[0]
#     file_path = upload_dir / f"{original_image_name}_annotated.jpg"
#     cv2.imwrite(str(file_path), spotlight)

#     return file_path

def run(image_path, confidence, model = load_model()):
    result = model.predict(image_path, confidence=confidence).json()
    return result

if __name__ == "__main__":
    image_path = "uploads/walls/1/9634ad00cac548bda9778dc6d77640ef_original.jpg"
    result = run(image_path, confidence = 10)
    print("Image Segmented")
    # annotate(1, image_path, result)
    # print("Image Annotated")
