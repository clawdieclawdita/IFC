const API_HEADERS = {
  Accept: 'application/json',
};

const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseError = async (response, fallbackMessage) => {
  try {
    const data = await response.json();
    return data?.error || data?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
};

export const convertSingle = async ({ file, targetFormat }) => {
  if (USE_MOCK_API) {
    await delay(350);
    return {
      id: `${file.name}-${file.lastModified}`,
      originalName: file.name,
      convertedName: file.name.replace(/\.[^.]+$/, '') + `.${targetFormat}`,
      blobBase64: btoa(`mock-binary-${file.name}-${targetFormat}`),
      mimeType: `image/${targetFormat === 'jpg' ? 'jpeg' : targetFormat}`,
      size: file.size,
    };
  }

  const formData = new FormData();
  formData.append('image', file);
  formData.append('targetFormat', targetFormat);

  const response = await fetch('/api/convert', {
    method: 'POST',
    headers: API_HEADERS,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseError(response, `Conversion failed for ${file.name}.`));
  }

  const data = await response.json();
  if (!data?.convertedUrl) {
    throw new Error(`Conversion failed for ${file.name}: API returned no converted file.`);
  }

  return {
    id: `${file.name}-${file.lastModified}`,
    originalName: file.name,
    convertedName: file.name.replace(/\.[^.]+$/, '') + `.${targetFormat}`,
    downloadUrl: data.convertedUrl,
    mimeType: `image/${targetFormat === 'jpg' ? 'jpeg' : targetFormat}`,
    size: file.size,
  };
};

export const createZip = async ({ targetFormat, convertedFiles }) => {
  if (USE_MOCK_API) {
    await delay(400);
    return new Blob([JSON.stringify({ targetFormat, files: convertedFiles }, null, 2)], {
      type: 'application/zip',
    });
  }

  const response = await fetch('/api/zip', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...API_HEADERS,
    },
    body: JSON.stringify({
      convertedUrls: convertedFiles.map((file) => file.downloadUrl).filter(Boolean),
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, 'ZIP creation failed.'));
  }

  const data = await response.json();
  if (!data?.zipUrl) {
    throw new Error('ZIP creation failed: API returned no zip URL.');
  }

  const zipResponse = await fetch(data.zipUrl);
  if (!zipResponse.ok) {
    throw new Error('Could not fetch generated ZIP file.');
  }

  return zipResponse.blob();
};

export const triggerDownload = ({ blob, filename }) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
