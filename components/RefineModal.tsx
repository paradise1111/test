
import React, { useState } from 'react';
import { MessageSquarePlus, Save, X, Sparkles, FileEdit, ClipboardPaste } from 'lucide-react';

interface RefineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: string, correctedText: string, addToMemory: boolean) => void;
  pageNumber: number;
  isProcessing: boolean;
}

const RefineModal: React.FC<RefineModalProps> = ({ isOpen, onClose, onSubmit, pageNumber, isProcessing }) => {
  const [activeTab, setActiveTab] = useState<'feedback' | 'paste'>('feedback');
  const [feedback, setFeedback] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [addToMemory, setAddToMemory] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (activeTab === 'feedback' && !feedback.trim()) return;
    if (activeTab === 'paste' && !correctedText.trim()) return;

    // Send both. Logic in parent will decide which to use.
    onSubmit(feedback, activeTab === 'paste' ? correctedText : '', addToMemory);
    
    // Reset
    setFeedback('');
    setCorrectedText('');
    setAddToMemory(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-up border border-slate-100 flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-blue-600"/>
            第 {pageNumber} 页 - 优化与修订
          </h3>
          <button onClick={onClose} disabled={isProcessing} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
             <button 
                onClick={() => setActiveTab('feedback')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'feedback' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
             >
                 <Sparkles className="w-4 h-4" /> 提意见 (AI 重写)
             </button>
             <button 
                onClick={() => setActiveTab('paste')}
                className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'paste' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
             >
                 <ClipboardPaste className="w-4 h-4" /> 粘贴我的修订稿
             </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'feedback' ? (
            <div className="animate-fade-in">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                您希望 AI 如何改进这一页？
                </label>
                <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                disabled={isProcessing}
                placeholder="例如：请不要把'周期性'修改为'递推'；语气太生硬了，请柔和一点..."
                className="w-full h-32 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none"
                />
            </div>
          ) : (
             <div className="animate-fade-in">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-3">
                    在此粘贴您修改后的完美版本。AI 将直接使用它替换原内容，并<b>自动分析</b>您修改了什么，从而学会您的偏好。
                </div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                   您的最终修订稿 (HTML 或 纯文本):
                </label>
                <textarea
                value={correctedText}
                onChange={(e) => setCorrectedText(e.target.value)}
                disabled={isProcessing}
                placeholder="请粘贴您修改后的完整段落内容..."
                className="w-full h-48 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm font-mono"
                />
            </div>
          )}

          <div className="mt-4 flex items-start gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100 cursor-pointer" onClick={() => !isProcessing && setAddToMemory(!addToMemory)}>
            <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${addToMemory ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-indigo-300'}`}>
              {addToMemory && <Sparkles className="w-3 h-3 text-white" />}
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-indigo-900">记在“AI 进化记忆”中</div>
              <div className="text-xs text-indigo-700 mt-0.5">勾选后，系统将提取您的修改逻辑（或意见），保存为永久规则，在后续审阅中自动生效。</div>
            </div>
          </div>
        </div>

        <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            disabled={isProcessing}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium text-sm transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSubmit}
            disabled={(activeTab === 'feedback' && !feedback.trim()) || (activeTab === 'paste' && !correctedText.trim()) || isProcessing}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-white font-bold text-sm transition-all shadow-md ${
              isProcessing
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                正在处理...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {activeTab === 'feedback' ? '提交意见' : '提交修订并学习'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RefineModal;
