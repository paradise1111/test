import { PDFDocument } from 'pdf-lib';

// We use the global window.pdfjsLib loaded via CDN in index.html
// This avoids complex worker configurations in this environment.

interface PdfJsLib {
  getDocument: (src: string | Uint8Array) => { promise: Promise<PdfJsDocument> };
  GlobalWorkerOptions: { workerSrc: string };
}

// Renamed to PdfJsDocument to avoid collision with 'pdf-lib' PDFDocument class
interface PdfJsDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
}

interface PdfPage {
  getViewport: (params: { scale: number }) => PdfViewport;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => { promise: Promise<void> };
  getTextContent: () => Promise<PdfTextContent>;
}

interface PdfTextContent {
  items: Array<{ str: string }>;
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

export const loadPdf = async (file: File): Promise<PdfJsDocument> => {
  const pdfLib = await waitForPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfLib.getDocument(new Uint8Array(arrayBuffer));
  return loadingTask.promise;
};

// NEW: Extract text from a reference PDF to be used as Knowledge Base
// This export was missing in the previous build causing the error.
export const extractTextFromPdf = async (file: File): Promise<string> => {
  try {
    const pdf = await loadPdf(file);
    let fullText = "";
    
    // Limit to first 50 pages to prevent memory issues, 
    // though Gemini Flash can handle 1M tokens.
    // We'll read up to 100 pages for the knowledge base.
    const maxPages = Math.min(pdf.numPages, 100);
    
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(' ');
      fullText += `[Reference Page ${i}]\n${pageText}\n\n`;
    }
    
    return fullText;
  } catch (error) {
    console.error("Failed to extract text from reference PDF", error);
    throw new Error("无法读取参考资料 PDF 的文字内容，请确保该 PDF 不是纯图片扫描件。");
  }
};

export const renderPageToImage = async (pdf: PdfJsDocument, pageNumber: number, scale: number = 1.0): Promise<string> => {
  const page = await pdf.getPage(pageNumber);
  
  // Initial viewport at 1.0 scale
  let viewport = page.getViewport({ scale: 1.0 });
  
  // CRITICAL OPTIMIZATION:
  // Reduced max dimension to 600px (was 800px/1024px).
  // 600px is the sweet spot: sufficient for Gemini Pro to read formulas,
  // but small enough to maximize upload speed and minimize "RPC/XHR" network errors.
  const MAX_DIMENSION = 600;
  if (viewport.width > MAX_DIMENSION || viewport.height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / viewport.width, MAX_DIMENSION / viewport.height);
      viewport = page.getViewport({ scale: ratio });
  } else if (scale !== 1.0) {
      // Apply user requested scale if it doesn't exceed limits
      viewport = page.getViewport({ scale });
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not get canvas context');
  }

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvasContext: context, viewport }).promise;

  // Optimization: Use 0.5 quality JPEG. 
  // Slightly higher quality (0.5 vs 0.4) to compensate for the lower resolution (600px),
  // ensuring subscripts and small math symbols remain legible.
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
