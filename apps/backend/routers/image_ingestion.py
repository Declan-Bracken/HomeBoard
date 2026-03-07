from fastapi import APIRouter, HTTPException, Depends, UploadFile, Form
from fastapi.responses import FileResponse
import json
from db.database import get_db
import services.ingestion_services as i_s
import services.hold_services as h_s
from services import wall_services as ws
from sqlalchemy.orm import Session
from storage.image_storage import upload_image
import os
from db.models import User
from db.schemas import ConfirmHoldsPayload, HoldCreate
from typing import List
from core.dependencies import get_current_user
import base64
from PIL import Image as PILImage, ImageOps
from io import BytesIO

router = APIRouter(prefix="/walls", tags={"Upload Image"})

# @router.post("/{wall_id}/image") # Response should be the original image, and the hold data. In the frontend we can put together/resolve them.
# def ingest_image_endpoint(wall_id: int, image: UploadFile, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
#     try:
#         image_path = upload_image(wall_id, image)
#         n_holds = i_s.ingest_wall_image(wall_id, image_path, current_user, db)
#         # Check if file exists
#         if not os.path.exists(annotated_image_path):
#             raise HTTPException(status_code=404, detail="Annotated image not found")
        
#         db.commit()

#         # Return the image file with hold count in headers
#         return FileResponse(
#             path=annotated_image_path,
#             media_type="image/jpeg",  # Adjust based on your image type
#             headers={
#                 "X-Hold-Count": str(n_holds),
#                 "Content-Disposition": f"inline; filename=wall_{wall_id}_annotated.jpg"
#             }
#         )
    
#     except ValueError as e:
#         db.rollback()
#         raise HTTPException(400, detail = str(e))

@router.post("/{wall_id}/preview")
def preview_image_endpoint(wall_id: int, image: UploadFile, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # Normalize orientation in memory
        pil_image = PILImage.open(image.file)
        pil_image = ImageOps.exif_transpose(pil_image)
        if pil_image.mode != "RGB":
            pil_image = pil_image.convert("RGB")

        buffer = BytesIO()
        pil_image.save(buffer, format="JPEG", quality=90)
        image_bytes = buffer.getvalue()

        # Write normalized bytes to temp file for Roboflow
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp.write(image_bytes)
            tmp_path = tmp.name

        try:
            holds_preview = i_s.preview_wall_image(wall_id, tmp_path, current_user, db)
            with PILImage.open(tmp_path) as img:
                width, height = img.size
        finally:
            os.unlink(tmp_path)

        image_b64 = base64.b64encode(image_bytes).decode("utf-8")

        return {
            "image_b64": image_b64,
            "image_width": width,
            "image_height": height,
            "holds": holds_preview,
        }

    except ValueError as e:
        raise HTTPException(400, detail=str(e))


@router.post("/{wall_id}/confirm-holds")
def confirm_holds_endpoint(
    wall_id: int,
    image: UploadFile,
    holds: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        wall = ws.get_wall(wall_id, db)
        ws.assert_owner(wall, current_user)

        holds_parsed = [HoldCreate(**h) for h in json.loads(holds)]  # adjust schema as needed
        image_key = upload_image(wall_id, image)

        n_holds = i_s.confirm_wall_with_holds(
            wall_id, image_key, holds_parsed, current_user, db
        )

        db.commit()
        return {"image_path": image_key, "holds_created": n_holds}


    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=str(e))
