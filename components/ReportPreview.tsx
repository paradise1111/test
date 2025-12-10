



import React, { useEffect, useRef, useState } from 'react';
import { Download, Sparkles, MessageSquarePlus, Eye, FileText, Copy, Check } from 'lucide-react';

declare global {
  interface Window {
    MathJax: {
      typesetPromise?: (elements: HTMLElement[]) => Promise<void>;
    };
    ClipboardItem: any;
  }
}

interface ReportPreviewProps {
  results: string[];
  onDownload: () => void;
  onRefine: (index: number) => void;
  pageOffset: number;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({ results, onDownload, onRefine, pageOffset }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // View Mode: 'review' = Track Changes (Red/Green), 'clean' = Word/Google Doc style (Final)
  const [viewModes, setViewModes] = useState<Record<number, 'review' | 'clean'>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    // Re-render MathJax when content changes or view mode changes
    if (window.MathJax && window.MathJax.typesetPromise && containerRef.current) {
      window.MathJax.typesetPromise([containerRef.current]).catch((err: any) => 
        console.warn('MathJax typeset failed:', err)
      );
    }
  }, [results, viewModes]);

  const toggleViewMode = (index: number) => {
      setViewModes(prev => ({
          ...prev,
          [index]: prev[index] === 'clean' ? 'review' : 'clean'
      }));
  };

  const getCleanHtml = (html: string): string => {
      if (!html) return '';
      // 1. Remove the Audit Panel (Critical Review)
      let clean = html.replace(/<div class="audit-panel">[\s\S]*?<\/div>/, '');
      
      // 2. Remove <del> tags and their content: <del>bad</del> -> ""
      clean = clean.replace(/<del>.*?<\/del>/g, '');
      
      // 3. Remove <ins> tags but keep content: <ins>good</ins> -> good
      clean = clean.replace(/<ins>(.*?)<\/ins>/g, '$1');
      
      // 4. Change container class to simulate Word doc
      clean = clean.replace('class="revision-document"', 'class="word-view-container"');
      clean = clean.replace('class="document-content"', 'class="word-page"');
      
      // 5. Remove "Corrected Text" title if desired, or keep it.
      // Let's replace the title to look like a doc header
      clean = clean.replace(/<h3 class="panel-title">.*?<\/h3>/, '');

      return clean;
  };

  const handleCopyForDocs = async (index: number, html: string) => {
      try {
          // Prepare clean content for clipboard
          const cleanContent = getCleanHtml(html);
          
          // We need to wrap it in minimal html tags for clipboard to recognize it as rich text
          const blob = new Blob([cleanContent], { type: 'text/html' });
          const data = [new window.ClipboardItem({ 'text/html': blob })];
          
          await navigator.clipboard.write(data);
          
          setCopiedIndex(index);
          setTimeout(() => setCopiedIndex(null), 2000);
      } catch (err) {
          console.error("Copy failed", err);
          alert("复制失败，请尝试手动复制。");
      }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-8">
      <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                <Sparkles className="w-5 h-5" />
            </div>
            <div>
                <h3 className="text-lg font-bold text-gray-800">智能审稿预览与优化</h3>
                <p className="text-xs text-gray-500 hidden sm:block">点击页面右上角切换“文档模式”可复制到 Word</p>
            </div>
        </div>
        <button
          onClick={onDownload}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg transition-colors shadow-sm text-sm font-medium"
        >
          <Download className="w-4 h-4" />
          下载完整报告
        </button>
      </div>

      <div className="flex-1 bg-slate-50 relative border-t border-gray-100">
         {/* 
             Fixed: Added max-height and overflow-y-auto to this container directly.
             This ensures the preview area scrolls independently of the main page,
             fixing the "cannot scroll down" issue on some devices.
         */}
         <div 
            className="custom-scrollbar overflow-y-auto" 
            style={{ maxHeight: '75vh' }}
            ref={containerRef}
         >
            <div className="p-4 sm:p-8">
                {results.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <p>等待生成预览...</p>
                    </div>
                )}
                {results.map((htmlFragment, index) => {
                    if (!htmlFragment) return null;
                    const realPage = index + pageOffset;
                    const isError = htmlFragment.includes('error-card');
                    const mode = viewModes[index] || 'review';
                    
                    const displayHtml = mode === 'clean' ? getCleanHtml(htmlFragment) : htmlFragment;

                    return (
                        <div key={index} className="mb-8 relative group last:mb-0">
                            {/* Action Toolbar for each page */}
                            <div className="flex flex-wrap justify-between items-center mb-2 px-1 gap-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    PAGE {realPage}
                                </span>
                                <div className="flex gap-2">
                                    {/* Copy Button (Only in Clean Mode or always) */}
                                    {!isError && (
                                        <button
                                            onClick={() => handleCopyForDocs(index, htmlFragment)}
                                            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all border bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                            title="复制纯净版内容，可直接粘贴到 Google Docs 或 Word"
                                        >
                                            {copiedIndex === index ? <Check className="w-3.5 h-3.5 text-green-600"/> : <Copy className="w-3.5 h-3.5"/>}
                                            {copiedIndex === index ? <span className="text-green-600">已复制</span> : '复制到 Word/Docs'}
                                        </button>
                                    )}

                                    {/* View Toggle */}
                                    {!isError && (
                                        <button
                                            onClick={() => toggleViewMode(index)}
                                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all border ${
                                                mode === 'clean' 
                                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200' 
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                            title={mode === 'clean' ? '切换回审阅模式' : '切换至文档阅读模式'}
                                        >
                                            {mode === 'clean' ? <FileText className="w-3.5 h-3.5"/> : <Eye className="w-3.5 h-3.5"/>}
                                            {mode === 'clean' ? '文档模式' : '审阅模式'}
                                        </button>
                                    )}

                                    {!isError && (
                                        <button 
                                            onClick={() => onRefine(index)}
                                            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-all border border-blue-100"
                                        >
                                            <MessageSquarePlus className="w-3.5 h-3.5" />
                                            优化/修订
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* The Content */}
                            <div 
                                className="preview-fragment transform transition-all"
                                dangerouslySetInnerHTML={{ __html: displayHtml }} 
                            />
                        </div>
                    );
                })}
            </div>
         </div>
      </div>
      
      <style>{`
        /* Scoped styles for the preview content to match the generated HTML template */
        .preview-fragment .page-review { background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden; }
        .preview-fragment .page-header { background: #0f172a; color: white; padding: 10px 16px; }
        .preview-fragment .page-title { margin: 0; color: white; font-size: 0.95rem; }
        
        .preview-fragment .audit-panel { background: #f8fafc; padding: 16px; border-bottom: 1px solid #e2e8f0; }
        .preview-fragment .panel-title { font-size: 0.8rem; text-transform: uppercase; color: #64748b; margin-bottom: 10px; font-weight: bold; }
        .preview-fragment .audit-item { background: white; border: 1px solid #cbd5e1; padding: 10px; margin-bottom: 8px; border-radius: 4px; display: flex; gap: 10px; font-size: 0.9rem; }
        .preview-fragment .audit-label { padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; height: fit-content; white-space: nowrap; color: white; }
        
        /* Updated Audit Categories Colors */
        .preview-fragment .audit-item.logic .audit-label { background: #be123c; } /* Red */
        .preview-fragment .audit-item.standard .audit-label { background: #7e22ce; } /* Purple */
        .preview-fragment .audit-item.grammar .audit-label { background: #0369a1; } /* Blue */
        .preview-fragment .audit-item.ocr .audit-label { background: #c2410c; } /* Orange */
        
        .preview-fragment .revision-document { padding: 24px; }
        .preview-fragment .document-content { font-family: 'Times New Roman', serif; font-size: 1.05rem; line-height: 1.8; color: #1e293b; }
        
        /* Highlight styles */
        .preview-fragment ins { background-color: #dcfce7; color: #15803d; text-decoration: none; border-bottom: 2px solid #22c55e; }
        .preview-fragment del { background-color: #fee2e2; color: #b91c1c; text-decoration: line-through; }
        
        .preview-fragment h3 { margin-top: 1em; font-weight: bold; color: #334155; font-family: sans-serif; }
        .preview-fragment p { margin-bottom: 1em; }

        /* Clean Word View Styles (Compact for Memory Space) */
        .preview-fragment .word-view-container {
            width: 100%;
            background: #fff;
            padding: 0;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .preview-fragment .word-page {
            width: 100%;
            background: white;
            /* Reduced padding for better screen usage */
            padding: 24px 30px; 
            color: #000;
            font-family: 'Times New Roman', Times, serif; 
            font-size: 11.5pt;
            line-height: 1.5;
        }
        @media (min-width: 768px) {
             .preview-fragment .word-page {
                padding: 40px; 
            }
        }
        .preview-fragment .word-page h1, .preview-fragment .word-page h2, .preview-fragment .word-page h3 {
             font-family: 'Arial', sans-serif;
             color: #2c3e50;
             margin-top: 1em;
        }
      `}</style>
    </div>
  );
};

export default ReportPreview;