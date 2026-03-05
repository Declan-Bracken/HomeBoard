from fastapi import APIRouter, HTTPException, Depends, UploadFile
from fastapi.responses import FileResponse
from db.database import get_db
import services.ingestion_services as i_s
import services.hold_services as h_s
from sqlalchemy.orm import Session
from storage.image_storage import upload_image
import os
from db.models import User
from db.schemas import ConfirmHoldsPayload
from typing import List
from core.dependencies import get_current_user
import base64
from PIL import Image as PILImage

router = APIRouter(prefix="/walls", tags={"Upload Image"})

@router.post("/{wall_id}/image") # Response should be the original image, and the hold data. In the frontend we can put together/resolve them.
def ingest_image_endpoint(wall_id: int, image: UploadFile, db: Session = Depends(get_db)):
    try:
        image_path = upload_image(wall_id, image)
        n_holds, annotated_image_path = i_s.ingest_wall_image(wall_id, image_path, db)
        # Check if file exists
        if not os.path.exists(annotated_image_path):
            raise HTTPException(status_code=404, detail="Annotated image not found")
        
        db.commit()

        # Return the image file with hold count in headers
        return FileResponse(
            path=annotated_image_path,
            media_type="image/jpeg",  # Adjust based on your image type
            headers={
                "X-Hold-Count": str(n_holds),
                "Content-Disposition": f"inline; filename=wall_{wall_id}_annotated.jpg"
            }
        )
    
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, detail = str(e))

@router.post("/{wall_id}/preview")
def preview_image_endpoint(wall_id: int, image: UploadFile, db: Session = Depends(get_db)):
    try:
        image_path = upload_image(wall_id, image)
        holds_preview = i_s.preview_wall_image(wall_id, image_path, db)

        # Read image and return as base64 alongside hold polygons
        with open(image_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode("utf-8")

        # Get dimensions
        with PILImage.open(image_path) as img:
            width, height = img.size

        return {
            "image_b64": image_b64,
            "image_path": image_path,
            "image_width": width,
            "image_height": height,
            "holds": holds_preview
}

    except ValueError as e:
        raise HTTPException(400, detail=str(e))


@router.post("/{wall_id}/confirm-holds")
def confirm_holds_endpoint(
    wall_id: int,
    payload: ConfirmHoldsPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        n_holds = i_s.confirm_wall_with_holds(wall_id, payload.image_path, payload.holds , db)
        db.commit()
        return {"committed": n_holds}

    except Exception as e:
        db.rollback()
        raise HTTPException(400, detail=str(e))
