function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

export default async function getCroppedImg(imageSrc, pixelCrop, options = {}) {
  const image = await createImage(imageSrc);
  const outputType = options.type || 'image/png';
  const quality = options.quality ?? 0.95;

  const safeWidth = Math.max(1, Math.floor(pixelCrop.width));
  const safeHeight = Math.max(1, Math.floor(pixelCrop.height));

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(safeWidth * dpr);
  canvas.height = Math.floor(safeHeight * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    safeWidth,
    safeHeight,
    0,
    0,
    safeWidth,
    safeHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to generate cropped image'));
      }
    }, outputType, quality);
  });
}
