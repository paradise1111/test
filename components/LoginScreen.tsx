
import React, { useState, useEffect } from 'react';
import { Key, Globe, ChevronRight, Eye, EyeOff, ShieldCheck, Sparkles, Server, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { ApiSettings } from '../types';
import { testConnection } from '../services/geminiService';

interface LoginScreenProps {
    onLogin: (settings: ApiSettings) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
    const [apiKey, setApiKey] = useState('');
    const [baseUrl, setBaseUrl] = useState('https://generativelanguage.googleapis.com');
    const [showKey, setShowKey] = useState(false);
    
    // Testing state
    const [isTesting, setIsTesting] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');

    useEffect(() => {
        const storedKey = localStorage.getItem('mathedit_api_key');
        const storedUrl = localStorage.getItem('mathedit_base_url');
        if (storedKey) setApiKey(storedKey);
        if (storedUrl) setBaseUrl(storedUrl);
    }, []);

    const handleTest = async () => {
        if (!apiKey.trim()) return;
        
        setIsTesting(true);
        setTestStatus('idle');
        setTestMessage('');
        
        try {
            await testConnection(apiKey.trim(), baseUrl.trim());
            setTestStatus('success');
            setTestMessage('连接成功！API Key 有效。');
        } catch (error: any) {
            setTestStatus('error');
            let msg = error.message || '连接失败，请检查配置。';
            
            // 友好的错误提示映射
            if (msg.includes('API key not valid') || msg.includes('INVALID_ARGUMENT')) {
                msg = 'API Key 无效。请检查是否复制完整，或密钥是否已过期。';
            } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
                msg = '网络连接失败。请检查 Base URL 是否正确，或网络是否通畅。';
            } else if (msg.includes('404')) {
                msg = '接口地址 (404) 错误。Base URL 可能配置有误。';
            }
            
            setTestMessage(msg);
        } finally {
            setIsTesting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (apiKey.trim()) {
            onLogin({ apiKey: apiKey.trim(), baseUrl: baseUrl.trim() });
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
            <div className="w-full max-w-[400px] animate-fade-in-up">
                <div className="mb-10 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-200 mb-6">
                        <Sparkles className="w-7 h-7" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Welcome Back</h1>
                    <p className="text-slate-500 text-sm">Configure your AI provider to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Key className="w-3.5 h-3.5" /> API Key
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
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-slate-800"
                                required
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

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5" /> API Endpoint (Base URL)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={baseUrl}
                                onChange={(e) => {
                                    setBaseUrl(e.target.value);
                                    setTestStatus('idle');
                                }}
                                placeholder="https://generativelanguage.googleapis.com"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-slate-800"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed px-1">
                            Default: <code>https://generativelanguage.googleapis.com</code>. <br/>
                            Change this if you are using a proxy or a compatible endpoint.
                        </p>
                    </div>

                    {testStatus !== 'idle' && (
                         <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                             testStatus === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                         }`}>
                             {testStatus === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                             <span className="break-all">{testMessage}</span>
                         </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                         <button
                            type="button"
                            onClick={handleTest}
                            disabled={!apiKey || isTesting}
                            className="col-span-1 flex items-center justify-center gap-2 py-3.5 rounded-lg font-bold text-sm transition-all border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50"
                        >
                            {isTesting ? <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-600 rounded-full animate-spin"></div> : <Zap className="w-4 h-4" />}
                            Test
                        </button>
                        <button
                            type="submit"
                            disabled={!apiKey}
                            className={`col-span-2 flex items-center justify-center gap-2 py-3.5 rounded-lg font-bold text-sm shadow-lg transition-all transform active:scale-[0.98] ${
                                apiKey 
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200' 
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            Connect
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </form>

                <div className="mt-12 flex justify-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Local Storage Only</span>
                    <span className="w-px h-3 bg-slate-200 my-auto"></span>
                    <span className="flex items-center gap-1"><Server className="w-3 h-3"/> Direct Connection</span>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
