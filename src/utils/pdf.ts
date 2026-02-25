import * as pdfjs from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function renderPdfPageToDataUrl(file: File, pageNum: number = 1): Promise<string> {
  console.log('Rendering PDF page:', pageNum);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(pageNum);
    
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) throw new Error('Could not get canvas context');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    console.log('PDF Page dimensions:', canvas.width, 'x', canvas.height);
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      // @ts-ignore
      canvas: canvas
    }).promise;
    
    const dataUrl = canvas.toDataURL();
    console.log('PDF Page rendered to DataURL, length:', dataUrl.length);
    return dataUrl;
  } catch (error) {
    console.error('Error rendering PDF:', error);
    throw error;
  }
}

export function tintImage(dataUrl: string, color: 'red' | 'blue' | 'gray'): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      console.log('Tinting image, original size:', img.width, 'x', img.height);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context for tinting'));
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let tintedCount = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        const brightness = (r + g + b) / 3;
        
        if (brightness > 245) {
          data[i + 3] = 0; // Transparent
        } else {
          tintedCount++;
          if (color === 'red') {
            data[i] = 255;
            data[i + 1] = 0;
            data[i + 2] = 0;
          } else if (color === 'blue') {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 255;
          } else if (color === 'gray') {
            data[i] = 128;
            data[i + 1] = 128;
            data[i + 2] = 128;
          }
          data[i + 3] = 255; // Full opacity for tinted parts to make them visible
        }
      }
      
      console.log(`Tinted ${tintedCount} pixels`);
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL());
    };
    img.onerror = (err) => {
      console.error('Error loading image for tinting:', err);
      reject(err);
    };
    img.src = dataUrl;
  });
}
