from pathlib import Path
from fastapi import UploadFile
from PIL import Image, ImageOps
import uuid

def upload_image(wall_id: int, image: UploadFile, suffix: str = "original"):
    upload_dir = Path(f"uploads/walls/{wall_id}")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    file_id = uuid.uuid4().hex
    filename = f"{file_id}_{suffix}.jpg"
    file_path = upload_dir / filename

    # Open with PIL direc tly from UploadFile
    pil_image = Image.open(image.file)

    # Normalize orientation here
    pil_image = ImageOps.exif_transpose(pil_image)

    # Save normalized version only
    pil_image.save(file_path, format="JPEG")

    return str(file_path)


