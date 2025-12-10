
import React, { useState, useCallback, useRef, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ProgressBar from './components/ProgressBar';
import ReportPreview from './components/ReportPreview';
import RefineModal from './components/RefineModal';
import LoginScreen from './components/LoginScreen';
import { AppState, ProcessingStatus, ReportRecord, ApiSettings, AiProvider } from './types';
import { loadPdf, renderPageToImage, createSubsetPdf, extractTextFromPdf } from './services/pdfService';
import { analyzePageContent, extractLearningRule, saveApiSettings, getApiSettings, clearApiSettings, fetchModels } from './services/geminiService';
import { HTML_TEMPLATE_START, HTML_TEMPLATE_END } from './constants';
import { BookOpen, FileCheck, AlertCircle, PauseCircle, RotateCw, Download, ChevronLeft, History, FileOutput, Trash2, ChevronDown, ChevronUp, CheckCircle2, Clock, X, Library, Upload, Link, Sparkles, Calculator, Brain, Search, Zap, Sigma, LogOut, Settings } from 'lucide-react';

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

// Provider-specific default models to use if automatic fetching fails or is empty
const PROVIDER_DEFAULTS: Record<AiProvider, string[]> = {
    google: [
        'gemini-2.5-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro-latest'
    ],
    openai: [
        // OpenAI
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        // xAI (Grok)
        'grok-2-vision-1212',
        'grok-2-1212',
        'grok-beta',
        // DeepSeek
        'deepseek-chat',
        'deepseek-reasoner'
    ],
    anthropic: [
        'claude-3-5-sonnet-20240620',
        'claude-3-opus-20240229',
        'claude-3-haiku-20240307'
    ]
};

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.LOGIN);
  const [status, setStatus] = useState<ProcessingStatus>({
    total: 0,
    current: 0,
    isProcessing: false,
    currentStage: '',
  });
  const [results, setResults] = useState<string[]>([]);
  const [activePageIndices, setActivePageIndices] = useState<number[]>([]);
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [pageOffset, setPageOffset] = useState<number>(1);
  const [history, setHistory] = useState<ReportRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Model Selection State
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [provider, setProvider] = useState<AiProvider>('google');
  
  const [enableSearch, setEnableSearch] = useState<boolean>(true);
  const [enableSolutions, setEnableSolutions] = useState<boolean>(false);

  const [knowledgeBaseText, setKnowledgeBaseText] = useState<string>('');
  const [refFileName, setRefFileName] = useState<string | null>(null);
  const [isExtractingRef, setIsExtractingRef] = useState(false);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  const [learnedRules, setLearnedRules] = useState<string[]>([]);
  const [showRefineModal, setShowRefineModal] = useState(false);
  const [refinePageIndex, setRefinePageIndex] = useState<number | null>(null);
  const [isRefining, setIsRefining] = useState(false);

  // Controller for aborting requests immediately
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to load models
  const loadModelsForProvider = async (currentProvider: AiProvider) => {
    const models = await fetchModels();
    if (models.length > 0) {
        setAvailableModels(models);
        // If current selected model is not in new list, pick first
        if (!models.includes(selectedModel)) {
            setSelectedModel(models[0]);
        }
    } else {
        // Fallback to static defaults
        const defaults = PROVIDER_DEFAULTS[currentProvider] || PROVIDER_DEFAULTS.google;
        setAvailableModels(defaults);
        if (!defaults.includes(selectedModel)) {
            setSelectedModel(defaults[0]);
        }
    }
  };

  useEffect(() => {
    // Check for login status
    const settings = getApiSettings();
    if (settings) {
        setAppState(AppState.IDLE);
        setProvider(settings.provider);
        loadModelsForProvider(settings.provider);
    } else {
        setAppState(AppState.LOGIN);
    }
    
    // ... rest of restoration logic ...
    if (typeof localStorage !== 'undefined') {
        try {
            const savedHistory = localStorage.getItem('math_edit_history');
            if (savedHistory) {
                const parsed = JSON.parse(savedHistory);
                if (Array.isArray(parsed)) setHistory(parsed);
            }
        } catch (e) { console.error(e); }

        try {
            const savedRules = localStorage.getItem('math_edit_learned_rules');
            if (savedRules) {
                const parsed = JSON.parse(savedRules);
                if (Array.isArray(parsed)) setLearnedRules(parsed);
            }
        } catch (e) { console.error(e); }

        try {
            const savedSession = localStorage.getItem('math_edit_current_session');
            if (savedSession) {
                const session = JSON.parse(savedSession);
                if (session.results && session.results.length > 0) {
                    setResults(session.results);
                    setStatus(session.status);
                    setPageOffset(session.pageOffset || 1);
                    if (settings) {
                        setAppState(AppState.COMPLETED);
                    }
                }
            }
        } catch (e) { console.error("Failed to restore session", e); }
    }
  }, []);

  useEffect(() => {
      if (typeof localStorage !== 'undefined') {
          if (history.length > 0) {
              const safeHistory = history.slice(0, 10);
              localStorage.setItem('math_edit_history', JSON.stringify(safeHistory));
          }
          localStorage.setItem('math_edit_learned_rules', JSON.stringify(learnedRules));
          
          if (results.length > 0) {
             localStorage.setItem('math_edit_current_session', JSON.stringify({
                 results,
                 status,
                 pageOffset,
                 fileName: currentFile?.name || 'Restored Session'
             }));
          }
      }
  }, [history, learnedRules, results, status, pageOffset, currentFile]);
  
  const handleLogin = async (settings: ApiSettings) => {
      saveApiSettings(settings);
      setAppState(AppState.IDLE);
      setProvider(settings.provider);
      await loadModelsForProvider(settings.provider);
  };

  const handleSettings = () => {
      setAppState(AppState.LOGIN);
  };

  const handleLogout = () => {
      clearApiSettings();
      setAppState(AppState.LOGIN);
      setCurrentFile(null);
      setResults([]);
      localStorage.removeItem('math_edit_current_session');
  };

  const handleFileSelect = (file: File) => {
    setCurrentFile(file);
    setErrorMsg(null);
    setResults([]);
    setActivePageIndices([]);
    setAppState(AppState.IDLE);
    localStorage.removeItem('math_edit_current_session');
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
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }
    setStatus(prev => ({ 
        ...prev, 
        isProcessing: false, 
        currentStage: '已手动停止 (Stopped)' 
    }));
    setActivePageIndices([]);
  };

  const resetApp = () => {
      handleStop(); 
      setAppState(AppState.IDLE);
      setResults([]);
      setActivePageIndices([]);
      setCurrentFile(null);
      setKnowledgeBaseText('');
      setRefFileName(null);
      setStatus({ total: 0, current: 0, isProcessing: false, currentStage: '' });
      localStorage.removeItem('math_edit_current_session');
  };

  const getFailedPageNumbers = useCallback(() => {
    return results
      .map((html, index) => html && html.includes('error-card') ? index + 1 : -1)
      .filter(p => p !== -1);
  }, [results]);

  const archiveCurrentSession = useCallback((resultsToArchive: string[]) => {
    if (resultsToArchive.length === 0) return;
    const validPages = resultsToArchive.filter(r => r && !r.includes('error-card')).length;
    if (resultsToArchive.filter(r => r).length === 0) return;

    const record: ReportRecord = {
        id: Date.now().toString(),
        fileName: currentFile?.name || 'Unnamed Session',
        timestamp: Date.now(),
        totalProcessed: resultsToArchive.filter(r => r).length,
        successCount: validPages,
        results: [...resultsToArchive],
        pageOffset: pageOffset
    };

    setHistory(prev => {
        if (prev.length > 0 && prev[0].id === record.id) return prev;
        return [record, ...prev];
    });
  }, [currentFile, pageOffset]);

  const openRefineModal = (index: number) => {
      setRefinePageIndex(index);
      setShowRefineModal(true);
  };

  const handleRefineSubmit = async (feedback: string, correctedText: string, addToMemory: boolean) => {
      if (refinePageIndex === null) return;
      
      setIsRefining(true);
      const pageNum = refinePageIndex + 1;
      const realPageNum = pageNum + (pageOffset - 1);
      const previousHtml = results[refinePageIndex];
      
      try {
          if (correctedText) {
              if (addToMemory) {
                  const newRule = await extractLearningRule(previousHtml, correctedText, selectedModel);
                  setLearnedRules(prev => [...prev, newRule]);
              }
              const userHtmlWrapper = `
                <div class="page-review" id="page-${realPageNum}">
                    <div class="page-header">
                        <h2 class="page-title">PAGE ${realPageNum} · 人工修订版</h2>
                    </div>
                    <div class="audit-panel" style="display:none"></div>
                    <div class="revision-document">
                        <h3 class="panel-title">✍️ 人工修订定稿</h3>
                        <div class="document-content">
                            ${correctedText}
                        </div>
                    </div>
                </div>
              `;
              setResults(prev => {
                  const next = [...prev];
                  next[refinePageIndex] = userHtmlWrapper;
                  return next;
              });

          } else {
              if (addToMemory) {
                  setLearnedRules(prev => [...prev, feedback]);
              }
              const currentRules = addToMemory ? [...learnedRules, feedback] : learnedRules;
              
              if (!currentFile) throw new Error("PDF source missing.");
              
              const pdf = await loadPdf(currentFile);
              const imgData = await renderPageToImage(pdf, pageNum);

              const newHtml = await analyzePageContent(
                  imgData, 
                  realPageNum, 
                  knowledgeBaseText, 
                  selectedModel, 
                  enableSearch, 
                  enableSolutions,
                  currentRules, 
                  { previousHtml, feedback }
              );

              setResults(prev => {
                  const next = [...prev];
                  next[refinePageIndex] = newHtml;
                  return next;
              });
          }
          
          setShowRefineModal(false);
          setRefinePageIndex(null);
      } catch (err) {
          alert("优化失败: " + (err as Error).message);
      } finally {
          setIsRefining(false);
      }
  };

  const executeReview = async (pagesToProcess: number[], preserveResults: boolean) => {
    if (!currentFile) return;
    
    setAppState(AppState.PROCESSING);
    setActivePageIndices([]);
    
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

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
        currentStage: '启动智能审阅引擎...',
      });

      // Simple concurrency logic: 
      // Google Flash = 4
      // OpenAI/Anthropic usually have lower rate limits on tier 1, conserve to 2.
      const CONCURRENCY_LIMIT = (provider === 'google' && selectedModel.includes('flash')) ? 4 : 2;
      
      const queue = [...pagesToProcess]; 
      
      const worker = async (workerId: number) => {
        while (queue.length > 0) {
            if (signal.aborted) break;

            const pageNum = queue.shift(); 
            if (!pageNum) break;

            setActivePageIndices(prev => [...prev, pageNum]);

            try {
                if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
                
                const imgData = await renderPageToImage(pdf, pageNum);
                const realPageNum = pageNum + (pageOffset - 1);
                
                if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

                const html = await analyzePageContent(
                    imgData, 
                    realPageNum, 
                    knowledgeBaseText, 
                    selectedModel, 
                    enableSearch, 
                    enableSolutions,
                    learnedRules,
                    undefined,
                    signal
                );

                if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

                finalResults[pageNum - 1] = html;
                setResults([...finalResults]); 

            } catch (err: any) {
                if (err.name === 'AbortError' || signal.aborted) break; 

                console.error(`Error on page ${pageNum}`, err);
                const realPageNum = pageNum + (pageOffset - 1);
                const errorHtml = `
                    <div class="page-review error-card" id="page-${realPageNum}">
                        <div class="page-header">
                            <h2 class="page-title">PAGE ${realPageNum} // ERROR REPORT</h2>
                        </div>
                        <div class="review-section">
                             <div class="suggestion-item">
                                <span class="tag tag-error">处理失败</span>
                                <span>${err.message || "未知错误"}</span>
                            </div>
                        </div>
                    </div>`;
                finalResults[pageNum - 1] = errorHtml;
                setResults([...finalResults]);
            } finally {
                if (!signal.aborted) {
                    completedCount++;
                    setStatus(prev => ({ ...prev, current: completedCount }));
                }
                setActivePageIndices(prev => prev.filter(p => p !== pageNum));
            }
        }
      };

      const activeWorkersCount = Math.min(pagesToProcess.length, CONCURRENCY_LIMIT);
      const workers = Array(activeWorkersCount).fill(null).map((_, i) => worker(i + 1));

      await Promise.all(workers);

      if (!signal.aborted) {
        setStatus(prev => ({ ...prev, currentStage: '全书处理完成' }));
        setAppState(AppState.COMPLETED);
        archiveCurrentSession(finalResults);
      } else {
         setAppState(AppState.PROCESSING); 
      }

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setErrorMsg((err as Error).message || "发生了意外错误。");
      setAppState(AppState.ERROR);
    } finally {
      setStatus(prev => ({ ...prev, isProcessing: false }));
      setActivePageIndices([]);
      abortControllerRef.current = null;
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
        const styleClass = isError ? 'nav-link error' : 'nav-link';
        navLinks += `<a href="#page-${realPage}" class="${styleClass}">PAGE ${realPage}${isError ? ' / ERROR' : ''}</a>`;
    });
    
    const templateWithNav = HTML_TEMPLATE_START.replace('<!--NAV_LINKS_PLACEHOLDER-->', navLinks);
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

  if (appState === AppState.LOGIN) {
      return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen font-sans bg-gradient-to-br from-indigo-50 via-white to-blue-50 text-slate-900 pb-20">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg shadow-lg shadow-blue-200">
                <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
                <h1 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700 tracking-tight">MathEdit AI</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 rounded-full transition-all border border-transparent hover:border-blue-100"
            >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">历史归档</span>
            </button>
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            <button 
                onClick={handleSettings}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                title="设置 API Key"
            >
                <Settings className="w-5 h-5" />
            </button>
            <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                title="退出并清除配置"
            >
                <LogOut className="w-5 h-5" />
            </button>
            {appState !== AppState.IDLE && appState !== AppState.ERROR && (
                <button 
                    onClick={resetApp} 
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all ml-2 border-l border-slate-100"
                    title="返回首页"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
            {(appState === AppState.IDLE || appState === AppState.ERROR) && (
                <div className="space-y-12 animate-fade-in">
                    <div className="text-center space-y-6 py-8">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-semibold mb-2">
                             <Sparkles className="w-4 h-4" /> 
                             {selectedModel} ({provider === 'google' ? 'Google' : provider === 'openai' ? 'OpenAI/Compatible' : 'Anthropic'})
                        </div>
                        <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
                            重新定义 <span className="text-blue-600">数学出版</span> 审阅流程
                        </h2>
                        <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                            全自动校验术语规范、排版逻辑，并执行<span className="text-slate-800 font-semibold underline decoration-blue-300 decoration-2 underline-offset-4">深度数学验算</span>。支持<strong>历史记忆学习</strong>与交互式优化。
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                        <div className="bg-white/60 backdrop-blur border border-white/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
                                <Calculator className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-2">智能数学验算</h3>
                            <p className="text-sm text-slate-500">自动提取题目中的算式进行后台计算，发现答案错误或逻辑矛盾。</p>
                        </div>
                        <div className="bg-white/60 backdrop-blur border border-white/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                                <Brain className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-2">历史记忆学习</h3>
                            <p className="text-sm text-slate-500">系统会自动记住您的偏好（如“不要修改xx”），在后续审阅中自动生效。</p>
                        </div>
                        <div className="bg-white/60 backdrop-blur border border-white/50 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
                                <Search className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-slate-800 mb-2">实时搜索溯源</h3>
                            <p className="text-sm text-slate-500">联网检索最新的定义和数据，并在报告中提供权威来源链接。</p>
                        </div>
                    </div>

                    <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl shadow-indigo-100/50 border border-slate-100 overflow-hidden">
                        <div className="p-1">
                            <FileUpload 
                                onFileSelect={handleFileSelect} 
                                onError={handleFileError}
                                disabled={false}
                            />
                        </div>

                        {currentFile && (
                            <div className="p-8 bg-slate-50/50 border-t border-slate-100 space-y-8 animate-slide-up">
                                <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <div className="bg-blue-600 p-3 rounded-lg">
                                        <FileCheck className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 truncate text-lg">{currentFile.name}</div>
                                        <div className="text-sm text-slate-500">{(currentFile.size / 1024 / 1024).toFixed(1)} MB · 准备就绪</div>
                                    </div>
                                    <button onClick={() => setCurrentFile(null)} className="text-slate-400 hover:text-red-500 p-2">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="flex flex-col p-4 bg-white rounded-xl border border-slate-200">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="font-bold text-slate-700">起始页码</div>
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={pageOffset}
                                                onChange={(e) => setPageOffset(Math.max(1, parseInt(e.target.value) || 1))}
                                                className="w-20 px-2 py-1 text-right text-lg font-mono font-bold border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div className="text-xs text-slate-500">PDF P1 = 实际页码 {pageOffset}</div>
                                    </div>

                                    <div className="bg-white p-4 rounded-xl border border-slate-200 col-span-1 md:col-span-2">
                                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                            <div className="font-bold text-slate-700">AI 模型与能力配置</div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                            <button 
                                                onClick={() => setEnableSearch(!enableSearch)}
                                                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${enableSearch ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200'} ${provider !== 'google' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                disabled={provider !== 'google'}
                                                title={provider !== 'google' ? "仅 Google Gemini 支持原生搜索工具" : ""}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-md ${enableSearch && provider === 'google' ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-200 text-gray-500'}`}>
                                                        <Search className="w-4 h-4" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className={`text-xs font-bold ${enableSearch && provider === 'google' ? 'text-emerald-900' : 'text-gray-500'}`}>搜索溯源</div>
                                                        <div className="text-[10px] text-gray-500">
                                                            {provider === 'google' ? '联网验证数据' : '当前模型不支持'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${enableSearch && provider === 'google' ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${enableSearch && provider === 'google' ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                                </div>
                                            </button>

                                            <button 
                                                onClick={() => setEnableSolutions(!enableSolutions)}
                                                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${enableSolutions ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-md ${enableSolutions ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-500'}`}>
                                                        <Sigma className="w-4 h-4" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className={`text-xs font-bold ${enableSolutions ? 'text-blue-900' : 'text-gray-500'}`}>智能解答模式</div>
                                                        <div className="text-[10px] text-gray-500">生成分步解析</div>
                                                    </div>
                                                </div>
                                                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${enableSolutions ? 'bg-blue-600' : 'bg-gray-300'}`}>
                                                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${enableSolutions ? 'translate-x-4' : 'translate-x-0'}`}></div>
                                                </div>
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">选择模型 (Select Model)</label>
                                            <div className="relative">
                                                <select
                                                    value={selectedModel}
                                                    onChange={(e) => setSelectedModel(e.target.value)}
                                                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8 font-medium"
                                                >
                                                    {availableModels.map(model => (
                                                        <option key={model} value={model}>{model}</option>
                                                    ))}
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                                                    <ChevronDown className="h-4 w-4" />
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400">
                                                {availableModels.length > 0 ? "列表已从服务器获取 (或使用厂商默认配置)。" : "正在加载模型列表..."}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white border border-pink-100 rounded-xl p-6 shadow-sm relative overflow-hidden group">
                                     <h3 className="text-md font-bold text-pink-900 mb-4 flex items-center gap-2">
                                        <Brain className="w-5 h-5 text-pink-600" />
                                        AI 进化记忆 (Learned Rules)
                                    </h3>
                                    {learnedRules.length > 0 ? (
                                        <ul className="space-y-2 mb-4">
                                            {learnedRules.map((rule, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm text-pink-800 bg-pink-50 p-2 rounded border border-pink-100">
                                                    <span className="bg-pink-200 text-pink-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5">{idx + 1}</span>
                                                    <span className="flex-1">{rule}</span>
                                                    <button 
                                                        onClick={() => setLearnedRules(prev => prev.filter((_, i) => i !== idx))}
                                                        className="text-pink-400 hover:text-pink-600"
                                                    >
                                                        <X className="w-4 h-4"/>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-slate-400 italic mb-2">暂无已学习的偏好规则。在审阅结果中点击“优化”并勾选“记在记忆中”可添加规则。</p>
                                    )}
                                </div>
                                
                                <div className="bg-white border border-indigo-100 rounded-xl p-6 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Library className="w-24 h-24 text-indigo-600" />
                                    </div>
                                    <h3 className="text-md font-bold text-indigo-900 mb-4 flex items-center gap-2">
                                        <Library className="w-5 h-5 text-indigo-600" />
                                        自定义审稿标准 (Knowledge Base)
                                    </h3>
                                    
                                    <div className="space-y-4 relative z-10">
                                        <div className="flex flex-wrap gap-3">
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
                                                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold transition-colors"
                                            >
                                                {isExtractingRef ? <RotateCw className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4" />}
                                                {refFileName ? '更换参考 PDF' : '上传标准 PDF'}
                                            </button>
                                            {refFileName && (
                                                <span className="flex items-center gap-2 text-sm text-indigo-800 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                                                    <FileCheck className="w-3 h-3"/> 已加载: {refFileName}
                                                </span>
                                            )}
                                        </div>

                                        <div className="relative">
                                            <Link className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                            <textarea
                                                value={knowledgeBaseText}
                                                onChange={(e) => setKnowledgeBaseText(e.target.value)}
                                                placeholder="粘贴具体的排版规则、链接或术语定义 (AI 将优先遵循此处内容)..."
                                                className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[100px] transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={startProcessing}
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-lg py-4 px-6 rounded-xl transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
                                >
                                    {selectedModel.includes('flash') || selectedModel.includes('haiku') || selectedModel.includes('mini') ? '⚡ 启动极速并行审阅 (会员版)' : '🧠 启动深度精准审阅 (会员版)'}
                                </button>
                            </div>
                        )}

                        {appState === AppState.ERROR && errorMsg && (
                            <div className="p-6 bg-red-50 border-t border-red-100">
                                <div className="flex items-start gap-3 text-red-700">
                                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-bold text-lg">无法继续</h4>
                                        <p className="text-sm mt-1 opacity-90">{errorMsg}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(appState === AppState.PROCESSING || appState === AppState.COMPLETED) && (
                <div className="max-w-4xl mx-auto animate-fade-in-up space-y-8">
                     <ProgressBar 
                        current={status.current} 
                        total={status.total} 
                        status={status.currentStage} 
                        results={results}
                        pageOffset={pageOffset}
                        activePageIndices={activePageIndices}
                    />
                    
                    <ReportPreview 
                        results={results} 
                        onDownload={() => downloadReport(results, currentFile?.name || 'report', pageOffset)}
                        onRefine={openRefineModal}
                        pageOffset={pageOffset}
                    />

                    <div className="grid grid-cols-1 gap-6">
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
                                
                                <p className="text-sm text-slate-600 mb-6 bg-red-50 p-3 rounded-lg border border-red-100">
                                    部分页面因网络原因处理超时。您可以单独导出这些页面，或尝试原地重试。
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button 
                                        onClick={exportFailedPages}
                                        className="flex items-center justify-center gap-2 bg-white border-2 border-blue-100 text-blue-700 hover:border-blue-200 hover:bg-blue-50 font-bold py-3 px-4 rounded-xl transition-all"
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
                                className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <PauseCircle className="w-5 h-5" />
                                停止并保存当前进度
                            </button>
                        )}
                    </div>
                </div>
            )}
      </main>

      {showHistoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div 
                className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up border border-slate-100"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                        <History className="w-6 h-6 text-blue-600"/>
                        审阅历史归档
                    </h3>
                    <button 
                        onClick={() => setShowHistoryModal(false)}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                    >
                        <X className="w-5 h-5"/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30">
                    {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <History className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">暂无历史记录</p>
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

                {history.length > 0 && (
                    <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
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

      <RefineModal 
         isOpen={showRefineModal}
         onClose={() => setShowRefineModal(false)}
         onSubmit={handleRefineSubmit}
         pageNumber={refinePageIndex !== null ? refinePageIndex + pageOffset : 0}
         isProcessing={isRefining}
      />
    </div>
  );
}

export default App;
