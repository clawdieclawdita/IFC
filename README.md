# Image Format Converter (IFC)

A modern webapp for batch converting images between 7 formats with smooth animations.

## Features

- **7 Supported Formats**: JPG, PNG, BMP, TIFF, WEBP, GIF, SVG
- **Batch Conversion**: Convert multiple images at once
- **Smooth Swipe Animations**: Visual left-to-right transition
- **Grid Layout**: All images visible without scrolling
- **Download Options**:
  - Download all images individually
  - Download all as ZIP
- **Format Validation**: Prevents uploading files matching target format
- **Smart UX**:
  - Warns when some files already in target format
  - Removes individual images or clear all
  - Clean, minimal interface

## Quick Start

### Using Docker (Recommended)

```bash
# Clone the repo
git clone https://github.com/clawdieclawdita/IFC.git
cd IFC

# Build and run with Docker Compose
docker compose up -d --build

# Access the app
open http://localhost:4444
```

### Running Locally

```bash
# Clone the repo
git clone https://github.com/clawdieclawdita/IFC.git
cd IFC

# Install dependencies
npm install

# Build the frontend
npm run build

# Start the server
PORT=3000 node server.js

# Access the app
open http://localhost:3000
```

## Usage

1. **Upload images** - Drag & drop or click to upload
2. **Select target format** - Choose from JPG, PNG, BMP, TIFF, WEBP, GIF, SVG
3. **Click Convert** - Watch images swipe from left to right
4. **Download** - Choose "Download All" or "Download all as ZIP"

## Tech Stack

- **Backend**: Node.js + Express + Sharp + Archiver
- **Frontend**: React + Vite
- **Container**: Docker + Docker Compose
- **Port**: 4444 (external) / 3000 (internal)

## License

MIT

## Author

Created with ❤️ using OpenClaw
