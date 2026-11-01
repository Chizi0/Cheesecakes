export function fitImageDimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error('The photo has invalid dimensions.');
  }
  if (width * height > 80000000) throw new Error('This photo exceeds 80 megapixels. Choose a smaller copy.');
  const scale = Math.min(1, 1600 / width, 1600 / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function prepareClothingPhoto(file) {
  if (!file || !file.size || file.size > 20 * 1024 * 1024) throw new Error('Choose a clothing photo up to 20 MB.');
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG or WebP. For HEIC, try a screenshot or export a JPEG.');
  }
  const dataURL = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Your browser could not read this photo. Please choose it again.'));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('This browser could not open the photo. Try a JPEG or screenshot. This is not a megapixel error.'));
    image.src = dataURL;
  });
  const dimensions = fitImageDimensions(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width; canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo resizing is unavailable in this browser.');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let normalized;
  try { normalized = canvas.toDataURL('image/jpeg', 0.85); }
  catch { throw new Error('The browser could not prepare this image. Try a smaller JPEG or screenshot.'); }
  if (!normalized.startsWith('data:image/jpeg;base64,')) throw new Error('The browser could not produce a JPEG.');
  const imageBase64 = normalized.split(',')[1];
  if (imageBase64.length > Math.ceil(5 * 1024 * 1024 / 3) * 4) throw new Error('The prepared photo is still too large. Choose a smaller copy.');
  return { ...dimensions, imageBase64, previewURL: normalized };
}
