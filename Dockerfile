FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN python -m pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ backend/
COPY Data/ Data/
COPY frontend/ frontend/

WORKDIR /app/backend
USER 10001
EXPOSE 8080
CMD ["sh", "-c", "exec waitress-serve --listen=0.0.0.0:${PORT:-8080} --threads=4 main:app"]
