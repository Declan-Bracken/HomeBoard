from fastapi import UploadFile
from sqlalchemy.orm import Session
from db.models import Wall, Hold
from ml import segmentation
from ml.helpers import prediction_to_hold
from services.hold_services import create_hold

CONFIDENCE = 10

def ingest_wall_image(wall_id: int, image_path: UploadFile, db: Session):
    # Ensure wall exists
    wall = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall:
        raise ValueError("Wall does not exist")
    
    # Ensure wall's holds are not populated
    existing_holds = db.query(Hold).filter(Hold.wall_id == wall_id).count()
    if existing_holds > 0:
        raise ValueError("Holds already exist for this wall")
    
    predictions = segmentation.run(image_path, CONFIDENCE)
    annotated_image_path = segmentation.annotate(wall_id, image_path, predictions)

    if not predictions:
        raise ValueError("No holds detected")

    holds_created = []
    for pred in predictions["predictions"]:
        hold = prediction_to_hold(pred)
        holds_created.append(create_hold(wall_id, hold, db))
    
    return len(holds_created), annotated_image_path
