from fastapi import APIRouter, HTTPException, Depends, UploadFile
from fastapi.responses import FileResponse
from db.database import get_db
import services.ingestion_services as i_s
from sqlalchemy.orm import Session
from storage.image_storage import upload_image
import os

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
