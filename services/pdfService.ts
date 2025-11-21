
import { PDFDocument } from 'pdf-lib';

// We use the global window.pdfjsLib loaded via CDN in index.html
// This avoids complex worker configurations in this environment.

interface PdfJsLib {
  getDocument: (src: string | Uint8Array) => { promise: Promise<PdfDocument> };
  GlobalWorkerOptions: { workerSrc: string };
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
}

interface PdfPage {
  getViewport: (params: { scale: number }) => PdfViewport;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => { promise: Promise<void> };
}

interface PdfViewport {
  width: number;
  height: number;
}

declare global {
  interface Window {
    pdfjsLib: PdfJsLib;
  }
}

// Helper to wait for PDF.js to load from CDN if it hasn't yet
const waitForPdfJs = async (): Promise<PdfJsLib> => {
  if (window.pdfjsLib) return window.pdfjsLib;
  
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.pdfjsLib) {
        clearInterval(interval);
        resolve(window.pdfjsLib);
      } else if (attempts > 50) { // 5 seconds timeout
        clearInterval(interval);
        reject(new Error("PDF.js library failed to load from CDN. Please check your internet connection."));
      }
    }, 100);
  });
};

export const loadPdf = async (file: File): Promise<PdfDocument> => {
  const pdfLib = await waitForPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfLib.getDocument(new Uint8Array(arrayBuffer));
  return loadingTask.promise;
};

export const renderPageToImage = async (pdf: PdfDocument, pageNumber: number, scale: number = 1.0): Promise<string> => {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not get canvas context');
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: context, viewport }).promise;

  // Optimization: Use 0.5 quality and 1.0 scale for maximum speed.
  // This drastically reduces the payload size, minimizing "XHR Failed" errors
  // and latency. Math text is high contrast so this quality is sufficient.
  return canvas.toDataURL('image/jpeg', 0.5);
};

/**
 * Creates a new PDF file containing only the specified pages from the original file.
 * @param originalFile The source PDF file
 * @param pageNumbers Array of 1-based page numbers to include
 * @returns Uint8Array of the new PDF
 */
export const createSubsetPdf = async (originalFile: File, pageNumbers: number[]): Promise<Uint8Array> => {
  const arrayBuffer = await originalFile.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer);
  const newDoc = await PDFDocument.create();

  // Convert 1-based page numbers to 0-based indices
  const indices = pageNumbers.map(p => p - 1).filter(i => i >= 0 && i < srcDoc.getPageCount());
  
  if (indices.length === 0) {
    throw new Error("No valid pages selected for extraction.");
  }

  const copiedPages = await newDoc.copyPages(srcDoc, indices);
  
  copiedPages.forEach(page => {
    newDoc.addPage(page);
  });

  return await newDoc.save();
};
