FROM python:3.12-slim

# Install system dependencies needed by cv2 headless and psycopg2
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Install everything except opencv, then force headless at the end
RUN pip install --no-cache-dir -r requirements.txt --ignore-installed opencv-python || true
RUN pip uninstall -y opencv-python opencv-python-headless || true
RUN pip install --no-cache-dir opencv-python-headless==4.10.0.84

# Debug: verify cv2 is installed
RUN python -c "import cv2; print('cv2 OK:', cv2.__version__)"

COPY . .

RUN rm -rf .venv

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
