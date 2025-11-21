
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';

let client: GoogleGenAI | null = null;
// Load from localStorage if available (client-side only)
let customApiKey: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;

export const setCustomApiKey = (key: string) => {
  customApiKey = key;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('gemini_api_key', key);
  }
  client = null; // Reset client to force re-initialization with new key
};

export const clearCustomApiKey = () => {
  customApiKey = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('gemini_api_key');
  }
  client = null;
};

// Helper to safely get env var without crashing in browser
export const getEnvApiKey = (): string | undefined => {
  try {
    // Check for Vite specific env injection first if available
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_API_KEY;
    }
    
    // Safe check for process.env
    if (typeof process !== 'undefined' && process.env) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore reference errors in strict browser environments
  }
  return undefined;
};

const getClient = (): GoogleGenAI => {
  if (!client) {
    // Priority: Custom Key (User input) -> Env Key (Developer/Deployment)
    const envKey = getEnvApiKey();
    const apiKey = customApiKey || envKey;
    
    if (!apiKey) {
      throw new Error("未配置 API Key。请点击右上角“设置 Key”按钮输入您的 Google Gemini API Key。");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
};

export const analyzePageContent = async (
  imageBase64: string, 
  pageNumber: number
): Promise<string> => {
  const ai = getClient();

  // Remove data:image/jpeg;base64, prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  try {
    // Using gemini-3-pro-preview for better reasoning on complex math standards
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg', // Must match the format from pdfService
              data: base64Data
            }
          },
          {
            text: `请审阅第 ${pageNumber} 页。务必返回 HTML 片段。`
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }], // Enable Google Search for verifying terms
      }
    });

    // Extract text and return
    return response.text || `
    <div class="page-review" id="page-${pageNumber}">
        <div class="page-header">
             <h2 class="page-title">第 ${pageNumber} 页</h2>
        </div>
        <div class="review-section">
             <p>AI 未返回有效内容。</p>
        </div>
    </div>`;
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Return a structured HTML error card so the final report looks consistent
    // and the user knows exactly which page failed.
    return `
    <div class="page-review error-card" id="page-${pageNumber}">
        <div class="page-header">
            <h2 class="page-title">第 ${pageNumber} 页 - ⚠️ 审阅失败</h2>
        </div>
        <div class="review-section">
            <div class="suggestion-item">
                <span class="tag tag-error">系统错误</span>
                <span>此页面处理过程中发生异常，AI 未能生成审阅意见。请人工检查此页。</span>
            </div>
            <div style="margin-top: 16px; padding: 12px; background: #fff; border: 1px solid #fee2e2; border-radius: 6px;">
                <p style="font-family: monospace; color: #991b1b; font-size: 0.85em; margin: 0;">
                    Debug Info: ${(error as Error).message}
                </p>
            </div>
        </div>
        <div class="final-section">
             <p style="color: #64748b; font-style: italic;">(此处定稿暂缺)</p>
        </div>
    </div>`;
  }
};
