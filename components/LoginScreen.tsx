
import React, { useState, useEffect } from 'react';
import { Key, Globe, ChevronRight, Eye, EyeOff, Sparkles, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { ApiSettings, AiProvider } from '../types';
import { testConnection } from '../services/geminiService';

interface LoginScreenProps {
    onLogin: (settings: ApiSettings) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [showKey, setShowKey] = useState(false);
    
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        const storedKey = localStorage.getItem('mathedit_api_key');
        const storedUrl = localStorage.getItem('mathedit_base_url');
        if (storedKey) setApiKey(storedKey);
        // Default to a common OneAPI placeholder or empty if not set
        if (storedUrl) setBaseUrl(storedUrl);
    }, []);

    const detectProvider = (url: string): AiProvider => {
        if (url.includes('googleapis.com')) return 'google';
        return 'openai'; // Default to OpenAI compatible for everything else
    };

    const handleTestAndConnect = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!apiKey.trim()) return;
        
        let urlToUse = baseUrl.trim();
        // If empty, assume OpenAI default, though usually users have custom proxies
        if (!urlToUse) urlToUse = 'https://api.openai.com/v1';

        setIsTesting(true);
        setTestStatus('idle');
        setTestMessage('');
        
        const provider = detectProvider(urlToUse);

        try {
            await testConnection(apiKey.trim(), urlToUse, provider);
            setTestStatus('success');
            setTestMessage('验证成功! 模型列表已获取。');
            
            // Proceed to login after short delay
            setTimeout(() => {
                onLogin({ apiKey: apiKey.trim(), baseUrl: urlToUse, provider });
            }, 800);

        } catch (error: any) {
            setTestStatus('error');
            setTestMessage(error.message || '连接失败，请检查 Base URL 和 Key');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f4f6f8] flex flex-col items-center justify-center p-4 font-sans text-slate-900">
            <div className="w-full max-w-[480px] bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in-up">
                
                <div className="p-6 border-b border-slate-100 bg-white flex justify-between items-center">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-600" />
                        配置 /v1 连接
                    </h2>
                    <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">OpenAI Mode</span>
                </div>

                <div className="p-8 flex flex-col gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Globe className="w-4 h-4 text-slate-400" /> 
                            API 地址 (Base URL)
                        </label>
                        <input 
                            type="text" 
                            value={baseUrl}
                            onChange={(e) => {
                                setBaseUrl(e.target.value);
                                setTestStatus('idle');
                            }}
                            placeholder="http://your-oneapi-domain.com/v1" 
                            className="w-full p-3 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                         <p className="text-[10px] text-slate-400">
                            请输入完整的 API 地址（例如以 /v1 结尾）。适配 OneAPI, NewAPI 等中转。
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Key className="w-4 h-4 text-slate-400" />
                            API Key (令牌)
                        </label>
                        <div className="relative">
                            <input
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={(e) => {
                                    setApiKey(e.target.value);
                                    setTestStatus('idle');
                                }}
                                placeholder="sk-..."
                                className="w-full p-3 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {testStatus !== 'idle' && (
                         <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                             testStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                         }`}>
                             {testStatus === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                             <span className="break-all font-medium">{testMessage}</span>
                         </div>
                    )}

                    <button 
                        onClick={() => handleTestAndConnect()}
                        disabled={!apiKey || isTesting}
                        className={`w-full py-3.5 rounded-lg font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                            !apiKey || isTesting 
                            ? 'bg-slate-300 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200 active:scale-[0.98]'
                        }`}
                    >
                         {isTesting ? (
                             <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                         ) : (
                             <Zap className="w-4 h-4" />
                         )}
                         {isTesting ? '正在验证...' : '验证并获取模型'}
                    </button>
                </div>
            </div>
            
            <p className="mt-8 text-xs text-slate-400 text-center max-w-sm">
                Supported protocols: OpenAI Standard (v1/chat/completions).<br/>
                Fully compatible with DeepSeek, Moonshot, OneAPI, etc.
            </p>
        </div>
    );
};

export default LoginScreen;
