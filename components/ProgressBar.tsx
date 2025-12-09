
import React from 'react';
import { CheckCircle2, Calculator, PauseCircle } from 'lucide-react';

interface ProgressBarProps {
  current: number;
  total: number;
  status: string;
  results: string[]; 
  pageOffset: number;
  activePageIndices: number[];
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, status, results, pageOffset, activePageIndices }) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const isComplete = total > 0 && current === total;
  const isStopped = status.includes('已手动停止') || status.includes('Stopped');

  let statusDisplay = status;
  if (activePageIndices.length > 0 && !isStopped) {
      const sortedPages = activePageIndices.map(p => p + pageOffset - 1).sort((a,b) => a-b);
      const displayPages = sortedPages.slice(0, 8).join(', ') + (sortedPages.length > 8 ? '...' : '');
      statusDisplay = `正在并行处理第 ${displayPages} 页...`;
  } else if (isComplete) {
      statusDisplay = "所有页面处理完毕";
  }

  const renderGrid = () => {
    return (
      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 mt-6">
        {Array.from({ length: total }).map((_, i) => {
          const pageNum = i + 1; 
          const isProcessed = !!results[i];
          const isError = isProcessed && results[i].includes('error-card');
          const isActive = activePageIndices.includes(pageNum) && !isStopped;
          const realPage = i + pageOffset;
          
          let bgColor = 'bg-gray-100';
          let borderColor = 'border-gray-200';
          let textColor = 'text-gray-400';
          
          if (isError) {
            bgColor = 'bg-red-100';
            borderColor = 'border-red-200';
            textColor = 'text-red-600';
          } else if (isProcessed) {
            bgColor = 'bg-green-100';
            borderColor = 'border-green-200';
            textColor = 'text-green-600';
          } else if (isActive) {
             bgColor = 'bg-blue-600 animate-pulse shadow-lg shadow-blue-200 transition-colors duration-300';
             borderColor = 'border-blue-700';
             textColor = 'text-white font-bold';
          }

          return (
            <div 
              key={i}
              title={`第 ${realPage} 页 (PDF P${pageNum})${isActive ? ' - 正在处理' : ''}${isError ? ' - 失败' : ''}`}
              className={`h-8 rounded border ${bgColor} ${borderColor} flex items-center justify-center text-xs ${textColor} transition-all select-none`}
            >
              {realPage}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
             {isStopped ? (
                 <PauseCircle className="w-6 h-6 text-slate-400" />
             ) : !isComplete ? (
                <div className="relative flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-blue-500 border-2 border-white shadow-sm"></span>
                </div>
             ) : (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
             )}
             <h3 className="text-lg font-bold text-gray-900">
                {isStopped ? '任务已暂停' : isComplete ? '全书审阅完成' : 'AI 智能验算中...'}
             </h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 font-mono pl-8">
             {statusDisplay}
          </div>
        </div>

        <div className="text-right hidden md:block">
            <div className={`text-5xl font-black text-transparent bg-clip-text font-mono tracking-tighter ${isStopped ? 'bg-gray-400' : 'bg-gradient-to-br from-gray-900 to-gray-600'}`}>
                {percentage}<span className="text-2xl text-gray-400 ml-1">%</span>
            </div>
        </div>
      </div>

      <div className="relative pt-6 pb-2">
        <div 
            className="absolute top-0 -mt-3 transform -translate-x-1/2 transition-all duration-700 ease-out z-10"
            style={{ left: `${percentage}%` }}
        >
            <div className={`relative text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap transition-opacity duration-300 ${percentage === 0 ? 'opacity-0' : 'opacity-100'} ${isStopped ? 'bg-gray-500' : 'bg-gray-900'}`}>
                {percentage}%
                <div className={`absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full border-4 border-transparent ${isStopped ? 'border-t-gray-500' : 'border-t-gray-900'}`}></div>
            </div>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-5 overflow-hidden shadow-inner border border-gray-200 relative">
            <div 
              className={`h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end relative overflow-hidden ${
                  isStopped 
                    ? 'bg-gray-400'
                    : isComplete 
                        ? 'bg-green-500' 
                        : 'bg-gradient-to-r from-blue-500 to-blue-600'
              }`}
              style={{ width: `${percentage}%` }}
            >
                {!isComplete && !isStopped && (
                    <div className="absolute inset-0 progress-stripes opacity-40 mix-blend-overlay"></div>
                )}
                
                {!isComplete && !isStopped && percentage > 0 && (
                    <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/50 to-transparent blur-sm transform skew-x-12"></div>
                )}
            </div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
            <span>START</span>
            <span>已完成 {current} 页 / 共 {total} 页</span>
            <span>END</span>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2 uppercase tracking-wider font-semibold">
            <span>页面状态监控</span>
            <div className="flex gap-3">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500"></span>完成</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-600 animate-pulse"></span>处理中</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span>异常</span>
            </div>
        </div>
        {renderGrid()}
      </div>

      {!isComplete && !isStopped && (
          <div className="mt-6 bg-blue-50/80 text-blue-800 text-sm p-4 rounded-xl flex items-start gap-3 border border-blue-100 animate-pulse-shadow backdrop-blur-sm">
              <Calculator className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" />
              <div>
                  <strong>正在进行数学逻辑深度校验</strong>
                  <p className="opacity-80 mt-1 text-xs leading-relaxed">系统正在并行调用 Gemini Pro 数学推理模型对每一道题目的计算过程进行验算。为了保证准确率，这可能比普通文字校对耗时更长。</p>
              </div>
          </div>
      )}
    </div>
  );
};

export default ProgressBar;
