// src/editor/utils/clientBgRemoval.js
// Client-side background removal fallback using MediaPipe Selfie Segmentation.
// Used when the remove.bg server API key is not configured.
// MediaPipe is loaded dynamically from CDN on first use — zero startup cost.

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/selfie_segmentation.js';
const SOLUTION_FILES_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747/';

let _loadPromise = null;

function loadMediaPipe() {
  if (_loadPromise) return _loadPromise;
  if (window.SelfieSegmentation) {
    _loadPromise = Promise.resolve();
    return _loadPromise;
  }
  _loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MEDIAPIPE_CDN;
    script.crossOrigin = 'anonymous';
    script.onload  = resolve;
    script.onerror = () => reject(new Error('Failed to load MediaPipe Selfie Segmentation'));
    document.head.appendChild(script);
  });
  return _loadPromise;
}

// ── Main export ───────────────────────────────────────────────────────────────
// Returns a blob URL pointing to a PNG with the background removed.
// Throws if MediaPipe is unavailable or segmentation fails.

export async function removeBackgroundClientSide(file, onProgress) {
  onProgress?.('Loading segmentation model…');

  try {
    await loadMediaPipe();
  } catch {
    throw new Error('MediaPipe could not be loaded. Check your internet connection.');
  }

  if (!window.SelfieSegmentation) {
    throw new Error('SelfieSegmentation not available after load.');
  }

  onProgress?.('Initializing model…');

  return new Promise((resolve, reject) => {
    const selfieSegmentation = new window.SelfieSegmentation({
      locateFile: (file) => `${SOLUTION_FILES_URL}${file}`,
    });

    selfieSegmentation.setOptions({ modelSelection: 1 }); // 1 = landscape model

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    selfieSegmentation.onResults((results) => {
      try {
        onProgress?.('Applying mask…');
        const { segmentationMask, image } = results;

        const canvas  = document.createElement('canvas');
        canvas.width  = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d');

        // Draw the original image
        ctx.drawImage(image, 0, 0);

        // Apply segmentation mask to alpha channel
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { data }  = imageData;

        // Draw mask to read pixel values
        const maskCanvas  = document.createElement('canvas');
        maskCanvas.width  = canvas.width;
        maskCanvas.height = canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        maskCtx.drawImage(segmentationMask, 0, 0, canvas.width, canvas.height);
        const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height).data;

        // Mask R channel = foreground probability (0=bg, 255=fg)
        for (let i = 0; i < data.length; i += 4) {
          const maskVal = maskData[i]; // red channel of segmentation mask
          data[i + 3]   = maskVal;    // set alpha
        }

        ctx.putImageData(imageData, 0, 0);
        URL.revokeObjectURL(objectUrl);
        selfieSegmentation.close();

        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
          resolve(URL.createObjectURL(blob));
        }, 'image/png');

      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    });

    img.onload  = async () => {
      onProgress?.('Running segmentation…');
      try {
        await selfieSegmentation.send({ image: img });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image for segmentation'));
    };
    img.src = objectUrl;
  });
}
