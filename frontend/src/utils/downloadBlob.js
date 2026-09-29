const decodeFilename = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const getDownloadFilename = (contentDisposition, fallback) => {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeFilename(utf8Match[1].trim().replace(/^"|"$/g, ''));

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1]?.trim() || fallback;
};

export const saveBlobResponse = (response, fallbackFilename) => {
  const blob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data], { type: response.headers?.['content-type'] });
  const filename = getDownloadFilename(
    response.headers?.['content-disposition'],
    fallbackFilename
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
};

export const readBlobErrorMessage = async (error, fallback) => {
  const payload = error?.response?.data;
  if (!(payload instanceof Blob)) {
    return error?.response?.data?.message || error?.message || fallback;
  }

  try {
    const text = await payload.text();
    const data = JSON.parse(text);
    const firstError = Array.isArray(data?.errors) ? data.errors[0] : null;
    return firstError
      ? `${data.message || fallback} (${firstError.field}: ${firstError.message})`
      : data?.message || fallback;
  } catch {
    return fallback;
  }
};
