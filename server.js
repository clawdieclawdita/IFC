import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';
import archiver from 'archiver';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DIST_DIR = path.join(__dirname, 'dist');
const TEMP_DIR = path.join(__dirname, 'temp');
const CONVERTED_DIR = path.join(__dirname, 'converted');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_AGE_MS = 1000 * 60 * 60;

const SUPPORTED_FORMATS = new Set(['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'webp', 'gif', 'svg']);
const OUTPUT_EXTENSION_MAP = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  bmp: 'bmp',
  tiff: 'tiff',
  webp: 'webp',
  gif: 'gif',
  svg: 'svg'
};

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function ensureDirectories() {
  await Promise.all([
    fsp.mkdir(TEMP_DIR, { recursive: true }),
    fsp.mkdir(CONVERTED_DIR, { recursive: true }),
    fsp.mkdir(UPLOAD_DIR, { recursive: true })
  ]);
}

async function cleanupOldFiles(dir, maxAgeMs = MAX_FILE_AGE_MS) {
  const now = Date.now();
  let entries = [];

  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to read directory for cleanup: ${dir}`, error);
    }
    return;
  }

  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    try {
      const stats = await fsp.stat(fullPath);
      if (entry.isDirectory()) {
        await cleanupOldFiles(fullPath, maxAgeMs);
        return;
      }
      if (now - stats.mtimeMs > maxAgeMs) {
        await fsp.unlink(fullPath);
        log('Cleaned old file', fullPath);
      }
    } catch (error) {
      console.error(`Failed cleaning ${fullPath}`, error.message);
    }
  }));
}

function normalizeFormat(format) {
  const normalized = String(format || '').trim().toLowerCase();
  return normalized === 'jpeg' ? 'jpg' : normalized;
}

function validateTargetFormat(format) {
  if (!SUPPORTED_FORMATS.has(format)) {
    const supported = [...SUPPORTED_FORMATS].join(', ');
    const error = new Error(`Invalid targetFormat. Supported formats: ${supported}`);
    error.status = 400;
    throw error;
  }
}

function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function makeFileName(originalName, extension) {
  const base = path.parse(originalName || 'image').name.replace(/[^a-zA-Z0-9-_]/g, '_') || 'image';
  const id = crypto.randomUUID();
  return `${base}-${id}.${extension}`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, makeFileName(file.originalname, 'upload'))
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 20 }
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/converted', express.static(CONVERTED_DIR));
app.use('/temp', express.static(TEMP_DIR));

app.get('/health', (_req, res) => {
  res.json({ ok: true, supportedFormats: [...SUPPORTED_FORMATS] });
});

async function convertImageFile(inputPath, originalName, targetFormat) {
  const format = normalizeFormat(targetFormat);
  validateTargetFormat(format);

  const outputExtension = OUTPUT_EXTENSION_MAP[format];
  const outputName = makeFileName(originalName, outputExtension);
  const outputPath = path.join(CONVERTED_DIR, outputName);

  if (format === 'svg') {
    const pngBuffer = await sharp(inputPath).png().toBuffer();
    const metadata = await sharp(pngBuffer).metadata();
    const safeWidth = metadata.width || 512;
    const safeHeight = metadata.height || 512;
    const base64 = pngBuffer.toString('base64');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">\n  <image href="data:image/png;base64,${base64}" width="${safeWidth}" height="${safeHeight}" />\n</svg>\n`;
    await fsp.writeFile(outputPath, svg, 'utf8');
    return outputName;
  }

  let pipeline = sharp(inputPath, { animated: true });

  switch (format) {
    case 'jpg':
      pipeline = pipeline.jpeg({ quality: 90 });
      break;
    case 'png':
      pipeline = pipeline.png();
      break;
    case 'bmp':
      pipeline = pipeline.bmp();
      break;
    case 'tiff':
      pipeline = pipeline.tiff({ quality: 90 });
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality: 90 });
      break;
    case 'gif':
      pipeline = pipeline.gif();
      break;
    default:
      throw new Error(`Unsupported conversion pipeline for format: ${format}`);
  }

  await pipeline.toFile(outputPath);
  return outputName;
}

app.post('/api/convert', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing image file in field "image"' });
    }

    const targetFormat = normalizeFormat(req.body.targetFormat);
    const outputName = await convertImageFile(req.file.path, req.file.originalname, targetFormat);
    const convertedUrl = `${getBaseUrl(req)}/converted/${outputName}`;

    log('Single convert success', { input: req.file.originalname, targetFormat, outputName });
    res.json({ convertedUrl });
  } catch (error) {
    next(error);
  }
});

app.post('/api/convert/batch', upload.any(), async (req, res, next) => {
  try {
    const acceptedFieldNames = new Set(['images', 'files']);
    const files = (req.files || []).filter((file) => acceptedFieldNames.has(file.fieldname));

    if (!files.length) {
      return res.status(400).json({ error: 'Missing image files in field "images" or "files"' });
    }

    const invalidField = (req.files || []).find((file) => !acceptedFieldNames.has(file.fieldname));
    if (invalidField) {
      return res.status(400).json({ error: `Unexpected file field "${invalidField.fieldname}"` });
    }

    const targetFormat = normalizeFormat(req.body.targetFormat);
    const outputNames = await Promise.all(
      files.map((file) => convertImageFile(file.path, file.originalname, targetFormat))
    );

    const convertedUrls = outputNames.map((name) => `${getBaseUrl(req)}/converted/${name}`);
    const responseFiles = outputNames.map((outputName, index) => ({
      originalName: files[index].originalname,
      convertedName: outputName,
      downloadUrl: convertedUrls[index]
    }));

    log('Batch convert success', {
      count: files.length,
      targetFormat,
      fieldNames: [...new Set(files.map((file) => file.fieldname))]
    });
    res.json({ convertedUrls, files: responseFiles });
  } catch (error) {
    next(error);
  }
});

app.post('/api/zip', async (req, res, next) => {
  try {
    const { convertedUrls } = req.body || {};
    if (!Array.isArray(convertedUrls) || convertedUrls.length === 0) {
      return res.status(400).json({ error: 'convertedUrls must be a non-empty array' });
    }

    const zipName = `converted-${crypto.randomUUID()}.zip`;
    const zipPath = path.join(TEMP_DIR, zipName);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);
      archive.pipe(output);

      for (const fileUrl of convertedUrls) {
        const parsed = new URL(fileUrl, getBaseUrl(req));
        const pathname = decodeURIComponent(parsed.pathname);

        if (!pathname.startsWith('/converted/')) {
          const err = new Error(`Invalid converted URL path: ${fileUrl}`);
          err.status = 400;
          throw err;
        }

        const fileName = path.basename(pathname);
        const filePath = path.join(CONVERTED_DIR, fileName);

        if (!fs.existsSync(filePath)) {
          const err = new Error(`Converted file not found: ${fileName}`);
          err.status = 404;
          throw err;
        }

        archive.file(filePath, { name: fileName });
      }

      archive.finalize().catch(reject);
    });

    const zipUrl = `${getBaseUrl(req)}/temp/${zipName}`;
    log('ZIP created', { zipName, fileCount: convertedUrls.length });
    res.json({ zipUrl });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(DIST_DIR));

app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message });
  }

  const status = error.status || 500;
  console.error('Request failed:', error);
  res.status(status).json({ error: error.message || 'Internal server error' });
});

async function startup() {
  await ensureDirectories();
  await Promise.all([
    cleanupOldFiles(TEMP_DIR),
    cleanupOldFiles(CONVERTED_DIR),
    cleanupOldFiles(UPLOAD_DIR)
  ]);

  setInterval(() => {
    cleanupOldFiles(TEMP_DIR).catch((error) => console.error('Cleanup temp failed', error));
    cleanupOldFiles(CONVERTED_DIR).catch((error) => console.error('Cleanup converted failed', error));
    cleanupOldFiles(UPLOAD_DIR).catch((error) => console.error('Cleanup uploads failed', error));
  }, 15 * 60 * 1000).unref();

  app.listen(PORT, HOST, () => {
    log(`Image converter API listening on http://${HOST}:${PORT}`);
    log(`Serving frontend from ${DIST_DIR}`);
    log(`Serving converted files from ${CONVERTED_DIR}`);
    log(`Serving zip files from ${TEMP_DIR}`);
    log(`Supported formats: ${[...SUPPORTED_FORMATS].join(', ')}`);
  });
}

startup().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
