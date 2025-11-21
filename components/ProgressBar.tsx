
import React from 'react';
import { CheckCircle2, Loader2, Calculator, AlertTriangle, FileCheck } from 'lucide-react';

interface ProgressBarProps {
  current: number;
  total: number;
  status: string;
  results: string[]; // Array of HTML results to determine status of each page
  pageOffset: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, status, results, pageOffset }) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  // Generate a grid of status blocks
  // results array index corresponds to page index (0-based)
  // If results[i] is set, it's done. Check content for error.
  const renderGrid = () => {
    return (
      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 mt-6">
        {Array.from({ length: total }).map((_, i) => {
          const isProcessed = !!results[i];
          const isError = isProcessed && results[i].includes('error-card');
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
          } else {
             // Not processed yet
             // Can add a visual for "Next in queue" if we knew the exact queue order,
             // but roughly:
             if (i === current) { // Currently processing approx
                 bgColor = 'bg-blue-50 animate-pulse';
                 borderColor = 'border-blue-200';
                 textColor = 'text-blue-500';
             }
          }

          return (
            <div 
              key={i}
              title={`第 ${realPage} 页 (PDF P${i+1})${isError ? ' - 失败' : ''}`}
              className={`h-10 rounded-md border ${bgColor} ${borderColor} flex items-center justify-center text-xs font-bold ${textColor} transition-all`}
            >
              {realPage}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        
        {/* Left: Status Text & Icon */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
             {percentage < 100 ? (
                <div className="relative">
                    <div className="w-3 h-3 bg-blue-600 rounded-full animate-ping absolute inset-0 opacity-75"></div>
                    <div className="w-3 h-3 bg-blue-600 rounded-full relative"></div>
                </div>
             ) : (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
             )}
             <h3 className="text-lg font-bold text-gray-900">
                {percentage < 100 ? 'AI 智能验算中...' : '全书审阅完成'}
             </h3>
          </div>
          <p className="text-gray-500 font-mono text-sm bg-gray-50 py-2 px-3 rounded-lg border border-gray-100 inline-flex items-center gap-2">
             <Calculator className="w-4 h-4 text-blue-500" />
             {status}
          </p>
        </div>

        {/* Right: Big Percentage */}
        <div className="text-right">
            <div className="text-5xl font-black text-blue-600 tracking-tight">
                {percentage}<span className="text-2xl text-gray-400 font-medium">%</span>
            </div>
            <div className="text-sm text-gray-400 font-medium mt-1">
                进度: {current} / {total} 页
            </div>
        </div>
      </div>

      {/* Visual Progress Bar Line */}
      <div className="w-full bg-gray-100 rounded-full h-2 mt-6 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ease-out ${percentage === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      {/* Page Grid Visualization */}
      <div className="mt-8">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2 uppercase tracking-wider font-semibold">
            <span>页面状态概览</span>
            <div className="flex gap-3">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>完成</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>处理中</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>失败</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300"></span>等待</span>
            </div>
        </div>
        {renderGrid()}
      </div>

      {/* Tips Area */}
      <div className="mt-6 bg-blue-50 text-blue-800 text-sm p-4 rounded-xl flex items-start gap-3">
          <FileCheck className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
              <strong>数学严谨性检查模式已开启</strong>
              <p className="opacity-80 mt-1">系统正在后台对每一道题目的计算过程进行二次验算。如果发现计算错误，将在报告中以 <span className="font-bold text-red-600 bg-red-100 px-1 rounded">重大错误</span> 标记。</p>
          </div>
      </div>
    </div>
  );
};

export default ProgressBar;
