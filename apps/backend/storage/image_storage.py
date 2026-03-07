import boto3
import uuid
import os
from io import BytesIO
from PIL import Image, ImageOps
from fastapi import UploadFile
from dotenv import load_dotenv

load_dotenv()

B2_KEY_ID = os.getenv("B2_KEY_ID")
B2_APPLICATION_KEY = os.getenv("B2_APPLICATION_KEY")
B2_BUCKET_NAME = os.getenv("B2_BUCKET_NAME")
B2_ENDPOINT_URL = os.getenv("B2_ENDPOINT_URL")

s3 = boto3.client(
    "s3",
    endpoint_url=B2_ENDPOINT_URL,
    aws_access_key_id=B2_KEY_ID,
    aws_secret_access_key=B2_APPLICATION_KEY,
    config=boto3.session.Config(signature_version="s3v4"),
    region_name="us-east-005",  # match your endpoint region
)

def upload_image(wall_id: int, image: UploadFile) -> str:
    """
    Normalize orientation, convert to JPEG, upload to B2.
    Returns the object key (stored in DB as image_path).
    """
    pil_image = Image.open(image.file)
    pil_image = ImageOps.exif_transpose(pil_image)

    if pil_image.mode != "RGB":
        pil_image = pil_image.convert("RGB")

    buffer = BytesIO()
    pil_image.save(buffer, format="JPEG", quality=90)
    buffer.seek(0)

    file_id = uuid.uuid4().hex
    key = f"walls/{wall_id}/{file_id}.jpg"

    s3.upload_fileobj(
        buffer,
        B2_BUCKET_NAME,
        key,
        ExtraArgs={"ContentType": "image/jpeg"},
    )

    return key


def upload_image_bytes(wall_id: int, image_bytes: bytes) -> str:
    """
    Upload raw bytes (e.g. from cv2.imencode) to B2.
    Returns the object key.
    """
    file_id = uuid.uuid4().hex
    key = f"walls/{wall_id}/{file_id}.jpg"

    s3.upload_fileobj(
        BytesIO(image_bytes),
        B2_BUCKET_NAME,
        key,
        ExtraArgs={"ContentType": "image/jpeg"},
    )

    return key


def download_image(key: str) -> bytes:
    """Download image bytes from B2 by object key."""
    response = s3.get_object(Bucket=B2_BUCKET_NAME, Key=key)
    return response["Body"].read()


def delete_image(key: str):
    """Delete an object from B2. Safe to call even if key doesn't exist."""
    try:
        s3.delete_object(Bucket=B2_BUCKET_NAME, Key=key)
    except Exception:
        pass
