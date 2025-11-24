import React from 'react';

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

  let statusDisplay = status;
  if (activePageIndices.length > 0) {
      const sortedPages = activePageIndices.map(p => p + pageOffset - 1).sort((a,b) => a-b);
      const displayPages = sortedPages.slice(0, 5).join(', ') + (sortedPages.length > 5 ? '...' : '');
      statusDisplay = `并行处理中: [${displayPages}]`;
  } else if (isComplete) {
      statusDisplay = "流程结束";
  }

  const renderGrid = () => {
    return (
      <div className="grid grid-cols-10 gap-px bg-gray-200 border border-gray-200 mt-8">
        {Array.from({ length: total }).map((_, i) => {
          const pageNum = i + 1;
          const isProcessed = !!results[i];
          const isError = isProcessed && results[i].includes('error-card');
          const isActive = activePageIndices.includes(pageNum);
          const realPage = i + pageOffset;
          
          let bgClass = 'bg-white text-gray-300'; // 默认未处理
          if (isError) bgClass = 'bg-red-600 text-white font-bold';
          else if (isProcessed) bgClass = 'bg-black text-white font-bold';
          else if (isActive) bgClass = 'bg-gray-400 text-white animate-pulse';

          return (
            <div 
              key={i}
              className={`h-8 flex items-center justify-center text-[10px] font-sans ${bgClass}`}
              title={`Page ${realPage}`}
            >
              {realPage}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full border-2 border-black p-8 bg-white">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 font-sans">System Status</div>
            <h3 className="text-3xl font-black font-serif text-black leading-none mb-2">
                {isComplete ? '审阅任务完成' : '推理引擎运行中'}
            </h3>
            <div className="text-sm font-serif text-gray-600 border-l-4 border-black pl-3 py-1">
                {statusDisplay}
            </div>
          </div>

          <div className="text-right">
              <div className="text-7xl font-black text-black font-sans leading-none tracking-tighter">
                  {percentage}<span className="text-2xl font-light text-gray-400 ml-1">%</span>
              </div>
          </div>
      </div>

      {/* Progress Bar - Thick & Sharp */}
      <div className="w-full bg-gray-100 h-6 border-y-2 border-black mb-2 relative">
          <div 
            className={`h-full transition-all duration-300 ease-linear ${isComplete ? 'bg-black' : 'bg-gray-800'}`}
            style={{ width: `${percentage}%` }}
          ></div>
      </div>

      {renderGrid()}
    </div>
  );
};

export default ProgressBar;
