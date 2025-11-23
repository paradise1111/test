
import React, { useState, useCallback, useRef, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ProgressBar from './components/ProgressBar';
import { AppState, ProcessingStatus, ReportRecord } from './types';
import { loadPdf, renderPageToImage, createSubsetPdf, extractTextFromPdf } from './services/pdfService';
import { analyzePageContent } from './services/geminiService';
import { HTML_TEMPLATE_START, HTML_TEMPLATE_END } from './constants';
import { 
  BookOpen, FileCheck, AlertCircle, PauseCircle, Download, History, 
  Trash2, X, Library, Upload, Link, Sparkles, Calculator, 
  BookText, Search, ShieldAlert, Fingerprint, ChevronRight
} from 'lucide-react';

// --- Apple-style History Item ---
const HistoryItem: React.FC<{ 
    record: ReportRecord; 
    onDownload: (r: string[], n: string, o: number) => void; 
}> = ({ record, onDownload }) => {
    const failedCount = record.totalProcessed - record.successCount;
    
    return (
        <div className="group flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-default mb-3">
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md ${failedCount > 0 ? 'bg-red-500' : 'bg-green-500'}`}>
                    {failedCount > 0 ? '!' : '✓'}
                </div>
                <div>
                    <h4 className="font-semibold text-gray-900 tracking-tight">{record.fileName}</h4>
                    <div className="text-xs text-gray-500 mt-0.5 font-medium">
                        {new Date(record.timestamp).toLocaleDateString()} · {record.totalProcessed} 页
                    </div>
                </div>
            </div>
            <button
                onClick={() => onDownload(record.results, record.fileName, record.pageOffset)}
                className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-1.5 rounded-full text-xs font-bold"
            >
                下载
            </button>
        </div>
    );
};

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [status, setStatus] = useState<ProcessingStatus>({ total: 0, current: 0, isProcessing: false, currentStage: '' });
  const [results, setResults] = useState<string[]>([]);
  const [activePageIndices, setActivePageIndices] = useState<number[]>([]);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [pageOffset, setPageOffset] = useState<number>(1);
  const [history, setHistory] = useState<ReportRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Knowledge Base State
  const [knowledgeBaseText, setKnowledgeBaseText] = useState<string>('');
  const [refFileName, setRefFileName] = useState<string | null>(null);
  const [isExtractingRef, setIsExtractingRef] = useState(false);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  
  // Logic Refs
  const stopProcessingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('math_edit_history');
        if (saved) setHistory(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('math_edit_history', JSON.stringify(history.slice(0, 10)));
    }
  }, [history]);

  const handleStop = () => {
    // Immediate Stop Logic
    stopProcessingRef.current = true;
    setActivePageIndices([]); // Clear visuals immediately
    setStatus(prev => ({ ...prev, isProcessing: false, currentStage: '已强制停止' }));
    // Do not set appState to IDLE immediately, let the user decide next step
  };

  const handleFileSelect = (file: File) => {
    setCurrentFile(file);
    setErrorMsg(null);
    setResults([]);
    setActivePageIndices([]);
    setAppState(AppState.IDLE);
  };

  const handleRefFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          setRefFileName(file.name);
          setIsExtractingRef(true);
          try {
              const text = await extractTextFromPdf(file);
              setKnowledgeBaseText(prev => prev + `\n\n[参考文件: ${file.name}]\n` + text);
          } catch (err) {
              alert("读取失败: " + (err as Error).message);
              setRefFileName(null);
          } finally {
              setIsExtractingRef(false);
          }
      }
  };

  const archiveCurrentSession = (resultsToArchive: string[]) => {
    if (!currentFile || resultsToArchive.filter(r => r).length === 0) return;
    const validPages = resultsToArchive.filter(r => r && !r.includes('error-card')).length;
    const record: ReportRecord = {
        id: Date.now().toString(),
        fileName: currentFile.name,
        timestamp: Date.now(),
        totalProcessed: resultsToArchive.filter(r => r).length,
        successCount: validPages,
        results: [...resultsToArchive],
        pageOffset: pageOffset
    };
    setHistory(prev => [record, ...prev]);
  };

  const executeReview = async (pagesToProcess: number[], preserveResults: boolean) => {
    if (!currentFile) return;
    
    setAppState(AppState.PROCESSING);
    stopProcessingRef.current = false;
    
    try {
      const pdf = await loadPdf(currentFile);
      const totalPages = pdf.numPages;
      let finalResults = preserveResults ? [...results] : new Array(totalPages).fill('');
      let completedCount = preserveResults ? totalPages - pagesToProcess.length : 0;

      setStatus({ total: totalPages, current: completedCount, isProcessing: true, currentStage: '初始化引擎...' });

      // Queue Management
      const queue = [...pagesToProcess];
      const CONCURRENCY = 5;

      const worker = async () => {
        while (queue.length > 0) {
            // Check STOP signal before taking a job
            if (stopProcessingRef.current) break;

            const pageNum = queue.shift();
            if (!pageNum) break;

            setActivePageIndices(prev => [...prev, pageNum]);

            try {
                // Check STOP signal before expensive rendering
                if (stopProcessingRef.current) break;
                const imgData = await renderPageToImage(pdf, pageNum);

                // Check STOP signal before API Call
                if (stopProcessingRef.current) break;
                const html = await analyzePageContent(imgData, pageNum + pageOffset - 1, knowledgeBaseText);

                // Check STOP signal before updating State
                if (stopProcessingRef.current) break;

                finalResults[pageNum - 1] = html;
                setResults([...finalResults]);
            } catch (err) {
                console.error(err);
                if (!stopProcessingRef.current) {
                     finalResults[pageNum - 1] = `<div class="page-review error-card" id="page-${pageNum}"><h2 class="page-title">Page ${pageNum} Failed</h2></div>`;
                     setResults([...finalResults]);
                }
            } finally {
                // Cleanup current job
                setActivePageIndices(prev => prev.filter(p => p !== pageNum));
                if (!stopProcessingRef.current) {
                    completedCount++;
                    setStatus(prev => ({ ...prev, current: completedCount }));
                }
            }
        }
      };

      await Promise.all(Array(CONCURRENCY).fill(null).map(() => worker()));

      // Final check: Did we stop?
      if (stopProcessingRef.current) {
          // Stopped state handling
          setAppState(AppState.PROCESSING); // Stay in processing UI but stopped
          setStatus(prev => ({ ...prev, isProcessing: false, currentStage: '用户已停止' }));
      } else {
          // Completion
          setStatus(prev => ({ ...prev, currentStage: '完成' }));
          setAppState(AppState.COMPLETED);
      }
      
      // Always save what we have
      archiveCurrentSession(finalResults);

    } catch (err) {
      setErrorMsg((err as Error).message);
      setAppState(AppState.ERROR);
    } finally {
      if (stopProcessingRef.current) {
          setActivePageIndices([]);
      }
    }
  };

  const startProcessing = async () => {
    if (!currentFile) return;
    try {
        const pdf = await loadPdf(currentFile);
        const allPages = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
        await executeReview(allPages, false);
    } catch (e) {
        setErrorMsg("PDF 加载失败: " + (e as Error).message);
        setAppState(AppState.ERROR);
    }
  };

  const downloadReport = (res: string[], name: string, offset: number) => {
      const content = res.filter(r => r).join('\n');
      if (!content) return;
      const html = HTML_TEMPLATE_START + content + HTML_TEMPLATE_END;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace('.pdf', '')}_MathEdit_Report.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen text-[#1d1d1f] pb-20 selection:bg-blue-100 selection:text-blue-900">
      
      {/* --- Apple Style Header --- */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#F5F5F7]/80 backdrop-blur-md border-b border-black/5 h-14 flex items-center justify-between px-6 transition-all">
          <div className="flex items-center gap-2">
              <span className="bg-black text-white p-1 rounded-md"><BookOpen className="w-4 h-4" /></span>
              <span className="font-semibold tracking-tight text-sm">MathEdit Pro</span>
          </div>
          <button onClick={() => setShowHistoryModal(true)} className="p-2 hover:bg-black/5 rounded-full transition-colors">
              <History className="w-5 h-5 text-gray-600" />
          </button>
      </header>

      <main className="pt-24 px-6 max-w-5xl mx-auto">
        
        {(appState === AppState.IDLE || appState === AppState.ERROR) && (
            <div className="animate-fade-in-up space-y-12">
                
                {/* Hero Section */}
                <div className="text-center space-y-4 py-8">
                    <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-tight">
                        智能审阅，<br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0071e3] to-[#42a5f5]">严谨入微。</span>
                    </h1>
                    <p className="text-xl text-[#86868b] max-w-2xl mx-auto font-medium leading-relaxed">
                        MathEdit Pro 融合了 Gemini 3 Pro 的深度推理能力与 Google 实时搜索。
                        专为数学出版打造，自动识别政治敏感、逻辑谬误及排版错误。
                    </p>
                </div>

                {/* Apple Bento Grid Features */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Political Check Card */}
                    <div className="apple-card p-8 rounded-[30px] flex flex-col justify-between h-64 hover:scale-[1.02] transition-transform duration-500">
                        <div>
                            <ShieldAlert className="w-10 h-10 text-red-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">政治合规审查</h3>
                            <p className="text-[#86868b] text-sm leading-relaxed">
                                自动检测地图边界、主权表述及敏感用语。实时联网 Google Search 校验，确保出版安全。
                            </p>
                        </div>
                    </div>
                    
                    {/* Logic & Duplication Card */}
                    <div className="apple-card p-8 rounded-[30px] flex flex-col justify-between h-64 hover:scale-[1.02] transition-transform duration-500">
                        <div>
                            <Fingerprint className="w-10 h-10 text-purple-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">查重与逻辑</h3>
                            <p className="text-[#86868b] text-sm leading-relaxed">
                                深度分析题目逻辑闭环，识别前后文中不必要的重复题目，确保内容精炼准确。
                            </p>
                        </div>
                    </div>

                     {/* Math Verification Card */}
                     <div className="apple-card p-8 rounded-[30px] flex flex-col justify-between h-64 hover:scale-[1.02] transition-transform duration-500">
                        <div>
                            <Calculator className="w-10 h-10 text-blue-500 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">数学深度验算</h3>
                            <p className="text-[#86868b] text-sm leading-relaxed">
                                后台自动演算每一道例题与习题。GB 3102.11 符号标准自动纠错。
                            </p>
                        </div>
                    </div>
                </div>

                {/* Upload Section - The "Pro" Area */}
                <div className="bg-white rounded-[32px] shadow-xl shadow-black/5 p-2 overflow-hidden border border-black/5">
                    <div className="p-10 text-center space-y-8">
                        {!currentFile ? (
                            <div className="py-10">
                                <FileUpload onFileSelect={handleFileSelect} onError={(m) => setErrorMsg(m)} />
                            </div>
                        ) : (
                            <div className="animate-scale-up">
                                <div className="flex items-center justify-between bg-[#F5F5F7] p-5 rounded-2xl mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600">
                                            <FileCheck />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold text-lg">{currentFile.name}</div>
                                            <div className="text-sm text-gray-500">{(currentFile.size/1024/1024).toFixed(1)} MB</div>
                                        </div>
                                    </div>
                                    <button onClick={() => setCurrentFile(null)} className="text-gray-400 hover:text-red-500"><Trash2 /></button>
                                </div>
                                
                                {/* Knowledge Base Input */}
                                <div className="text-left mb-8">
                                    <label className="text-sm font-semibold text-gray-900 ml-2 mb-2 block flex items-center gap-2">
                                        <Library className="w-4 h-4 text-blue-500" />
                                        自定义知识库 / 审稿标准 (可选)
                                    </label>
                                    <div className="relative">
                                        <textarea 
                                            value={knowledgeBaseText}
                                            onChange={(e) => setKnowledgeBaseText(e.target.value)}
                                            placeholder="在此粘贴特定的排版要求、禁止词汇或参考链接..."
                                            className="w-full bg-[#F5F5F7] border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500/50 min-h-[100px] resize-none"
                                        />
                                        <div className="absolute bottom-3 right-3 flex gap-2">
                                            <input type="file" ref={refFileInputRef} accept="application/pdf" className="hidden" onChange={handleRefFileSelect} />
                                            <button onClick={() => refFileInputRef.current?.click()} className="bg-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm text-gray-600 hover:text-blue-600 flex items-center gap-2">
                                                {isExtractingRef ? <span className="animate-spin">⌛</span> : <Upload className="w-3 h-3"/>}
                                                {refFileName ? '已加载 PDF' : '上传标准 PDF'}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={startProcessing}
                                    className="w-full bg-[#0071e3] hover:bg-[#0077ED] text-white text-lg font-semibold py-5 rounded-full transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-[0.99]"
                                >
                                    开始智能审阅
                                </button>
                            </div>
                        )}
                        
                        {errorMsg && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {errorMsg}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Processing / Result View */}
        {(appState === AppState.PROCESSING || appState === AppState.COMPLETED) && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                <ProgressBar 
                    current={status.current} 
                    total={status.total} 
                    status={status.currentStage} 
                    results={results}
                    pageOffset={pageOffset}
                    activePageIndices={activePageIndices}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {appState === AppState.PROCESSING && !stopProcessingRef.current && (
                        <button 
                            onClick={handleStop}
                            className="col-span-full bg-white border border-gray-200 text-red-500 font-semibold py-4 rounded-2xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                        >
                            <PauseCircle className="w-5 h-5" />
                            立即停止审阅
                        </button>
                    )}

                    {(appState === AppState.COMPLETED || stopProcessingRef.current || results.some(r => r && !r.includes('error-card'))) && (
                        <button 
                            onClick={() => downloadReport(results, currentFile?.name || 'report', pageOffset)}
                            className="col-span-full bg-[#06c] text-white font-semibold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                        >
                            <Download className="w-5 h-5" />
                            下载 HTML 审阅报告
                        </button>
                    )}
                </div>
            </div>
        )}
      </main>

      {/* History Modal - Glassmorphism */}
      {showHistoryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/20 backdrop-blur-md" onClick={() => setShowHistoryModal(false)}>
              <div className="bg-white w-full max-w-lg max-h-[80vh] rounded-[24px] shadow-2xl overflow-hidden flex flex-col animate-scale-up" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                      <h3 className="font-bold text-lg">历史归档</h3>
                      <button onClick={() => setShowHistoryModal(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><X className="w-4 h-4"/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-[#F5F5F7]">
                      {history.length === 0 ? <p className="text-center text-gray-400 py-10">暂无记录</p> : history.map(r => <HistoryItem key={r.id} record={r} onDownload={downloadReport} />)}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
