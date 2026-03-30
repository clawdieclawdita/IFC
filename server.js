import express from 'express';
import cors from 'cors';
import multer from 'multer';
import sharp from 'sharp';
import bmp from 'bmp-js';
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
const QUALITY_FORMATS = new Set(['jpg', 'webp']);

const SUPPORTED_FORMATS = new Set(['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'webp', 'gif', 'svg']);
const BMP_MIME_TYPES = new Set(['image/bmp', 'image/x-bmp', 'image/x-ms-bmp']);
const BMP_SIGNATURE = Buffer.from('424d', 'hex');
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

async function clearDirectory(dir) {
  let entries = [];

  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to read directory for clear: ${dir}`, error);
    }
    return 0;
  }

  let clearedCount = 0;

  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        await fsp.rm(fullPath, { recursive: true, force: true });
      } else {
        await fsp.unlink(fullPath);
      }
      clearedCount += 1;
    } catch (error) {
      console.error(`Failed clearing ${fullPath}`, error.message);
    }
  }));

  return clearedCount;
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

function detectInputFormat({ originalName, mimeType, filePath, headerBuffer }) {
  const extension = normalizeFormat(path.extname(originalName || filePath || '').slice(1));
  const mime = String(mimeType || '').trim().toLowerCase();
  const signature = headerBuffer?.subarray(0, 2);

  if (signature && signature.equals(BMP_SIGNATURE)) {
    return 'bmp';
  }

  if (BMP_MIME_TYPES.has(mime)) {
    return 'bmp';
  }

  return extension || 'unknown';
}

function isUnsupportedImageFormatError(error) {
  return /unsupported image format/i.test(error?.message || '');
}

async function loadImagePipelineSource(file) {
  const headerBuffer = await fsp.readFile(file.path);
  const detectedFormat = detectInputFormat({
    originalName: file.originalname,
    mimeType: file.mimetype,
    filePath: file.path,
    headerBuffer
  });

  log('Detected upload format', {
    originalName: file.originalname,
    mimeType: file.mimetype,
    detectedFormat,
    sharpBmpInputSupported: Boolean(sharp.format?.bmp?.input?.file)
  });

  try {
    await sharp(file.path, { animated: true }).metadata();
    return { sharpInput: file.path, detectedFormat, usedBmpFallback: false };
  } catch (error) {
    if (!(detectedFormat === 'bmp' && isUnsupportedImageFormatError(error))) {
      throw error;
    }

    const decoded = bmp.decode(headerBuffer);
    log('Using BMP decode fallback for Sharp input', {
      originalName: file.originalname,
      width: decoded.width,
      height: decoded.height,
      mimeType: file.mimetype
    });

    return {
      sharpInput: {
        raw: {
          width: decoded.width,
          height: decoded.height,
          channels: 4
        },
        data: decoded.data
      },
      detectedFormat,
      usedBmpFallback: true
    };
  }
}

function createSharpPipeline(sharpInput) {
  return sharp(
    sharpInput.raw ? sharpInput.data : sharpInput,
    sharpInput.raw ? { raw: sharpInput.raw } : { animated: true }
  );
}

function makeFileName(originalName, extension) {
  const base = path.parse(originalName || 'image').name.replace(/[^a-zA-Z0-9-_]/g, '_') || 'image';
  const id = crypto.randomUUID();
  return `${base}-${id}.${extension}`;
}

function parseOptionalNumber(value, label) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    const error = new Error(`${label} must be a number`);
    error.status = 400;
    throw error;
  }
  return Math.round(numeric);
}

function parseOptionalBoolean(value, fallback = true) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true';
}

function parseConvertOptions(body = {}, targetFormat) {
  const quality = parseOptionalNumber(body.quality, 'quality');
  const width = parseOptionalNumber(body.width, 'width');
  const height = parseOptionalNumber(body.height, 'height');
  const keepAspectRatio = parseOptionalBoolean(body.keepAspectRatio, true);
  const stripMetadata = parseOptionalBoolean(body.stripMetadata, false);

  if (quality != null && (quality < 0 || quality > 100)) {
    const error = new Error('quality must be between 0 and 100');
    error.status = 400;
    throw error;
  }

  for (const [label, value] of [['width', width], ['height', height]]) {
    if (value != null && (value < 1 || value > 4000)) {
      const error = new Error(`${label} must be between 1 and 4000`);
      error.status = 400;
      throw error;
    }
  }

  return {
    quality: QUALITY_FORMATS.has(targetFormat) ? (quality ?? 85) : null,
    width,
    height,
    keepAspectRatio,
    stripMetadata,
  };
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

async function convertImageFile(file, targetFormat, options = {}) {
  const format = normalizeFormat(targetFormat);
  validateTargetFormat(format);

  const outputExtension = OUTPUT_EXTENSION_MAP[format];
  const outputName = makeFileName(file.originalname, outputExtension);
  const outputPath = path.join(CONVERTED_DIR, outputName);
  const { sharpInput, detectedFormat, usedBmpFallback } = await loadImagePipelineSource(file);
  const {
    quality = null,
    width = null,
    height = null,
    keepAspectRatio = true,
    stripMetadata = false,
  } = options;
  const metadata = await createSharpPipeline(sharpInput).metadata();
  const originalWidth = metadata.width || null;
  const originalHeight = metadata.height || null;

  if ((width != null && originalWidth && width > originalWidth) || (height != null && originalHeight && height > originalHeight)) {
    const error = new Error('Cannot upscale images above original resolution');
    error.status = 400;
    log('Rejected upscale request', {
      originalName: file.originalname,
      detectedFormat,
      requestedWidth: width,
      requestedHeight: height,
      originalWidth,
      originalHeight,
    });
    throw error;
  }

  const metadataSummary = {
    hasExif: Boolean(metadata.exif),
    hasIptc: Boolean(metadata.iptc),
    hasXmp: Boolean(metadata.xmp),
    hasIcc: Boolean(metadata.icc),
  };

  if (format === 'svg') {
    let svgPipeline = createSharpPipeline(sharpInput);
    if (width || height) {
      svgPipeline = svgPipeline.resize({ width: width || null, height: height || null, fit: 'inside', withoutEnlargement: true });
    }
    const pngBuffer = await svgPipeline.png().toBuffer();
    const metadata = await sharp(pngBuffer).metadata();
    const safeWidth = metadata.width || 512;
    const safeHeight = metadata.height || 512;
    const base64 = pngBuffer.toString('base64');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">\n  <image href="data:image/png;base64,${base64}" width="${safeWidth}" height="${safeHeight}" />\n</svg>\n`;
    await fsp.writeFile(outputPath, svg, 'utf8');
    log('Image conversion completed', { originalName: file.originalname, detectedFormat, targetFormat: format, outputName, usedBmpFallback, quality, width, height, keepAspectRatio, stripMetadata, originalWidth, originalHeight, metadataSummary });
    return outputName;
  }

  let pipeline = createSharpPipeline(sharpInput);

  if (width || height) {
    pipeline = pipeline.resize({
      width: width || null,
      height: height || null,
      fit: keepAspectRatio ? 'inside' : 'fill',
      withoutEnlargement: true,
    });
  }

  if (stripMetadata) {
    log('Stripping metadata from output', {
      originalName: file.originalname,
      detectedFormat,
      targetFormat: format,
      metadataSummary,
    });
  } else {
    pipeline = pipeline.withMetadata();
    log('Preserving metadata in output', {
      originalName: file.originalname,
      detectedFormat,
      targetFormat: format,
      metadataSummary,
    });
  }

  switch (format) {
    case 'jpg':
      pipeline = pipeline.jpeg({ quality: quality ?? 90 });
      await pipeline.toFile(outputPath);
      break;
    case 'png':
      pipeline = pipeline.png();
      await pipeline.toFile(outputPath);
      break;
    case 'bmp': {
      const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const encoded = bmp.encode({ data, width: info.width, height: info.height });
      await fsp.writeFile(outputPath, encoded.data);
      break;
    }
    case 'tiff':
      pipeline = pipeline.tiff({ quality: quality ?? 90 });
      await pipeline.toFile(outputPath);
      break;
    case 'webp':
      pipeline = pipeline.webp({ quality: quality ?? 90 });
      await pipeline.toFile(outputPath);
      break;
    case 'gif':
      pipeline = pipeline.gif();
      await pipeline.toFile(outputPath);
      break;
    default:
      throw new Error(`Unsupported conversion pipeline for format: ${format}`);
  }

  log('Image conversion completed', { originalName: file.originalname, detectedFormat, targetFormat: format, outputName, usedBmpFallback, quality, width, height, keepAspectRatio, stripMetadata, originalWidth, originalHeight, metadataSummary });
  return outputName;
}

app.post('/api/convert', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing image file in field "image"' });
    }

    const targetFormat = normalizeFormat(req.body.targetFormat);
    const options = parseConvertOptions(req.body, targetFormat);
    log('Convert request received', {
      input: req.file.originalname,
      targetFormat,
      quality: options.quality,
      width: options.width,
      height: options.height,
      keepAspectRatio: options.keepAspectRatio,
      stripMetadata: options.stripMetadata,
    });

    const outputName = await convertImageFile(req.file, targetFormat, options);
    const outputPath = path.join(CONVERTED_DIR, outputName);
    const outputStats = await fsp.stat(outputPath);
    const convertedUrl = `${getBaseUrl(req)}/converted/${outputName}`;

    log('Single convert success', { input: req.file.originalname, targetFormat, outputName, outputSize: outputStats.size, stripMetadata: options.stripMetadata });
    res.json({ convertedUrl, outputSize: outputStats.size });
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
    const options = parseConvertOptions(req.body, targetFormat);
    const outputNames = await Promise.all(
      files.map((file) => convertImageFile(file, targetFormat, options))
    );

    const convertedUrls = outputNames.map((name) => `${getBaseUrl(req)}/converted/${name}`);
    const responseFiles = await Promise.all(outputNames.map(async (outputName, index) => {
      const outputStats = await fsp.stat(path.join(CONVERTED_DIR, outputName));
      return {
        originalName: files[index].originalname,
        convertedName: outputName,
        downloadUrl: convertedUrls[index],
        outputSize: outputStats.size,
      };
    }));

    log('Batch convert success', {
      count: files.length,
      targetFormat,
      fieldNames: [...new Set(files.map((file) => file.fieldname))],
      quality: options.quality,
      width: options.width,
      height: options.height,
      keepAspectRatio: options.keepAspectRatio,
      stripMetadata: options.stripMetadata,
    });
    res.json({ convertedUrls, files: responseFiles });
  } catch (error) {
    next(error);
  }
});

app.post('/api/temp/clear', async (_req, res, next) => {
  try {
    const [tempCleared, convertedCleared, uploadCleared] = await Promise.all([
      clearDirectory(TEMP_DIR),
      clearDirectory(CONVERTED_DIR),
      clearDirectory(UPLOAD_DIR),
    ]);

    log('Temporary files cleared on privacy request', { tempCleared, convertedCleared, uploadCleared });
    res.json({ ok: true, tempCleared, convertedCleared, uploadCleared });
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

app.use((error, req, res, _next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message });
  }

  const isUnsupportedInput = isUnsupportedImageFormatError(error);
  const status = error.status || (isUnsupportedInput ? 400 : 500);
  const responseMessage = isUnsupportedInput
    ? `Unsupported input image format for file "${req.file?.originalname || 'unknown'}". Supported uploads include JPG, PNG, BMP, TIFF, WEBP, GIF, and SVG when the runtime can decode them.`
    : (error.message || 'Internal server error');

  console.error('Request failed:', {
    message: error.message,
    status,
    file: req.file?.originalname,
    mimeType: req.file?.mimetype,
    stack: error.stack
  });
  res.status(status).json({ error: responseMessage });
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
