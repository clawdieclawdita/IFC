const STYLE_PRESETS = {
  none: { label: 'Original', filter: () => 'none' },
  vintage: {
    label: 'Vintage',
    filter: (intensity) => `sepia(${0.35 + intensity * 0.55}) saturate(${1.05 + intensity * 0.2}) contrast(${1 + intensity * 0.08}) brightness(${1 + intensity * 0.03})`,
  },
  blackwhite: {
    label: 'Black & White',
    filter: (intensity) => `grayscale(${0.45 + intensity * 0.55}) contrast(${1 + intensity * 0.18}) brightness(${1 + intensity * 0.04})`,
  },
  cinematic: {
    label: 'Cinematic',
    filter: (intensity) => `contrast(${1.05 + intensity * 0.28}) saturate(${0.95 + intensity * 0.22}) brightness(${0.98 + intensity * 0.05}) hue-rotate(${-6 * intensity}deg)`,
  },
  artistic: {
    label: 'Artistic',
    filter: (intensity) => `saturate(${1.12 + intensity * 0.42}) contrast(${1 + intensity * 0.16}) brightness(${1 + intensity * 0.02}) hue-rotate(${8 * intensity}deg)`,
  },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const loadImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    resolve(img);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error(`Failed to load ${file.name} for AI processing.`));
  };
  img.src = url;
});

const dataUrlToFile = async (dataUrl, file) => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], file.name, {
    type: blob.type || file.type || 'image/png',
    lastModified: file.lastModified || Date.now(),
  });
};

const canvasToFile = (canvas, originalFile) => new Promise((resolve, reject) => {
  const exportType = originalFile.type === 'image/svg+xml' ? 'image/png' : (originalFile.type || 'image/png');
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('AI processing failed while exporting preview.'));
      return;
    }
    resolve(new File([blob], originalFile.name, { type: exportType, lastModified: Date.now() }));
  }, exportType, 0.96);
});

const removeBackground = (ctx, width, height) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const samplePoints = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
  ];

  const sampled = samplePoints.map(([x, y]) => {
    const index = (y * width + x) * 4;
    return [data[index], data[index + 1], data[index + 2]];
  });

  const average = sampled.reduce((acc, value) => [acc[0] + value[0], acc[1] + value[1], acc[2] + value[2]], [0, 0, 0])
    .map((channel) => channel / sampled.length);

  const threshold = 42;
  for (let index = 0; index < data.length; index += 4) {
    const delta = Math.abs(data[index] - average[0]) + Math.abs(data[index + 1] - average[1]) + Math.abs(data[index + 2] - average[2]);
    if (delta < threshold) {
      data[index + 3] = Math.max(0, Math.round(data[index + 3] * 0.12));
    }
  }

  ctx.putImageData(imageData, 0, 0);
};

const sharpen = (ctx, width, height, amount = 0.45) => {
  const src = ctx.getImageData(0, 0, width, height);
  const out = ctx.createImageData(width, height);
  const { data } = src;
  const dst = out.data;
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let k = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const i = ((y + ky) * width + (x + kx)) * 4;
          const weight = kernel[k++];
          r += data[i] * weight;
          g += data[i + 1] * weight;
          b += data[i + 2] * weight;
        }
      }
      const index = (y * width + x) * 4;
      dst[index] = clamp(Math.round(data[index] * (1 - amount) + r * amount), 0, 255);
      dst[index + 1] = clamp(Math.round(data[index + 1] * (1 - amount) + g * amount), 0, 255);
      dst[index + 2] = clamp(Math.round(data[index + 2] * (1 - amount) + b * amount), 0, 255);
      dst[index + 3] = data[index + 3];
    }
  }

  ctx.putImageData(out, 0, 0);
};

export const getStylePresetMeta = () => STYLE_PRESETS;

export const shouldApplyAi = (aiState) => Boolean(
  aiState?.enabled && (
    aiState?.autoEnhance
    || aiState?.backgroundRemoval
    || (aiState?.stylePreset && aiState.stylePreset !== 'none')
  )
);

export const buildCanvasFilter = (aiState) => {
  const intensity = clamp(Number(aiState?.styleIntensity) || 0.72, 0, 1);
  const filters = [];

  if (aiState?.autoEnhance) {
    filters.push(`brightness(${1.03 + intensity * 0.08})`);
    filters.push(`contrast(${1.08 + intensity * 0.16})`);
    filters.push(`saturate(${1.06 + intensity * 0.24})`);
  }

  const preset = STYLE_PRESETS[aiState?.stylePreset || 'none'];
  if (preset && aiState?.stylePreset !== 'none') {
    filters.push(preset.filter(intensity));
  }

  return filters.length ? filters.join(' ') : 'none';
};

export const getPreviewSourceFile = async (file) => {
  if (!file?.type?.startsWith('image/')) return file;
  if (!file.thumbnailDataUrl) return file;
  return dataUrlToFile(file.thumbnailDataUrl, file);
};

export const generateAiPreview = async (file, aiState) => {
  if (!file?.type?.startsWith('image/')) return '';
  const processed = await applyAiProcessing(file, aiState);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to build AI preview.'));
    reader.readAsDataURL(processed);
  });
};

export const applyAiProcessing = async (file, aiState) => {
  if (!file?.type?.startsWith('image/') || !shouldApplyAi(aiState)) return file;

  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) return file;

  ctx.filter = buildCanvasFilter(aiState);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';

  if (aiState?.backgroundRemoval) {
    removeBackground(ctx, canvas.width, canvas.height);
  }

  if (aiState?.autoEnhance) {
    sharpen(ctx, canvas.width, canvas.height, 0.35 + (Number(aiState?.styleIntensity) || 0.72) * 0.2);
  }

  return canvasToFile(canvas, file);
};
