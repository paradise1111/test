import React, { useEffect, useRef } from 'react';

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
    if (window.MathJax && window.MathJax.typesetPromise && containerRef.current) {
      window.MathJax.typesetPromise([containerRef.current]).catch((err: any) => 
        console.warn('MathJax typeset failed:', err)
      );
    }
  }, [results]);

  return (
    <div className="flex flex-col h-full bg-gray-50 border-t-4 border-black">
       <div className="overflow-y-auto max-h-[1000px] p-8 md:p-12 custom-scrollbar bg-gray-100" ref={containerRef}>
          {results.length === 0 && (
              <div className="flex h-64 items-center justify-center text-gray-400 flex-col gap-4">
                  <i className="fa-regular fa-hourglass-half text-3xl"></i>
                  <p className="font-serif text-sm italic">等待输出内容...</p>
              </div>
          )}
          
          <div className="max-w-[850px] mx-auto min-h-[1000px]">
              {results.map((htmlFragment, index) => (
                  <div 
                      key={index} 
                      className="preview-fragment mb-16 bg-white shadow-sm p-12 md:p-16 border border-gray-200"
                      dangerouslySetInnerHTML={{ __html: htmlFragment }} 
                  />
              ))}
          </div>
       </div>
      
      <style>{`
        /* Digital Print Style Overrides */
        .preview-fragment { 
            color: #111; 
            font-family: "Noto Serif SC", serif; 
            line-height: 1.8;
        }
        
        .preview-fragment .page-review { padding: 0; margin: 0; border: none; box-shadow: none; }
        .preview-fragment .error-card { border-left: 0; border-top: 10px solid #dc2626; }

        .preview-fragment .page-title { 
            font-size: 1.8rem; 
            font-weight: 900; 
            border-bottom: 2px solid #000; 
            padding-bottom: 1rem; 
            margin-bottom: 2rem;
            letter-spacing: -0.02em;
        }
        
        .preview-fragment table { width: 100%; border-collapse: collapse; font-size: 0.95rem; margin: 2rem 0; }
        .preview-fragment th { 
            text-align: left; 
            border-bottom: 2px solid #000; 
            padding: 12px 8px; 
            font-weight: 900; 
            color: #000;
        }
        .preview-fragment td { border-bottom: 1px solid #e5e7eb; padding: 16px 8px; vertical-align: top; }
        
        .preview-fragment .original-text { 
            font-family: "Noto Serif SC", serif; 
            background: #fff;
            border-left: 3px solid #000;
            padding: 8px 16px; 
            color: #000;
            font-style: italic;
        }
        
        .preview-fragment .tag { 
            display: inline-block; 
            padding: 4px 8px; 
            font-size: 0.75rem; 
            font-weight: bold; 
            border: 1px solid #000; 
            margin-right: 8px; 
            text-transform: uppercase;
            letter-spacing: 0.05em;
            background: #fff;
            color: #000;
        }
        
        .preview-fragment .tag-error { background: #000; color: #fff; border-color: #000; }
        .preview-fragment .tag-calc { border-style: dashed; }
        
        .preview-fragment .content-box { 
            background: #f9fafb; 
            padding: 2rem; 
            margin-top: 2rem;
            border: 1px solid #e5e7eb;
        }

        .preview-fragment .highlight { 
            background-color: transparent; 
            border-bottom: 2px solid #000; 
            font-weight: bold;
        }
        
        .preview-fragment .safety-check-section {
            border: 4px solid #000;
            background: #fff;
            color: #000;
            padding: 1.5rem;
            margin-bottom: 2rem;
        }
        .preview-fragment .safety-check-section h3 { color: #000 !important; text-transform: uppercase; font-weight: 900; }
        .preview-fragment .safety-check-section p { color: #000 !important; }
      `}</style>
    </div>
  );
};

export default ReportPreview;
