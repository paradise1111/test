import React, { useState, useRef, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import ProgressBar from './components/ProgressBar';
import ReportPreview from './components/ReportPreview';
import { AppState, ProcessingStatus, ReportRecord } from './types';
import { loadPdf, renderPageToImage, extractTextFromPdf } from './services/pdfService';
import { analyzePageContent } from './services/geminiService';
import { HTML_TEMPLATE_START, HTML_TEMPLATE_END } from './constants';

const HistoryRow: React.FC<{ 
    record: ReportRecord; 
    onDownload: (r: string[], n: string, o: number) => void; 
}> = ({ record, onDownload }) => {
    const failedCount = record.totalProcessed - record.successCount;
    const isSuccess = failedCount === 0;
    
    return (
        <div className="group flex items-center justify-between py-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-4">
                <div className={`font-sans font-bold text-xs px-2 py-1 border ${isSuccess ? 'border-black text-black' : 'border-red-600 text-red-600'}`}>
                    {isSuccess ? 'PASS' : 'WARN'}
                </div>
                <div>
                    <div className="font-serif font-bold text-lg text-ink leading-tight">{record.fileName}</div>
                    <div className="font-sans text-xs text-gray-500 uppercase mt-1">
                        {new Date(record.timestamp).toLocaleString('zh-CN')}
                    </div>
                </div>
            </div>
            <button
                onClick={() => onDownload(record.results, record.fileName, record.pageOffset)}
                className="text-xs font-bold border border-black bg-white hover:bg-black hover:text-white text-ink px-4 py-2 transition-colors uppercase font-sans tracking-wide"
            >
                导出 <i className="fa-solid fa-arrow-down ml-1"></i>
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

  const [knowledgeBaseText, setKnowledgeBaseText] = useState<string>('');
  const [refFileName, setRefFileName] = useState<string | null>(null);
  const [isExtractingRef, setIsExtractingRef] = useState(false);
  const refFileInputRef = useRef<HTMLInputElement>(null);
  
  const stopProcessingRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('math_edit_history');
        if (saved) setHistory(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('math_edit_history', JSON.stringify(history.slice(0, 20)));
    }
  }, [history]);

  const handleStop = () => {
    stopProcessingRef.current = true;
    setActivePageIndices([]);
    setStatus(prev => ({ ...prev, isProcessing: false, currentStage: '操作已中断' }));
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
              setKnowledgeBaseText(prev => prev + `\n\n[参考资料: ${file.name}]\n` + text);
          } catch (err) {
              alert("解析错误: " + (err as Error).message);
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

      setStatus({ total: totalPages, current: completedCount, isProcessing: true, currentStage: '初始化推理引擎...' });

      const queue = [...pagesToProcess];
      const CONCURRENCY = 5;

      const worker = async () => {
        while (queue.length > 0) {
            if (stopProcessingRef.current) break;
            const pageNum = queue.shift();
            if (!pageNum) break;

            setActivePageIndices(prev => [...prev, pageNum]);

            try {
                if (stopProcessingRef.current) break;
                const imgData = await renderPageToImage(pdf, pageNum);

                if (stopProcessingRef.current) break;
                const html = await analyzePageContent(imgData, pageNum + pageOffset - 1, knowledgeBaseText);

                if (stopProcessingRef.current) break;
                finalResults[pageNum - 1] = html;
                setResults([...finalResults]);
            } catch (err) {
                console.error(err);
                if (!stopProcessingRef.current) {
                     finalResults[pageNum - 1] = `<div class="page-review error-card" id="page-${pageNum}"><h2 class="page-title">第 ${pageNum} 页处理失败</h2></div>`;
                     setResults([...finalResults]);
                }
            } finally {
                setActivePageIndices(prev => prev.filter(p => p !== pageNum));
                if (!stopProcessingRef.current) {
                    completedCount++;
                    setStatus(prev => ({ ...prev, current: completedCount }));
                }
            }
        }
      };

      await Promise.all(Array(CONCURRENCY).fill(null).map(() => worker()));

      if (stopProcessingRef.current) {
          setAppState(AppState.PROCESSING);
          setStatus(prev => ({ ...prev, isProcessing: false, currentStage: '用户已手动终止' }));
      } else {
          setStatus(prev => ({ ...prev, currentStage: '所有页面处理完毕' }));
          setAppState(AppState.COMPLETED);
      }
      
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
      a.download = `${name.replace('.pdf', '')}_审阅报告.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-white text-ink font-serif selection:bg-black selection:text-white">
      
      {/* 1. Header (Masthead) */}
      <header className="border-b-[3px] border-black pt-12 pb-6 px-6 md:px-12 bg-white sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between md:items-end gap-4">
          <div>
            <div className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">
              Automated Publication Audit System
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
              MathEdit Pro <span className="text-3xl font-light italic">AI</span>
            </h1>
          </div>
          <div className="flex flex-col md:items-end gap-2">
             <div className="flex gap-4 text-xs font-sans font-bold tracking-wider">
                <span>V2.1.0 BUILD</span>
                <span>/</span>
                <span>GEMINI 3 PRO</span>
             </div>
             <button 
                onClick={() => setShowHistoryModal(true)}
                className="group flex items-center gap-2 text-sm font-bold border-b border-transparent hover:border-black transition-all pb-0.5"
            >
                <i className="fa-solid fa-list-ul text-xs"></i> 查看历史记录
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Body (4+8 Grid) */}
      <main className="max-w-[1400px] mx-auto px-6 md:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-16">
            
            {/* 4 Cols: Visual Anchor & Sidebar */}
            <aside className="md:col-span-4 relative hidden md:block">
                <div className="sticky top-48">
                    {/* The Giant Hollow Anchor */}
                    <div className="visual-anchor text-[12rem] lg:text-[16rem] leading-[0.7] -ml-2 mb-8 opacity-20">
                        审
                    </div>
                    
                    <div className="space-y-12 border-l-2 border-black pl-8">
                        <div>
                            <h3 className="font-bold text-2xl mb-4">核心准则</h3>
                            <p className="text-sm font-serif leading-relaxed text-gray-800">
                                严格遵循《义务教育数学课程标准（2022年版）》及 GB 3102.11 符号规范。任何格式、术语或逻辑偏差都将被标记。
                            </p>
                        </div>
                        
                        <div>
                            <h3 className="font-bold text-2xl mb-4">审阅范围</h3>
                            <ul className="text-sm font-serif space-y-3">
                                <li className="flex items-center gap-3">
                                    <i className="fa-solid fa-check text-xs"></i> 政治敏感性与地图边界
                                </li>
                                <li className="flex items-center gap-3">
                                    <i className="fa-solid fa-check text-xs"></i> 数学逻辑与计算校验
                                </li>
                                <li className="flex items-center gap-3">
                                    <i className="fa-solid fa-check text-xs"></i> 术语规范化检查
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </aside>

            {/* 8 Cols: Core Interaction Area */}
            <section className="md:col-span-12 lg:col-span-8 space-y-12">
                
                {/* Initial State */}
                {(appState === AppState.IDLE || appState === AppState.ERROR) && (
                    <div className="animate-fade-in space-y-12">
                        {/* File Upload Block */}
                        <div className="bg-white">
                            {!currentFile ? (
                                <FileUpload onFileSelect={handleFileSelect} onError={(m) => setErrorMsg(m)} />
                            ) : (
                                <div className="border-2 border-dashed border-black p-8 flex items-center justify-between bg-gray-50">
                                    <div className="flex items-center gap-6">
                                        <div className="w-16 h-16 bg-black text-white flex items-center justify-center text-2xl">
                                            <i className="fa-regular fa-file-pdf"></i>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold mb-1">{currentFile.name}</h3>
                                            <p className="font-sans text-xs text-gray-500 uppercase tracking-wider">
                                                FILE SIZE: {(currentFile.size/1024/1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setCurrentFile(null)} 
                                        className="w-10 h-10 flex items-center justify-center border border-transparent hover:border-black hover:bg-white transition-all"
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            )}
                        </div>

                        {currentFile && (
                            <div className="space-y-6">
                                <div className="flex items-baseline justify-between border-b border-black pb-2">
                                    <h2 className="text-2xl font-bold">语境注入 <span className="font-sans text-sm font-normal text-gray-500 ml-2">CONTEXT INJECTION</span></h2>
                                </div>
                                
                                <div className="relative">
                                    <textarea 
                                        value={knowledgeBaseText}
                                        onChange={(e) => setKnowledgeBaseText(e.target.value)}
                                        placeholder="在此输入特定的审阅规则、排版要求或需要回避的词汇..."
                                        className="w-full h-48 p-6 font-serif text-lg leading-relaxed border-2 border-gray-200 focus:border-black outline-none resize-none placeholder-gray-300 transition-colors bg-white"
                                    />
                                    <div className="absolute bottom-4 right-4">
                                        <input type="file" ref={refFileInputRef} accept="application/pdf" className="hidden" onChange={handleRefFileSelect} />
                                        <button 
                                            onClick={() => refFileInputRef.current?.click()}
                                            className="bg-black text-white text-xs font-sans font-bold px-4 py-2 hover:bg-gray-800 transition-colors flex items-center gap-2"
                                            disabled={isExtractingRef}
                                        >
                                            {isExtractingRef ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-upload"></i>}
                                            {refFileName ? '已加载参考PDF' : '上传参考标准 PDF'}
                                        </button>
                                    </div>
                                </div>

                                <button 
                                    onClick={startProcessing}
                                    className="w-full bg-black text-white h-20 text-xl font-bold hover:bg-gray-900 transition-colors flex items-center justify-between px-8 group mt-8"
                                >
                                    <span>启动全量审阅</span>
                                    <i className="fa-solid fa-arrow-right transform group-hover:translate-x-2 transition-transform"></i>
                                </button>
                            </div>
                        )}

                        {errorMsg && (
                            <div className="border-l-4 border-black bg-gray-100 p-6">
                                <h4 className="font-bold text-lg mb-2 flex items-center gap-2">
                                    <i className="fa-solid fa-triangle-exclamation"></i> 错误报告
                                </h4>
                                <p className="font-serif text-sm">{errorMsg}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Processing State */}
                {(appState === AppState.PROCESSING || appState === AppState.COMPLETED) && (
                    <div className="animate-fade-in space-y-12">
                        <ProgressBar 
                            current={status.current} 
                            total={status.total} 
                            status={status.currentStage} 
                            results={results}
                            pageOffset={pageOffset}
                            activePageIndices={activePageIndices}
                        />

                         {appState === AppState.PROCESSING && !stopProcessingRef.current && (
                            <div className="text-center border-y border-gray-200 py-6">
                                <button 
                                    onClick={handleStop}
                                    className="text-black font-bold text-sm uppercase hover:underline decoration-2 underline-offset-4"
                                >
                                    <i className="fa-solid fa-pause mr-2"></i> 暂停并终止进程
                                </button>
                            </div>
                        )}

                        {results.length > 0 && (
                            <div>
                                <div className="flex justify-between items-end mb-8 border-b-2 border-black pb-4">
                                    <h2 className="text-3xl font-black">审阅报告</h2>
                                    {(appState === AppState.COMPLETED || stopProcessingRef.current) && (
                                        <button 
                                            onClick={() => downloadReport(results, currentFile?.name || 'report', pageOffset)}
                                            className="bg-black text-white px-6 py-3 font-sans font-bold text-xs uppercase hover:bg-gray-800 transition-colors"
                                        >
                                            下载 HTML 报告
                                        </button>
                                    )}
                                </div>
                                <ReportPreview results={results} onDownload={() => downloadReport(results, currentFile?.name || 'report', pageOffset)} />
                            </div>
                        )}
                    </div>
                )}

            </section>
        </div>
      </main>

      {/* 3. Mid-Breaker */}
      <section className="bg-gray-100 py-20 border-t border-b border-black">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="space-y-4">
                    <div className="w-12 h-12 border-2 border-black rounded-none flex items-center justify-center text-xl">
                        <i className="fa-solid fa-globe"></i>
                    </div>
                    <h4 className="font-bold text-xl">政治与主权合规</h4>
                    <p className="text-sm text-gray-600 leading-relaxed font-serif">
                        内置高敏感度政治审查过滤器。对地图边界、主权表述及涉政用语进行强制性扫描，确保出版物符合国家法规。
                    </p>
                </div>
                <div className="space-y-4">
                    <div className="w-12 h-12 border-2 border-black rounded-none flex items-center justify-center text-xl">
                        <i className="fa-solid fa-calculator"></i>
                    </div>
                    <h4 className="font-bold text-xl">数值逻辑验证</h4>
                    <p className="text-sm text-gray-600 leading-relaxed font-serif">
                        AI 驱动的计算引擎对所有例题与习题进行后台验算。自动检测已知条件与结果的逻辑闭环，识别潜在的数值错误。
                    </p>
                </div>
                <div className="space-y-4">
                    <div className="w-12 h-12 border-2 border-black rounded-none flex items-center justify-center text-xl">
                        <i className="fa-solid fa-layer-group"></i>
                    </div>
                    <h4 className="font-bold text-xl">一致性查重</h4>
                    <p className="text-sm text-gray-600 leading-relaxed font-serif">
                        跨页面分析题目结构。识别仅仅修改数字但逻辑完全雷同的题目，以及前后文符号定义不一致的问题。
                    </p>
                </div>
            </div>
          </div>
      </section>

      {/* 4. Dark Footer */}
      <footer className="bg-[#1f2937] text-white py-24">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12">
            <div className="flex flex-col md:flex-row justify-between items-start gap-12">
                <div className="max-w-md">
                    <h2 className="font-serif font-black text-4xl mb-6">MathEdit Pro AI</h2>
                    <p className="text-gray-400 font-serif leading-relaxed mb-8">
                        重新定义数字时代的教育出版审阅流程。我们将传统出版的严谨标准与生成式人工智能的推理能力相结合，打造无缝的智能辅助系统。
                    </p>
                    <div className="font-sans text-xs text-gray-500 uppercase tracking-widest">
                        &copy; 2024 MathEdit Pro. All Rights Reserved.
                    </div>
                </div>
                
                <div className="flex flex-col gap-6 text-right">
                    <div>
                        <div className="text-xs text-gray-500 uppercase font-sans mb-2">System Status</div>
                        <div className="flex items-center justify-end gap-3 text-emerald-400 font-mono text-sm">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                            OPERATIONAL
                        </div>
                    </div>
                    {/* Icons removed per user request regarding GitHub connection */}
                </div>
            </div>
          </div>
      </footer>

      {/* History Modal */}
      {showHistoryModal && (
          <div className="fixed inset-0 z-[100] flex justify-end">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)}></div>
              <div className="relative bg-white w-full max-w-lg h-full shadow-2xl flex flex-col animate-fade-in border-l border-gray-200">
                  <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-white">
                      <div>
                        <h3 className="font-serif font-bold text-2xl">系统日志</h3>
                        <p className="text-xs font-sans text-gray-400 uppercase mt-1">System Operation Logs</p>
                      </div>
                      <button onClick={() => setShowHistoryModal(false)} className="text-2xl hover:text-red-600 transition-colors">
                        <i className="fa-solid fa-times"></i>
                      </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                      {history.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4">
                              <i className="fa-regular fa-folder-open text-4xl"></i>
                              <p className="font-serif">暂无历史记录</p>
                          </div>
                      ) : (
                          history.map(r => <HistoryRow key={r.id} record={r} onDownload={downloadReport} />)
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
