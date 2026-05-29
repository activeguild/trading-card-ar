# Remove Background

Upload an image and separate it into person (foreground) and background using U-2-Net human segmentation.

## Setup

### 1. Model

Download `u2net_human_seg.pth` from the [U-2-Net repository](https://github.com/xuebinqin/U-2-Net) and place it in `backend/models/`.

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

1. Drop an image (or click to select) containing a person
2. Wait for processing
3. Download the separated person and background images
