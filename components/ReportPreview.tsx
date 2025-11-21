import React, { useEffect, useRef } from 'react';
import { Download } from 'lucide-react';

declare global {
  interface Window {
    MathJax: {
      typesetPromise?: (elements: HTMLElement[]) => Promise<void>;
    };
  }
}

interface ReportPreviewProps {
  results: string[];
  onDownload: () => void;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({ results, onDownload }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Re-render MathJax when content changes
    if (window.MathJax && window.MathJax.typesetPromise && containerRef.current) {
      window.MathJax.typesetPromise([containerRef.current]).catch((err: any) => 
        console.warn('MathJax typeset failed:', err)
      );
    }
  }, [results]);

  // Inject basic styles into the preview container to match the template
  // Note: We can't import the <style> tag from the template easily into React inline styles,
  // so we rely on Tailwind + some custom CSS in index.html or simple mapping here.
  // For true fidelity, using a Shadow DOM or Iframe is better, but we will try direct rendering for simplicity.

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">审稿预览</h3>
        <button
          onClick={onDownload}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          下载完整报告 (.html)
        </button>
      </div>

      <div className="flex-1 overflow-hidden bg-gray-100 rounded-xl border border-gray-200 relative">
         <div className="absolute inset-0 overflow-y-auto p-6 custom-scrollbar" ref={containerRef}>
            {results.length === 0 && (
                <div className="flex h-full items-center justify-center text-gray-400">
                    等待生成预览...
                </div>
            )}
            {results.map((htmlFragment, index) => (
                <div 
                    key={index} 
                    className="preview-fragment mb-8"
                    dangerouslySetInnerHTML={{ __html: htmlFragment }} 
                />
            ))}
         </div>
      </div>
      
      <style>{`
        /* Scoped styles for the preview content to match the generated HTML template */
        .preview-fragment .page-review { background: white; border-radius: 8px; padding: 25px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .preview-fragment .page-title { border-bottom: 2px solid #2c3e50; padding-bottom: 10px; color: #2c3e50; font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; }
        .preview-fragment table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 0.9rem; }
        .preview-fragment th, .preview-fragment td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; vertical-align: top; }
        .preview-fragment th { background-color: #f8fafc; font-weight: bold; color: #475569; }
        .preview-fragment .original-text { color: #64748b; font-style: italic; background-color: #fff1f2; }
        .preview-fragment .suggestion { color: #334155; }
        .preview-fragment .final-text { margin-top: 20px; border-top: 1px dashed #cbd5e1; padding-top: 15px; }
        .preview-fragment .content-box { background: #f0fdf4; padding: 20px; border-left: 4px solid #22c55e; border-radius: 4px; }
        .preview-fragment .highlight { color: #dc2626; font-weight: bold; background-color: #fee2e2; padding: 0 4px; border-radius: 2px; }
      `}</style>
    </div>
  );
};

export default ReportPreview;