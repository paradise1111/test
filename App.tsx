
import React, { useState, useCallback, useRef, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ProgressBar from './components/ProgressBar';
import { AppState, ProcessingStatus, ReportRecord } from './types';
import { loadPdf, renderPageToImage, createSubsetPdf, extractTextFromPdf } from './services/pdfService';
import { analyzePageContent } from './services/geminiService';
import { HTML_TEMPLATE_START, HTML_TEMPLATE_END } from './constants';
import { BookOpen, FileCheck, AlertCircle, PauseCircle, Settings, RotateCw, Download, ChevronLeft, History, FileOutput, Trash2, ChevronDown, ChevronUp, CheckCircle2, Clock, X, Library, Upload, Link } from 'lucide-react';

// --- Sub-component for individual history items ---
const HistoryItem: React.FC<{ 
    record: ReportRecord; 
    onDownload: (r: string[], n: string, o: number) => void; 
}> = ({ record, onDownload }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const failedCount = record.totalProcessed - record.successCount;
    const hasErrors = failedCount > 0;

    return (
        <div className={`border rounded-xl transition-all duration-200 overflow-hidden ${
            hasErrors 
                ? 'bg-white border-red-200 shadow-sm hover:shadow-md' 
                : 'bg-white border-gray-200 shadow-sm hover:shadow-md'
        }`}>
            {/* Header - Clickable to toggle */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-4 flex items-center justify-between cursor-pointer select-none ${
                    hasErrors ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-gray-50'
                }`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`flex-shrink-0 p-2 rounded-full ${
                        hasErrors ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                    }`}>
                        {hasErrors ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                        <div className={`font-bold truncate ${hasErrors ? 'text-red-900' : 'text-gray-900'}`}>
                            {record.fileName}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(record.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        {hasErrors ? (
                             <div className="flex flex-col items-end">
                                <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                    {failedCount} 页异常
                                </span>
                                <span className="text-[10px] text-gray-400 mt-0.5">共 {record.totalProcessed} 页</span>
                             </div>
                        ) : (
                            <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                {record.totalProcessed} 页全部完成
                            </span>
                        )}
                    </div>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-3 gap-2 text-center text-sm mb-2">
                        <div className="bg-white p-2 rounded border border-gray-100">
                            <div className="text-gray-400 text-xs uppercase">总页数</div>
                            <div className="font-mono font-bold text-gray-700">{record.totalProcessed}</div>
                        </div>
                        <div className="bg-white p-2 rounded border border-green-100">
                            <div className="text-green-600 text-xs uppercase">成功</div>
                            <div className="font-mono font-bold text-green-700">{record.successCount}</div>
                        </div>
                        <div className="bg-white p-2 rounded border border-red-100">
                            <div className="text-red-600 text-xs uppercase">失败</div>
                            <div className="font-mono font-bold text-red-700">{failedCount}</div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
                        <div className="text-xs text-gray-400 font-mono">
                            ID: {record.id.slice(-6)} | Offset: {record.pageOffset}
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDownload(record.results, record.fileName, record.pageOffset);
                            }}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm hover:shadow-md"
                        >
                            <Download className="w-4 h-4" />
                            下载完整报告 HTML
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Main App Component ---

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [status, setStatus] = useState<ProcessingStatus>({
    total: 0,
    current: 0,
    isProcessing: false,
    currentStage: '',
  });
  const [results, setResults] = useState<string[]>([]);
  // New state to track which specific pages are currently being processed by workers
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
  
  // 1. Load History on Mount
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
        try {
            const savedHistory = localStorage.getItem('math_edit_history');
            if (savedHistory) {
                const parsed = JSON.parse(savedHistory);
                if (Array.isArray(parsed)) {
                    setHistory(parsed);
                }
            }
        } catch (e) {
            console.error("Failed to load history from local storage", e);
        }
    }
  }, []);

  // 2. Persist History when it changes
  useEffect(() => {
      if (typeof localStorage !== 'undefined' && history.length > 0) {
          try {
              // Limit history to last 10 items to prevent QuotaExceededError
              const safeHistory = history.slice(0, 10);
              localStorage.setItem('math_edit_history', JSON.stringify(safeHistory));
          } catch (e) {
              console.warn("LocalStorage full, could not save history update.", e);
          }
      } else if (history.length === 0 && typeof localStorage !== 'undefined') {
          localStorage.removeItem('math_edit_history');
      }
  }, [history]);
  
  // Ref to control the stopping of the process
  const stopProcessingRef = useRef<boolean>(false);

  const handleFileSelect = (file: File) => {
    setCurrentFile(file);
    setErrorMsg(null);
    setResults([]);
    setActivePageIndices([]);
    setAppState(AppState.IDLE);
  };

  const handleFileError = (msg: string) => {
    setErrorMsg(msg);
    setCurrentFile(null);
    setAppState(AppState.ERROR);
  };

  const handleRefFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const file = e.target.files[0];
          setRefFileName(file.name);
          setIsExtractingRef(true);
          try {
              const text = await extractTextFromPdf(file);
              setKnowledgeBaseText(prev => prev + `\n\n--- 来自参考文件 ${file.name} ---\n` + text);
          } catch (err) {
              alert("无法读取参考文件: " + (err as Error).message);
              setRefFileName(null);
          } finally {
              setIsExtractingRef(false);
          }
      }
  };

  const handleStop = () => {
    stopProcessingRef.current = true;
    setStatus(prev => ({ ...prev, currentStage: '正在停止...' }));
  };

  const resetApp = () => {
      setAppState(AppState.IDLE);
      setResults([]);
      setActivePageIndices([]);
      setCurrentFile(null);
      setKnowledgeBaseText('');
      setRefFileName(null);
      setStatus({ total: 0, current: 0, isProcessing: false, currentStage: '' });
  };

  const getFailedPageNumbers = useCallback(() => {
    return results
      .map((html, index) => html && html.includes('error-card') ? index + 1 : -1)
      .filter(p => p !== -1);
  }, [results]);

  // Modified to accept results directly to avoid stale state in closures
  const archiveCurrentSession = useCallback((resultsToArchive: string[]) => {
    if (!currentFile || resultsToArchive.length === 0) return;
    
    const validPages = resultsToArchive.filter(r => r && !r.includes('error-card')).length;
    // Only skip if totally empty, otherwise allow partial saves
    if (resultsToArchive.filter(r => r).length === 0) return;

    const record: ReportRecord = {
        id: Date.now().toString(),
        fileName: currentFile.name,
        timestamp: Date.now(),
        totalProcessed: resultsToArchive.filter(r => r).length,
        successCount: validPages,
        results: [...resultsToArchive],
        pageOffset: pageOffset
    };

    setHistory(prev => {
        // Prevent duplicates if called multiple times quickly
        if (prev.length > 0 && prev[0].id === record.id) return prev;
        return [record, ...prev];
    });
  }, [currentFile, pageOffset]);

  const executeReview = async (pagesToProcess: number[], preserveResults: boolean) => {
    if (!currentFile) return;
    
    setAppState(AppState.PROCESSING);
    stopProcessingRef.current = false;
    setActivePageIndices([]);

    try {
      const pdf = await loadPdf(currentFile);
      const totalPages = pdf.numPages;
      
      let finalResults: string[];
      let completedCount = 0;

      if (preserveResults) {
        finalResults = [...results];
        completedCount = totalPages - pagesToProcess.length;
      } else {
        finalResults = new Array(totalPages).fill('');
        completedCount = 0;
      }

      setStatus({
        total: totalPages,
        current: completedCount,
        isProcessing: true,
        currentStage: '启动并行审阅引擎...',
      });

      // Increase concurrency to 5 for better speed
      const CONCURRENCY_LIMIT = 5; 
      const queue = [...pagesToProcess]; 
      
      const worker = async (workerId: number) => {
        while (queue.length > 0 && !stopProcessingRef.current) {
            const pageNum = queue.shift(); 
            if (!pageNum) break;

            // Add to active list for UI visualization
            setActivePageIndices(prev => [...prev, pageNum]);

            try {
                const imgData = await renderPageToImage(pdf, pageNum);
                const realPageNum = pageNum + (pageOffset - 1);
                // PASS KNOWLEDGE BASE HERE
                const html = await analyzePageContent(imgData, realPageNum, knowledgeBaseText);

                finalResults[pageNum - 1] = html;
                
                // Update status immediately
                setResults([...finalResults]); 

            } catch (err) {
                console.error(`Error on page ${pageNum}`, err);
                const realPageNum = pageNum + (pageOffset - 1);
                
                const errorHtml = `
                    <div class="page-review error-card" id="page-${realPageNum}">
                        <div class="page-header">
                            <h2 class="page-title">第 ${realPageNum} 页 (PDF ${pageNum}) - ⚠️ 审阅失败</h2>
                        </div>
                        <div class="review-section">
                             <p>网络超时或系统繁忙，此页已跳过。建议导出为新PDF单独处理。</p>
                        </div>
                    </div>`;
                finalResults[pageNum - 1] = errorHtml;
                setResults([...finalResults]);
            } finally {
                // CRITICAL FIX: Always increment completed count, even if error occurred,
                // so the progress bar reaches 100%.
                completedCount++;
                setStatus(prev => ({ ...prev, current: completedCount }));
                
                // Remove from active list
                setActivePageIndices(prev => prev.filter(p => p !== pageNum));
            }
        }
      };

      const activeWorkersCount = Math.min(pagesToProcess.length, CONCURRENCY_LIMIT);
      const workers = Array(activeWorkersCount)
        .fill(null)
        .map((_, i) => worker(i + 1));

      await Promise.all(workers);

      setStatus(prev => ({ 
          ...prev, 
          currentStage: '全书处理完成' 
      }));
      
      setAppState(AppState.COMPLETED);
      // Pass results directly to avoid stale closure issues
      archiveCurrentSession(finalResults);

    } catch (err) {
      console.error(err);
      // Even on error, save what we have
      setErrorMsg((err as Error).message || "发生了意外错误。");
      setAppState(AppState.ERROR);
    } finally {
      setStatus(prev => ({ ...prev, isProcessing: false }));
      stopProcessingRef.current = false;
      setActivePageIndices([]);
    }
  };

  const startProcessing = async () => {
    if (!currentFile) return;

    try {
        const pdf = await loadPdf(currentFile); 
        const totalPages = pdf.numPages;
        const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
        
        await executeReview(allPages, false);
    } catch (error) {
        console.error("Processing start error:", error);
        setErrorMsg("启动失败：可能是 PDF 组件未能从网络加载，请检查网络连接。" + (error as Error).message);
        setAppState(AppState.ERROR);
    }
  };

  const handleRetryFailed = async () => {
    const failedPages = getFailedPageNumbers();
    if (failedPages.length === 0) return;
    await executeReview(failedPages, true);
  };

  const exportFailedPages = async () => {
    if (!currentFile) return;
    const failedPages = getFailedPageNumbers();
    if (failedPages.length === 0) return;

    try {
        setStatus(prev => ({ ...prev, currentStage: '正在生成补漏文件...' }));
        const newPdfBytes = await createSubsetPdf(currentFile, failedPages);
        
        const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const namePart = currentFile.name.replace('.pdf', '');
        a.download = `${namePart}_待补漏_${failedPages.length}页.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setStatus(prev => ({ ...prev, currentStage: '补漏文件已导出。' }));
    } catch (e) {
        alert(`导出失败: ${(e as Error).message}`);
    }
  };

  const generateFullHtml = (recordResults: string[], fileName: string, offset: number) => {
    if (!recordResults || recordResults.length === 0) return '';

    let navLinks = '';
    recordResults.forEach((html, index) => {
        if (!html) return;
        const realPage = index + offset;
        const isError = html.includes('error-card');
        const style = isError ? 'color: #ef4444;' : '';
        navLinks += `<a href="#page-${realPage}" style="${style}">第 ${realPage} 页${isError ? ' (缺失)' : ''}</a>`;
    });
    
    const templateWithNav = HTML_TEMPLATE_START + navLinks + '</div></div>';
    return templateWithNav + recordResults.join('\n') + HTML_TEMPLATE_END;
  };

  const downloadReport = (recordResults: string[], fileName: string, offset: number) => {
    const fullHtml = generateFullHtml(recordResults, fileName, offset);
    if (!fullHtml) return;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName.replace('.pdf', '')}_数学审稿报告.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const failedCount = getFailedPageNumbers().length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-md shadow-blue-200">
                <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">MathEdit AI</h1>
                <p className="text-xs text-gray-500 hidden sm:block">数学规范审稿 & 智能验算</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* History Button */}
            <button 
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            >
                <History className="w-5 h-5" />
                <span className="hidden sm:inline">历史记录</span>
            </button>

            {appState !== AppState.IDLE && (
                <button 
                    onClick={resetApp} 
                    title="重置应用"
                    className="text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 ml-2 p-2 hover:bg-gray-100 rounded-lg"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
            
            {/* Phase 1: Upload Configuration */}
            {(appState === AppState.IDLE || appState === AppState.ERROR) && (
                <div className="space-y-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 transition-all duration-500 ease-in-out">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-gray-900">
                                <FileCheck className="w-7 h-7 text-blue-600" />
                                上传数学稿件
                            </h2>
                            <p className="text-gray-500">系统将自动进行图文校验、术语规范检查及<span className="font-bold text-blue-600">算式验算</span>。</p>
                        </div>

                        <FileUpload 
                            onFileSelect={handleFileSelect} 
                            onError={handleFileError}
                            disabled={false}
                        />

                        {currentFile && (
                            <div className="mt-8 space-y-6 animate-fade-in">
                                <div className="p-4 bg-blue-50 text-blue-900 rounded-xl border border-blue-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="bg-white p-2 rounded-lg">
                                            <Settings className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="truncate">
                                            <div className="font-semibold truncate">{currentFile.name}</div>
                                            <div className="text-xs opacity-70">{(currentFile.size / 1024 / 1024).toFixed(1)} MB</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                        <div>
                                            <div className="font-medium text-gray-900">起始页码</div>
                                            <div className="text-xs text-gray-500">PDF第1页对应页码</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={pageOffset}
                                                onChange={(e) => setPageOffset(Math.max(1, parseInt(e.target.value) || 1))}
                                                className="w-20 px-2 py-1.5 text-right text-lg font-mono font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Knowledge Base Section */}
                                <div className="bg-white border border-indigo-100 rounded-xl p-5 shadow-sm">
                                    <h3 className="text-md font-bold text-indigo-900 mb-3 flex items-center gap-2">
                                        <Library className="w-5 h-5 text-indigo-600" />
                                        自定义知识库 / 审稿标准
                                    </h3>
                                    <p className="text-xs text-gray-500 mb-4">
                                        您可以上传参考文件（如排版规范、术语表 PDF）或直接粘贴文本。AI 将优先依据这些资料进行审阅。
                                    </p>
                                    
                                    <div className="space-y-3">
                                        {/* File Upload Button for Reference */}
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="file" 
                                                ref={refFileInputRef}
                                                accept="application/pdf"
                                                onChange={handleRefFileSelect}
                                                className="hidden"
                                            />
                                            <button 
                                                onClick={() => refFileInputRef.current?.click()}
                                                disabled={isExtractingRef}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors"
                                            >
                                                {isExtractingRef ? <RotateCw className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4" />}
                                                {refFileName ? '更换参考文件' : '上传参考 PDF'}
                                            </button>
                                            {refFileName && (
                                                <span className="text-sm text-indigo-800 bg-indigo-50 px-2 py-1 rounded">
                                                    已加载: {refFileName}
                                                </span>
                                            )}
                                        </div>

                                        {/* Text Area for Direct Input */}
                                        <div className="relative">
                                            <Link className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                                            <textarea
                                                value={knowledgeBaseText}
                                                onChange={(e) => setKnowledgeBaseText(e.target.value)}
                                                placeholder="在此处粘贴具体的排版规则、链接或术语定义..."
                                                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={startProcessing}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    开始并行审阅
                                </button>
                            </div>
                        )}

                        {appState === AppState.ERROR && errorMsg && (
                            <div className="mt-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 animate-pulse">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold">无法继续</h4>
                                    <p className="text-sm">{errorMsg}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Phase 2: Progress & Visualization */}
            {(appState === AppState.PROCESSING || appState === AppState.COMPLETED) && (
                <div className="animate-fade-in-up space-y-6">
                     <ProgressBar 
                        current={status.current} 
                        total={status.total} 
                        status={status.currentStage} 
                        results={results}
                        pageOffset={pageOffset}
                        activePageIndices={activePageIndices}
                    />

                    {/* 区域划分：结果处理区 */}
                    <div className="grid grid-cols-1 gap-6">
                        
                        {/* 1. 成功结果下载区 */}
                        {(appState === AppState.COMPLETED || results.some(r => r && !r.includes('error-card'))) && (
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <FileCheck className="w-5 h-5 text-green-600" />
                                    审阅成果
                                </h3>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button 
                                        onClick={() => downloadReport(results, currentFile?.name || 'report', pageOffset)}
                                        className="flex-1 group bg-green-600 hover:bg-green-700 text-white font-bold text-lg py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3"
                                    >
                                        <Download className="w-5 h-5" />
                                        下载报告 (.html)
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 text-center">提示：下载的文件包含完整结果，可在任何设备直接打开</p>
                            </div>
                        )}

                        {/* 2. 失败页面处理区 */}
                        {failedCount > 0 && (
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold flex items-center gap-2 text-red-800">
                                        <AlertCircle className="w-5 h-5 text-red-600" />
                                        异常处理专区
                                    </h3>
                                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                                        {failedCount} 页失败
                                    </span>
                                </div>
                                
                                <p className="text-sm text-gray-600 mb-6 bg-red-50 p-3 rounded-lg border border-red-100">
                                    由于数据量过大导致连接中断？建议将失败页面导出为独立的 PDF 文件，重新上传进行审阅。
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button 
                                        onClick={exportFailedPages}
                                        className="flex items-center justify-center gap-2 bg-white border-2 border-blue-600 text-blue-700 hover:bg-blue-50 font-bold py-3 px-4 rounded-xl transition-all"
                                    >
                                        <FileOutput className="w-5 h-5" />
                                        导出失败页 PDF
                                    </button>
                                    <button 
                                        onClick={handleRetryFailed}
                                        className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md"
                                    >
                                        <RotateCw className="w-5 h-5" />
                                        尝试原位重试
                                    </button>
                                </div>
                            </div>
                        )}

                        {appState === AppState.PROCESSING && (
                            <button 
                                onClick={handleStop}
                                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <PauseCircle className="w-5 h-5" />
                                停止并保存当前进度
                            </button>
                        )}
                    </div>
                </div>
            )}
      </main>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-fade-in">
            <div 
                className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <History className="w-5 h-5 text-blue-600"/>
                        审阅历史归档
                    </h3>
                    <button 
                        onClick={() => setShowHistoryModal(false)}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                    >
                        <X className="w-5 h-5"/>
                    </button>
                </div>

                {/* Modal Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-gray-50/50">
                    {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                            <History className="w-12 h-12 mb-3 opacity-20" />
                            <p>暂无历史审阅记录</p>
                        </div>
                    ) : (
                        history.map((record) => (
                            <HistoryItem 
                                key={record.id} 
                                record={record} 
                                onDownload={downloadReport} 
                            />
                        ))
                    )}
                </div>

                {/* Modal Footer */}
                {history.length > 0 && (
                    <div className="p-4 border-t border-gray-100 bg-white flex justify-end">
                        <button 
                            onClick={() => {
                                if(confirm("确定要清空所有历史记录吗？此操作不可恢复。")) {
                                    setHistory([]);
                                    if (typeof localStorage !== 'undefined') localStorage.removeItem('math_edit_history');
                                }
                            }}
                            className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1.5 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors font-medium"
                        >
                            <Trash2 className="w-4 h-4" /> 
                            清空所有记录
                        </button>
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
}

export default App;
