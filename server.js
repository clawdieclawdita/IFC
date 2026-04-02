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

const AI_STYLE_PRESETS = new Set(['none', 'vintage', 'blackwhite', 'cinematic', 'artistic']);

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

function sanitizePathSegment(value) {
  return String(value || '')
    .replace(/[\\/]+/g, '_')
    .replace(/[^a-zA-Z0-9-_.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'image';
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function buildConvertedName({ originalName, extension, filenameConvention = 'original', customFilenamePattern = '', sequence = 1, now = new Date() }) {
  const parsed = path.parse(originalName || 'image');
  const safeName = sanitizePathSegment(parsed.name || 'image');
  const safeExtension = sanitizePathSegment(extension);
  const timestamp = formatTimestamp(now);
  const date = timestamp.split('T')[0];
  let baseName = safeName;

  if (filenameConvention === 'timestamp') {
    baseName = `${safeName}_${date}`;
  }

  if (filenameConvention === 'custom' && customFilenamePattern.trim()) {
    baseName = customFilenamePattern
      .replaceAll('{name}', safeName)
      .replaceAll('{format}', safeExtension)
      .replaceAll('{timestamp}', timestamp)
      .replaceAll('{date}', date)
      .replaceAll('{seq}', String(sequence));
  }

  return `${sanitizePathSegment(baseName)}.${safeExtension}`;
}

function buildZipEntryName({ convertedName, relativePath, preserveFolderStructure }) {
  if (!preserveFolderStructure || !relativePath) return convertedName;
  const relativeDir = path.dirname(relativePath);
  if (!relativeDir || relativeDir === '.') return convertedName;

  const safeDir = relativeDir
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(sanitizePathSegment)
    .join('/');

  return safeDir ? `${safeDir}/${convertedName}` : convertedName;
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

function parseRotation(value) {
  if (value == null || value === '') return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    const error = new Error('rotation must be a number');
    error.status = 400;
    throw error;
  }

  const normalized = ((Math.round(numeric) % 360) + 360) % 360;
  if (![0, 90, 180, 270].includes(normalized)) {
    const error = new Error('rotation must be one of 0, 90, 180, or 270');
    error.status = 400;
    throw error;
  }

  return normalized;
}

function parseCrop(value) {
  if (value == null || value === '') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  let crop;
  try {
    crop = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    const error = new Error('crop must be valid JSON');
    error.status = 400;
    throw error;
  }

  const result = {};

  for (const edge of ['top', 'right', 'bottom', 'left']) {
    const numeric = Number(crop?.[edge] ?? 0);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 90) {
      const error = new Error(`crop.${edge} must be between 0 and 90`);
      error.status = 400;
      throw error;
    }
    result[edge] = Math.round(numeric);
  }

  if (result.left + result.right >= 100 || result.top + result.bottom >= 100) {
    const error = new Error('crop percentages leave no visible image area');
    error.status = 400;
    throw error;
  }

  return result;
}

function parseConvertOptions(body = {}, targetFormat) {
  const quality = parseOptionalNumber(body.quality, 'quality');
  const width = parseOptionalNumber(body.width, 'width');
  const height = parseOptionalNumber(body.height, 'height');
  const keepAspectRatio = parseOptionalBoolean(body.keepAspectRatio, true);
  const stripMetadata = parseOptionalBoolean(body.stripMetadata, false);
  const preserveMetadata = parseOptionalBoolean(body.preserveMetadata, false);
  const preserveFolderStructure = parseOptionalBoolean(body.preserveFolderStructure, false);
  const rotation = parseRotation(body.rotation);
  const crop = parseCrop(body.crop);
  const filenameConvention = ['original', 'timestamp', 'custom'].includes(body.filenameConvention)
    ? body.filenameConvention
    : 'original';
  const customFilenamePattern = String(body.customFilenamePattern || '');
  const relativePath = String(body.relativePath || '');

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
    preserveMetadata,
    filenameConvention,
    customFilenamePattern,
    preserveFolderStructure,
    relativePath,
    rotation,
    crop,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseAiOptions(body = {}) {
  const autoEnhance = parseOptionalBoolean(body.autoEnhance, false);
  const removeBackground = parseOptionalBoolean(body.removeBackground, false);
  const aiBatchEnabled = parseOptionalBoolean(body.aiBatchEnabled, false);
  const skipAiProcessing = parseOptionalBoolean(body.skipAiProcessing, false);
  const styleTransferEnabled = parseOptionalBoolean(body.styleTransferEnabled, false);
  const enhanceQuality = parseOptionalBoolean(body.enhanceQuality, true);
  const preview = parseOptionalBoolean(body.preview, false);
  const stylePreset = String(body.stylePreset || 'none').trim().toLowerCase();
  const styleIntensity = body.styleIntensity == null || body.styleIntensity === '' ? 60 : Number(body.styleIntensity);

  if (!Number.isFinite(styleIntensity) || styleIntensity < 0 || styleIntensity > 100) {
    const error = new Error('styleIntensity must be between 0 and 100');
    error.status = 400;
    throw error;
  }

  if (!AI_STYLE_PRESETS.has(stylePreset)) {
    const error = new Error(`stylePreset must be one of ${[...AI_STYLE_PRESETS].join(', ')}`);
    error.status = 400;
    throw error;
  }

  return {
    autoEnhance,
    removeBackground,
    aiBatchEnabled,
    skipAiProcessing,
    styleTransferEnabled,
    enhanceQuality,
    stylePreset,
    styleIntensity,
    preview,
  };
}

function computeAutoEnhanceTuning(stats) {
  const channels = stats?.channels || [];
  const red = channels[0]?.mean ?? 128;
  const green = channels[1]?.mean ?? 128;
  const blue = channels[2]?.mean ?? 128;
  const avg = (red + green + blue) / 3;
  const normalized = avg / 255;
  const dynamicRange = ((channels[0]?.stdev ?? 32) + (channels[1]?.stdev ?? 32) + (channels[2]?.stdev ?? 32)) / 3;
  const contrastGain = normalized < 0.45 ? 1.1 : normalized > 0.72 ? 1.03 : 1.07;
  const brightness = normalized < 0.42 ? 1.08 : normalized > 0.8 ? 0.97 : 1.02;
  const saturation = dynamicRange < 42 ? 1.14 : 1.08;
  const midpointOffset = Math.round(128 - (128 * contrastGain));

  return {
    brightness,
    saturation,
    contrastGain,
    midpointOffset,
    sharpenSigma: dynamicRange < 36 ? 1.4 : 1.15,
    sharpenFlat: dynamicRange < 36 ? 1.2 : 0.8,
    sharpenJagged: dynamicRange < 36 ? 2.2 : 1.6,
  };
}

async function applyAutoEnhanceBuffer(inputBuffer, { enhanceQuality = true } = {}) {
  const stats = await sharp(inputBuffer).stats();
  const tuning = computeAutoEnhanceTuning(stats);
  let pipeline = sharp(inputBuffer)
    .modulate({ brightness: tuning.brightness, saturation: tuning.saturation })
    .linear(tuning.contrastGain, tuning.midpointOffset)
    .sharpen(tuning.sharpenSigma, tuning.sharpenFlat, tuning.sharpenJagged);

  if (enhanceQuality) {
    pipeline = pipeline.gamma(1.04).median(1);
  }

  return {
    buffer: await pipeline.png().toBuffer(),
    analysis: {
      brightness: tuning.brightness,
      saturation: tuning.saturation,
      contrastGain: tuning.contrastGain,
      sharpenSigma: tuning.sharpenSigma,
      qualityBoost: enhanceQuality,
    },
  };
}

function estimateBackgroundColor(data, info) {
  const points = [
    [0, 0],
    [Math.max(0, info.width - 1), 0],
    [0, Math.max(0, info.height - 1)],
    [Math.max(0, info.width - 1), Math.max(0, info.height - 1)],
    [Math.floor(info.width / 2), 0],
    [Math.floor(info.width / 2), Math.max(0, info.height - 1)],
  ];

  const sums = [0, 0, 0];
  points.forEach(([x, y]) => {
    const index = (y * info.width + x) * info.channels;
    sums[0] += data[index];
    sums[1] += data[index + 1];
    sums[2] += data[index + 2];
  });

  return sums.map((value) => value / points.length);
}

async function applyBackgroundRemovalBuffer(inputBuffer) {
  const { data, info } = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const background = estimateBackgroundColor(data, info);
  const alpha = Buffer.alloc(info.width * info.height);

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const pixelIndex = (y * info.width + x) * info.channels;
      const maskIndex = y * info.width + x;
      const dr = data[pixelIndex] - background[0];
      const dg = data[pixelIndex + 1] - background[1];
      const db = data[pixelIndex + 2] - background[2];
      const distance = Math.sqrt((dr * dr) + (dg * dg) + (db * db));
      const edgeBias = Math.min(x, y, info.width - x - 1, info.height - y - 1) < 8 ? 0.88 : 1;
      alpha[maskIndex] = clamp(Math.round(((distance - 20) / 55) * 255 * edgeBias), 0, 255);
    }
  }

  const softenedMask = await sharp(alpha, {
    raw: { width: info.width, height: info.height, channels: 1 },
  }).blur(1.2).png().toBuffer();

  const outputBuffer = await sharp(inputBuffer)
    .removeAlpha()
    .joinChannel(softenedMask)
    .png()
    .toBuffer();

  return {
    buffer: outputBuffer,
    analysis: {
      backgroundColor: background.map((value) => Math.round(value)),
      maskSoftness: 1.2,
      threshold: 20,
    },
  };
}

async function blendBuffers(originalBuffer, styledBuffer, intensity = 60) {
  const original = await sharp(originalBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const styled = await sharp(styledBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ratio = clamp(Number(intensity) / 100, 0, 1);
  const output = Buffer.alloc(original.data.length);

  for (let index = 0; index < original.data.length; index += 1) {
    output[index] = Math.round((original.data[index] * (1 - ratio)) + (styled.data[index] * ratio));
  }

  return sharp(output, {
    raw: {
      width: original.info.width,
      height: original.info.height,
      channels: original.info.channels,
    },
  }).png().toBuffer();
}

async function applyStyleTransferBuffer(inputBuffer, { stylePreset = 'vintage', styleIntensity = 60 } = {}) {
  let styledPipeline = sharp(inputBuffer).ensureAlpha();

  switch (stylePreset) {
    case 'vintage':
      styledPipeline = styledPipeline.modulate({ brightness: 1.04, saturation: 0.82 }).tint({ r: 214, g: 182, b: 132 }).gamma(1.08);
      break;
    case 'blackwhite':
      styledPipeline = styledPipeline.grayscale().linear(1.12, -8).normalize();
      break;
    case 'cinematic':
      styledPipeline = styledPipeline.modulate({ brightness: 0.98, saturation: 1.18 }).recomb([
        [1.08, -0.03, -0.02],
        [-0.04, 1.02, 0.05],
        [-0.02, 0.08, 1.08],
      ]);
      break;
    case 'artistic':
      styledPipeline = styledPipeline.modulate({ brightness: 1.02, saturation: 1.32 }).sharpen(1.6, 1.1, 2.4).median(1);
      break;
    default:
      break;
  }

  const styledBuffer = await styledPipeline.png().toBuffer();
  const blended = await blendBuffers(inputBuffer, styledBuffer, styleIntensity);

  return {
    buffer: blended,
    analysis: {
      preset: stylePreset,
      intensity: styleIntensity,
    },
  };
}

async function applyAiPipeline(inputBuffer, aiOptions = {}) {
  let currentBuffer = inputBuffer;
  const analysis = {};

  if (aiOptions.autoEnhance && !aiOptions.skipAiProcessing) {
    const enhanced = await applyAutoEnhanceBuffer(currentBuffer, aiOptions);
    currentBuffer = enhanced.buffer;
    analysis.autoEnhance = enhanced.analysis;
  }

  if (aiOptions.removeBackground && !aiOptions.skipAiProcessing) {
    const bgRemoved = await applyBackgroundRemovalBuffer(currentBuffer);
    currentBuffer = bgRemoved.buffer;
    analysis.removeBackground = bgRemoved.analysis;
  }

  if (aiOptions.styleTransferEnabled && !aiOptions.skipAiProcessing) {
    const styled = await applyStyleTransferBuffer(currentBuffer, aiOptions);
    currentBuffer = styled.buffer;
    analysis.styleTransfer = styled.analysis;
  }

  return { buffer: currentBuffer, analysis };
}

function getCropSpaceDimensions({ width, height, rotation = 0 }) {
  if (!width || !height) {
    const error = new Error('Unable to determine image dimensions for crop operation');
    error.status = 400;
    throw error;
  }

  return rotation % 180 === 0
    ? { width, height }
    : { width: height, height: width };
}

function getExtractRegion({ width, height, crop }) {
  const left = Math.round(width * ((crop.left || 0) / 100));
  const right = Math.round(width * ((crop.right || 0) / 100));
  const top = Math.round(height * ((crop.top || 0) / 100));
  const bottom = Math.round(height * ((crop.bottom || 0) / 100));
  const extractWidth = width - left - right;
  const extractHeight = height - top - bottom;

  if (extractWidth < 1 || extractHeight < 1) {
    const error = new Error('Crop settings result in an empty image');
    error.status = 400;
    throw error;
  }

  return { left, top, width: extractWidth, height: extractHeight };
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
  const convertedName = buildConvertedName({
    originalName: file.originalname,
    extension: outputExtension,
    filenameConvention: options.filenameConvention,
    customFilenamePattern: options.customFilenamePattern,
    sequence: options.sequence,
  });
  log('Filename generated', {
    originalName: file.originalname,
    convertedName,
    filenameConvention: options.filenameConvention,
    customFilenamePattern: options.customFilenamePattern,
    sequence: options.sequence || 1,
  });
  const outputName = makeFileName(convertedName, outputExtension);
  const outputPath = path.join(CONVERTED_DIR, outputName);
  const { sharpInput, detectedFormat, usedBmpFallback } = await loadImagePipelineSource(file);
  const {
    quality = null,
    width = null,
    height = null,
    keepAspectRatio = true,
    stripMetadata = false,
    preserveMetadata = false,
    relativePath = '',
    rotation = 0,
    crop = { top: 0, right: 0, bottom: 0, left: 0 },
    aiOptions = {},
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
    if (rotation) {
      svgPipeline = svgPipeline.rotate(rotation);
    }
    if (crop.top || crop.right || crop.bottom || crop.left) {
      const cropSpace = getCropSpaceDimensions({ width: originalWidth, height: originalHeight, rotation });
      svgPipeline = svgPipeline.extract(getExtractRegion({ width: cropSpace.width, height: cropSpace.height, crop }));
    }
    if (width || height) {
      svgPipeline = svgPipeline.resize({ width: width || null, height: height || null, fit: 'inside', withoutEnlargement: true });
    }
    let pngBuffer = await svgPipeline.png().toBuffer();
    let aiAnalysis = {};
    if (aiOptions.autoEnhance || aiOptions.removeBackground || aiOptions.styleTransferEnabled) {
      const processed = await applyAiPipeline(pngBuffer, aiOptions);
      pngBuffer = processed.buffer;
      aiAnalysis = processed.analysis;
    }
    const previewMetadata = await sharp(pngBuffer).metadata();
    const safeWidth = previewMetadata.width || 512;
    const safeHeight = previewMetadata.height || 512;
    const base64 = pngBuffer.toString('base64');
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">\n  <image href="data:image/png;base64,${base64}" width="${safeWidth}" height="${safeHeight}" />\n</svg>\n`;
    await fsp.writeFile(outputPath, svg, 'utf8');
    log('Image conversion completed', { originalName: file.originalname, detectedFormat, targetFormat: format, outputName, convertedName, relativePath, usedBmpFallback, quality, width, height, keepAspectRatio, stripMetadata, preserveMetadata, originalWidth, originalHeight, metadataSummary, aiAnalysis });
    return { outputName, convertedName, relativePath };
  }

  let pipeline = createSharpPipeline(sharpInput);

  if (rotation) {
    pipeline = pipeline.rotate(rotation);
  }

  if (crop.top || crop.right || crop.bottom || crop.left) {
    const cropSpace = getCropSpaceDimensions({ width: originalWidth, height: originalHeight, rotation });
    pipeline = pipeline.extract(getExtractRegion({ width: cropSpace.width, height: cropSpace.height, crop }));
  }

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
  } else if (preserveMetadata) {
    pipeline = pipeline.withMetadata();
    log('Preserving metadata in output', {
      originalName: file.originalname,
      detectedFormat,
      targetFormat: format,
      metadataSummary,
    });
  }

  let aiAnalysis = {};

  if (aiOptions.autoEnhance || aiOptions.removeBackground || aiOptions.styleTransferEnabled) {
    const baseBuffer = await pipeline.png().toBuffer();
    const processed = await applyAiPipeline(baseBuffer, aiOptions);
    pipeline = sharp(processed.buffer, { animated: true });
    aiAnalysis = processed.analysis;
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

  log('Image conversion completed', { originalName: file.originalname, detectedFormat, targetFormat: format, outputName, convertedName, relativePath, usedBmpFallback, quality, width, height, keepAspectRatio, stripMetadata, preserveMetadata, originalWidth, originalHeight, metadataSummary, aiAnalysis });
  return { outputName, convertedName, relativePath };
}

app.post('/api/convert', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing image file in field "image"' });
    }

    const targetFormat = normalizeFormat(req.body.targetFormat);
    const options = parseConvertOptions(req.body, targetFormat);
    const aiOptions = parseAiOptions(req.body);
    log('Convert request received', {
      input: req.file.originalname,
      targetFormat,
      quality: options.quality,
      width: options.width,
      height: options.height,
      keepAspectRatio: options.keepAspectRatio,
      stripMetadata: options.stripMetadata,
      preserveMetadata: options.preserveMetadata,
      filenameConvention: options.filenameConvention,
      customFilenamePattern: options.customFilenamePattern,
      preserveFolderStructure: options.preserveFolderStructure,
      relativePath: options.relativePath,
      rotation: options.rotation,
      crop: options.crop,
    });

    const { outputName, convertedName, relativePath } = await convertImageFile(req.file, targetFormat, { ...options, aiOptions });
    const outputPath = path.join(CONVERTED_DIR, outputName);
    const outputStats = await fsp.stat(outputPath);
    const convertedUrl = `${getBaseUrl(req)}/converted/${outputName}`;

    log('Single convert success', { input: req.file.originalname, targetFormat, outputName, convertedName, relativePath, outputSize: outputStats.size, stripMetadata: options.stripMetadata, preserveMetadata: options.preserveMetadata });
    res.json({ convertedUrl, convertedName, relativePath, outputSize: outputStats.size });
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
    const aiOptions = parseAiOptions(req.body);
    const outputFiles = await Promise.all(
      files.map((file, index) => convertImageFile(file, targetFormat, { ...options, sequence: index + 1, relativePath: file.originalname, aiOptions }))
    );

    const convertedUrls = outputFiles.map(({ outputName }) => `${getBaseUrl(req)}/converted/${outputName}`);
    const responseFiles = await Promise.all(outputFiles.map(async ({ outputName, convertedName, relativePath }, index) => {
      const outputStats = await fsp.stat(path.join(CONVERTED_DIR, outputName));
      return {
        originalName: files[index].originalname,
        convertedName,
        relativePath,
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
      preserveMetadata: options.preserveMetadata,
      filenameConvention: options.filenameConvention,
      preserveFolderStructure: options.preserveFolderStructure,
    });
    res.json({ convertedUrls, files: responseFiles });
  } catch (error) {
    next(error);
  }
});

async function handleAiPreview(req, res, next, transform) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing image file in field "image"' });
    }

    const { sharpInput } = await loadImagePipelineSource(req.file);
    const sourceBuffer = await createSharpPipeline(sharpInput).png().toBuffer();
    const aiOptions = parseAiOptions(req.body);
    const processed = await transform(sourceBuffer, aiOptions);
    const previewBuffer = await sharp(processed.buffer).png().toBuffer();

    if (aiOptions.preview) {
      return res.json({
        previewDataUrl: `data:image/png;base64,${previewBuffer.toString('base64')}`,
        analysis: processed.analysis,
      });
    }

    const outputName = makeFileName(req.file.originalname, 'png');
    await fsp.writeFile(path.join(CONVERTED_DIR, outputName), previewBuffer);

    return res.json({
      convertedUrl: `${getBaseUrl(req)}/converted/${outputName}`,
      convertedName: `${path.parse(req.file.originalname).name}.png`,
      analysis: processed.analysis,
    });
  } catch (error) {
    next(error);
  }
}

app.post('/api/auto-enhance', upload.single('image'), async (req, res, next) => {
  handleAiPreview(req, res, next, (buffer, aiOptions) => applyAutoEnhanceBuffer(buffer, aiOptions));
});

app.post('/api/remove-background', upload.single('image'), async (req, res, next) => {
  handleAiPreview(req, res, next, (buffer) => applyBackgroundRemovalBuffer(buffer));
});

app.post('/api/style-transfer', upload.single('image'), async (req, res, next) => {
  handleAiPreview(req, res, next, (buffer, aiOptions) => applyStyleTransferBuffer(buffer, aiOptions));
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
    const { convertedFiles, convertedUrls, preserveFolderStructure = false } = req.body || {};
    const filesForZip = Array.isArray(convertedFiles) && convertedFiles.length
      ? convertedFiles
      : (Array.isArray(convertedUrls) ? convertedUrls.map((downloadUrl) => ({ downloadUrl })) : []);

    if (!filesForZip.length) {
      return res.status(400).json({ error: 'convertedFiles must be a non-empty array' });
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

      for (const item of filesForZip) {
        const fileUrl = item.downloadUrl;
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

        const zipEntryName = buildZipEntryName({
          convertedName: item.convertedName || fileName,
          relativePath: item.relativePath || '',
          preserveFolderStructure: Boolean(preserveFolderStructure),
        });

        log('ZIP entry added', { fileName, zipEntryName, preserveFolderStructure: Boolean(preserveFolderStructure), relativePath: item.relativePath || '' });
        archive.file(filePath, { name: zipEntryName });
      }

      archive.finalize().catch(reject);
    });

    const zipUrl = `${getBaseUrl(req)}/temp/${zipName}`;
    log('ZIP created', { zipName, fileCount: filesForZip.length, preserveFolderStructure: Boolean(preserveFolderStructure) });
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
