# Remove Background

Upload an image and separate it into person (foreground) and background using U-2-Net human segmentation.

## Setup

### 1. Model

Download `u2net_human_seg.pth` from the [U-2-Net repository](https://github.com/xuebinqin/U-2-Net) and place it in `backend/models/`.

### 2. Install dependencies

```bash
make setup
```

### 3. Start

```bash
make dev
```

Open http://localhost:5173 in your browser.

## Usage

1. Drop an image (or click to select) containing a person
2. Wait for processing
3. Download the separated person and background images
