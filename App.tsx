
import React, { useState, useCallback, useRef, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ProgressBar from './components/ProgressBar';
import { AppState, ProcessingStatus, ReportRecord } from './types';
import { loadPdf, renderPageToImage, createSubsetPdf } from './services/pdfService';
import { analyzePageContent, setCustomApiKey, clearCustomApiKey, getEnvApiKey, validateApiKey } from './services/geminiService';
import { HTML_TEMPLATE_START, HTML_TEMPLATE_END } from './constants';
import { BookOpen, FileCheck, AlertCircle, PauseCircle, Settings, RotateCw, Download, ChevronLeft, History, FileOutput, Trash2, Key, X, ExternalLink, Globe, Copy, LogOut, Loader2 } from 'lucide-react';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [status, setStatus] = useState<ProcessingStatus>({
    total: 0,
    current: 0,
    isProcessing: false,
    currentStage: '',
  });
  const [results, setResults] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [pageOffset, setPageOffset] = useState<number>(1);
  const [history, setHistory] = useState<ReportRecord[]>([]);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showShareAppModal, setShowShareAppModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  
  // 1. Load API Key on Mount
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
        const storedKey = localStorage.getItem('gemini_api_key');
        if (storedKey) {
            setApiKeyInput(storedKey);
        }
    }
  }, []);

  // 2. Load History on Mount
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

  // 3. Persist History when it changes
  useEffect(() => {
      if (typeof localStorage !== 'undefined' && history.length > 0) {
          try {
              // Limit history to last 10 items to prevent QuotaExceededError
              // since HTML content can be large.
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
    setAppState(AppState.IDLE);
  };

  const handleFileError = (msg: string) => {
    setErrorMsg(msg);
    setCurrentFile(null);
    setAppState(AppState.ERROR);
  };

  const handleStop = () => {
    stopProcessingRef.current = true;
    setStatus(prev => ({ ...prev, currentStage: '正在停止，准备归档已完成部分...' }));
  };

  const resetApp = () => {
      setAppState(AppState.IDLE);
      setResults([]);
      setCurrentFile(null);
      setStatus({ total: 0, current: 0, isProcessing: false, currentStage: '' });
  };

  const saveApiKey = async () => {
      const key = apiKeyInput.trim();
      if (!key) {
          setKeyError("请输入 API Key");
          return;
      }
      
      setIsValidatingKey(true);
      setKeyError(null);
      
      try {
          await validateApiKey(key);
          setCustomApiKey(key);
          setShowApiKeyModal(false);
          // Clear global error if it was key related
          if (appState === AppState.ERROR && errorMsg?.includes('Key')) {
             setAppState(AppState.IDLE);
             setErrorMsg(null);
          }
      } catch (err: any) {
          console.error(err);
          let msg = "验证失败：无法连接到 API。请检查网络。";
          const errMsg = err.message || '';
          
          if (errMsg.includes('403') || errMsg.includes('permission')) {
              msg = "验证失败 (403)：Key 无权限。请确保对应的 Google Cloud 项目已开启 'Generative Language API'。";
          } else if (errMsg.includes('404') || errMsg.includes('not found')) {
              msg = "验证失败 (404)：该 Key 无法访问 'gemini-3-pro-preview' 模型。请检查您的账户类型。";
          } else if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('400')) {
              msg = "验证失败：无效的 API Key。";
          }
          setKeyError(msg);
      } finally {
          setIsValidatingKey(false);
      }
  };
  
  const handleClearKey = () => {
      clearCustomApiKey();
      setApiKeyInput('');
      setKeyError(null);
      // Don't close modal immediately, let user input new one or close manually
  };

  const copyCurrentUrl = () => {
      navigator.clipboard.writeText(window.location.href);
      alert("网址已复制！\n注意：如果是本地或预览地址（如 localhost），其他人可能无法访问。");
  };

  // Identify which pages failed based on the HTML content
  const getFailedPageNumbers = useCallback(() => {
    return results
      .map((html, index) => html.includes('error-card') ? index + 1 : -1)
      .filter(p => p !== -1);
  }, [results]);

  // Save current results to history
  const archiveCurrentSession = useCallback(() => {
    if (!currentFile || results.length === 0) return;
    
    const validPages = results.filter(r => r && !r.includes('error-card')).length;
    if (validPages === 0) return; // Don't save empty sessions

    const record: ReportRecord = {
        id: Date.now().toString(),
        fileName: currentFile.name,
        timestamp: Date.now(),
        totalProcessed: results.filter(r => r).length,
        successCount: validPages,
        results: [...results],
        pageOffset: pageOffset
    };

    setHistory(prev => {
        // Prevent duplicates if archive is called multiple times for same session
        if (prev.length > 0 && prev[0].timestamp === record.timestamp) return prev;
        return [record, ...prev];
    });
  }, [currentFile, results, pageOffset]);

  /**
   * Core Review Execution Logic
   */
  const executeReview = async (pagesToProcess: number[], preserveResults: boolean) => {
    if (!currentFile) return;
    
    setAppState(AppState.PROCESSING);
    stopProcessingRef.current = false;

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
        currentStage: preserveResults 
            ? `准备重试 ${pagesToProcess.length} 个失败页面...` 
            : `共 ${totalPages} 页，启动并行审阅模式 (5路并发)...`,
      });

      // INCREASED CONCURRENCY:
      // We process up to 5 pages in parallel.
      // Combined with the rate-limit handling in geminiService, this speeds up processing significantly.
      const CONCURRENCY_LIMIT = 5; 
      const queue = [...pagesToProcess]; 
      
      const worker = async (workerId: number) => {
        while (queue.length > 0 && !stopProcessingRef.current) {
            const pageNum = queue.shift(); 
            if (!pageNum) break;

            try {
                // UI feedback: Only update stage text occasionally to avoid flickering
                if (queue.length % 2 === 0) {
                   setStatus(prev => ({ ...prev, currentStage: `正在并行验算中 (剩余 ${queue.length} 页)...` }));
                }

                const imgData = await renderPageToImage(pdf, pageNum);
                const realPageNum = pageNum + (pageOffset - 1);
                const html = await analyzePageContent(imgData, realPageNum);

                finalResults[pageNum - 1] = html;
                completedCount++;
                
                setStatus(prev => ({ ...prev, current: completedCount }));
                setResults([...finalResults]); 

            } catch (err) {
                console.error(`Error on page ${pageNum}`, err);
                const realPageNum = pageNum + (pageOffset - 1);
                
                if ((err as Error).message.includes("API Key")) {
                    throw err; 
                }

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
          currentStage: '处理完成，正在归档...' 
      }));
      
      setAppState(AppState.COMPLETED);

    } catch (err) {
      console.error(err);
      if ((err as Error).message.includes("API Key") || (err as Error).message.includes("未配置")) {
         setShowApiKeyModal(true);
         setErrorMsg("请先配置 API Key 才能继续。");
         setAppState(AppState.IDLE); 
      } else {
         setErrorMsg((err as Error).message || "发生了意外错误。");
         setAppState(AppState.ERROR);
      }
    } finally {
      setStatus(prev => ({ ...prev, isProcessing: false }));
      stopProcessingRef.current = false;
      
      if (results.length > 0) {
        setTimeout(() => {
            archiveCurrentSession();
        }, 100);
      }
    }
  };

  const startProcessing = async () => {
    if (!currentFile) return;
    
    // UX: Check for Key before starting
    const hasKey = !!(getEnvApiKey() || apiKeyInput.trim() || (typeof localStorage !== 'undefined' && localStorage.getItem('gemini_api_key')));
    
    if (!hasKey) {
        setShowApiKeyModal(true);
        return;
    }

    try {
        const pdf = await loadPdf(currentFile); 
        const totalPages = pdf.numPages;
        const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
        
        await executeReview(allPages, false);
    } catch (error) {
        console.error("Processing start error:", error);
        setErrorMsg("启动失败：可能是 PDF 组件未能从网络加载，请检查网络连接或刷新页面重试。" + (error as Error).message);
        setAppState(AppState.ERROR);
    }
  };

  const handleRetryFailed = async () => {
    const failedPages = getFailedPageNumbers();
    if (failedPages.length === 0) return;
    await executeReview(failedPages, true);
  };

  // Export Failed Pages as New PDF
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
            <button 
                onClick={() => setShowShareAppModal(true)}
                className="text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-blue-50"
                title="分享应用给他人"
            >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">分享应用</span>
            </button>
            <div className="h-6 w-px bg-gray-200 mx-1"></div>
            <button 
                onClick={() => setShowApiKeyModal(true)}
                className="text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-blue-50"
            >
                <Key className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline">设置 Key</span>
            </button>
            {appState !== AppState.IDLE && (
                <button onClick={resetApp} className="text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 ml-2">
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
          </div>
        </div>
      </header>

      {/* Share App Modal */}
      {showShareAppModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Globe className="w-5 h-5 text-blue-600" />
                          如何分享此应用？
                      </h3>
                      <button onClick={() => setShowShareAppModal(false)} className="text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="space-y-4 text-sm text-gray-600">
                      <div className="bg-blue-50 p-4 rounded-xl text-blue-800 border border-blue-100">
                          <p className="font-bold mb-1">为什么直接发网址别人打不开？</p>
                          <p className="opacity-90">如果您正在使用开发预览环境（如 IDX, StackBlitz 等），该网址通常是<strong>私有的</strong>，外部人员无法访问。</p>
                      </div>

                      <div>
                          <h4 className="font-bold text-gray-900 mb-2">正确的分享步骤：</h4>
                          <ol className="list-decimal list-inside space-y-2 pl-1">
                              <li>将本项目代码<strong>部署</strong>到公共服务器（如 Vercel, Netlify, GitHub Pages）。</li>
                              <li>将部署后的<strong>公开链接</strong>发送给您的朋友。</li>
                              <li>您的朋友打开后，点击右上角“设置 Key”输入他们自己的 Key 即可使用。</li>
                          </ol>
                      </div>

                      <div className="pt-4 border-t border-gray-100">
                           <div className="flex items-center gap-2 mb-2">
                                <span className="font-medium text-gray-900">当前网址：</span>
                                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded truncate flex-1">{window.location.href}</span>
                           </div>
                           <button 
                               onClick={copyCurrentUrl}
                               className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white py-2.5 rounded-lg font-medium transition-all"
                           >
                               <Copy className="w-4 h-4" />
                               尝试复制当前网址
                           </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          <Key className="w-5 h-5 text-blue-600" />
                          配置 API Key
                      </h3>
                      <button onClick={() => setShowApiKeyModal(false)} className="text-gray-400 hover:text-gray-600" disabled={isValidatingKey}>
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                      为了保护隐私及配额管理，请使用您自己的 Google Gemini API Key。
                      <br/><span className="text-xs text-gray-400">Key 将加密存储在您的浏览器本地缓存中。</span>
                  </p>
                  
                  <input 
                      type="password" 
                      placeholder="输入您的 API Key (AIza...)" 
                      value={apiKeyInput}
                      onChange={(e) => {
                          setApiKeyInput(e.target.value);
                          setKeyError(null);
                      }}
                      disabled={isValidatingKey}
                      className={`w-full border rounded-lg px-4 py-2 mb-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm ${keyError ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                  />
                  
                  {keyError && (
                    <div className="text-xs text-red-600 mb-4 bg-red-50 p-2 rounded border border-red-100 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span>{keyError}</span>
                    </div>
                  )}
                  
                  <div className="mb-6 flex justify-between items-center">
                    <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                        获取免费 Key <ExternalLink className="w-3 h-3" />
                    </a>
                    {apiKeyInput && !isValidatingKey && (
                        <button 
                            onClick={handleClearKey}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
                        >
                            <LogOut className="w-3 h-3" /> 清除 Key
                        </button>
                    )}
                  </div>

                  <div className="flex justify-end gap-3">
                      <button 
                          onClick={() => setShowApiKeyModal(false)}
                          className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                          disabled={isValidatingKey}
                      >
                          取消
                      </button>
                      <button 
                          onClick={saveApiKey}
                          disabled={!apiKeyInput.trim() || isValidatingKey}
                          className={`px-4 py-2 rounded-lg font-medium shadow-sm shadow-blue-200 flex items-center gap-2 transition-all ${
                              !apiKeyInput.trim() || isValidatingKey 
                                ? 'bg-blue-400 cursor-not-allowed text-blue-100' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                      >
                          {isValidatingKey && <Loader2 className="w-4 h-4 animate-spin" />}
                          {isValidatingKey ? '验证中...' : '验证并保存'}
                      </button>
                  </div>
              </div>
          </div>
      )}

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
                            disabled={isValidatingKey}
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
                                
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                                        <div>
                                            <div className="font-medium text-gray-900">起始页码映射</div>
                                            <div className="text-xs text-gray-500">将 PDF 第1页映射为书本页码</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={pageOffset}
                                                onChange={(e) => setPageOffset(Math.max(1, parseInt(e.target.value) || 1))}
                                                className="w-24 px-3 py-2 text-right text-lg font-mono font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                            <span className="text-sm text-gray-400">页</span>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={startProcessing}
                                    disabled={isValidatingKey}
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

            {/* History Section */}
            {history.length > 0 && appState === AppState.IDLE && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-gray-900">
                            <History className="w-6 h-6 text-gray-500" />
                            审阅历史归档 (最近10条)
                        </h2>
                        <button 
                            onClick={() => {
                                setHistory([]);
                                if (typeof localStorage !== 'undefined') localStorage.removeItem('math_edit_history');
                            }}
                            className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                        >
                            <Trash2 className="w-3 h-3" /> 清空历史
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {history.map((record) => (
                            <div key={record.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 gap-4">
                                <div>
                                    <div className="font-bold text-gray-900 mb-1">{record.fileName}</div>
                                    <div className="text-xs text-gray-500 flex items-center gap-3">
                                        <span>{new Date(record.timestamp).toLocaleString()}</span>
                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">成功: {record.successCount}</span>
                                        {record.totalProcessed - record.successCount > 0 && (
                                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">失败: {record.totalProcessed - record.successCount}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => downloadReport(record.results, record.fileName, record.pageOffset)}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all text-sm font-medium shadow-sm"
                                    >
                                        <Download className="w-4 h-4" />
                                        下载
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
      </main>
    </div>
  );
}

export default App;
