from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.model import segment_image

router = APIRouter(prefix="/api")


@router.post("/segment")
async def segment(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        image = Image.open(file.file)
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Cannot read image file")

    result = segment_image(image)
    return result
