from fastapi import UploadFile
from sqlalchemy.orm import Session
from db.models import Wall, Hold, User
from ml import segmentation
from ml.helpers import prediction_to_hold
from services.hold_services import create_hold
import services.wall_services as ws
CONFIDENCE = 10

def preview_wall_image(wall_id: int, image_path: str, user: User, db: Session):
    wall = ws.get_wall(wall_id, db)
    ws.assert_owner(wall, user)

    existing_holds = db.query(Hold).filter(Hold.wall_id == wall_id).count()
    if existing_holds > 0:
        raise ValueError("Holds already exist for this wall")

    predictions = segmentation.run(image_path, CONFIDENCE)
    if not predictions:
        raise ValueError("No holds detected")

    # Convert predictions to hold dicts without committing
    holds_preview = [prediction_to_hold(pred).model_dump() for pred in predictions["predictions"]]

    return holds_preview

def ingest_wall_image(wall_id: int, image_path: UploadFile, user: User, db: Session):
    # Ensure wall exists
    wall = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall:
        raise ValueError("Wall does not exist")
    
    # Ensure wall's holds are not populated
    existing_holds = db.query(Hold).filter(Hold.wall_id == wall_id).count()
    if existing_holds > 0:
        raise ValueError("Holds already exist for this wall")
    
    predictions = segmentation.run(image_path, CONFIDENCE)
    # annotated_image_path = segmentation.annotate(wall_id, image_path, predictions)

    if not predictions:
        raise ValueError("No holds detected")

    holds_created = []
    for pred in predictions["predictions"]:
        hold = prediction_to_hold(pred)
        holds_created.append(create_hold(wall_id, hold, user, db))
    
    return len(holds_created)#, annotated_image_path

def confirm_wall_with_holds(wall_id: int, image_path: str, holds, user: User, db: Session):
    # Update wall image path
    wall = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall:
        raise ValueError("Wall not found")
    wall.image_path = image_path

    for hold_data in holds:
        create_hold(wall_id, hold_data, user, db)
    return len(holds)
