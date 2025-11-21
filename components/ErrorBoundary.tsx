import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyError = () => {
    const text = `Error: ${this.state.error?.message}\n\nStack: ${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(text);
    alert("错误信息已复制到剪贴板");
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
          <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg border border-red-100 overflow-hidden">
            <div className="bg-red-50 p-6 border-b border-red-100 flex items-start gap-4">
              <div className="bg-white p-2 rounded-full shadow-sm">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">应用遇到了一些问题</h2>
                <p className="text-red-800 mt-1">很抱歉，程序发生了一个未捕获的异常导致崩溃。</p>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-700">错误摘要:</h3>
                <div className="bg-gray-900 text-red-300 p-4 rounded-lg font-mono text-sm break-words">
                  {this.state.error?.message || 'Unknown Error'}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-gray-700">详细堆栈 (Debug Info):</h3>
                <div className="bg-gray-100 text-gray-600 p-4 rounded-lg font-mono text-xs overflow-auto max-h-60 whitespace-pre-wrap border border-gray-200">
                   {this.state.errorInfo?.componentStack || this.state.error?.stack || 'No stack trace available'}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                  onClick={this.handleReload}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  刷新页面重试
                </button>
                <button 
                  onClick={this.handleCopyError}
                  className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  复制错误信息
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;