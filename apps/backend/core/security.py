from datetime import datetime, timedelta, timezone
import hashlib
import jwt
from jwt.exceptions import InvalidTokenError
from dotenv import load_dotenv
import os
import bcrypt

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")  # use openssl rand -hex 32
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

def _prehash(password: str) -> bytes:
    return hashlib.sha256(password.encode()).digest()  # 32 bytes, not hexdigest

def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(_prehash(plain), hashed.encode())

def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except InvalidTokenError:
        return None
