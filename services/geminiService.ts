import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';

let client: GoogleGenAI | null = null;

// Helper to safely get the API Key.
// In Vite environments, process.env is often undefined at runtime in the browser, 
// leading to white screen crashes. We must check import.meta.env first.
const getApiKey = (): string => {
  // @ts-ignore - import.meta is a Vite/ESM standard
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }
  
  // Fallback for other environments or if process IS defined (e.g. Node)
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }

  // Final fallback: Check if it was injected globally
  // @ts-ignore
  if (typeof window !== 'undefined' && window.ENV && window.ENV.API_KEY) {
      // @ts-ignore
      return window.ENV.API_KEY;
  }

  console.warn("API Key not found in environment variables (VITE_API_KEY or API_KEY).");
  return "";
};

const getClient = (): GoogleGenAI => {
  if (!client) {
    const apiKey = getApiKey();
    if (!apiKey) {
      console.error("CRITICAL: No API Key provided. Calls will fail.");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
};

// Retry helper for transient server errors (500, 503) and Rate Limits (429)
const withRetry = async <T>(
  operation: () => Promise<T>, 
  maxRetries: number = 4, 
  baseDelay: number = 2000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorCode = error.status || error.code;
      const errorMessage = error.message || '';
      
      const isRetryable = 
        errorCode === 500 || 
        errorCode === 503 || 
        errorCode === 429 ||
        errorMessage.includes('Internal error') || 
        errorMessage.includes('Overloaded') ||
        errorMessage.includes('xhr error') ||
        errorMessage.includes('Rpc failed') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Resource exhausted');

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      let delay = baseDelay * Math.pow(2, attempt);
      
      if (errorCode === 429 || errorMessage.includes('xhr') || errorMessage.includes('Rpc')) {
          delay += 3000;
          console.warn(`Hit Rate Limit or Network Congestion. Pausing for ${delay}ms...`);
      } else {
          console.warn(`Gemini API Request failed (Attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`, error);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
};

export const analyzePageContent = async (
  imageBase64: string, 
  pageNumber: number,
  knowledgeBase: string = ""
): Promise<string> => {
  const ai = getClient();

  // Remove data:image/jpeg;base64, prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  let systemPrompt = SYSTEM_INSTRUCTION;
  if (knowledgeBase) {
      systemPrompt += `\n\n=== 📚 用户自定义参考标准/知识库 (CRITICAL: PRIORITY OVER GENERAL RULES) ===\n${knowledgeBase}\n\n=== 结束参考标准 ===\n请优先依据上述自定义标准进行审阅。如果文中术语与上述标准不符，必须标记为错误。`;
  }

  try {
    const response = await withRetry(async () => {
      return await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg', 
                data: base64Data
              }
            },
            {
              text: `请审阅第 ${pageNumber} 页。务必返回 HTML 片段。参考 Google Search 提供的实时信息验证术语。`
            }
          ]
        },
        config: {
          systemInstruction: systemPrompt,
          tools: [{ googleSearch: {} }],
        }
      });
    });

    let htmlContent = response.text || `
    <div class="page-review" id="page-${pageNumber}">
        <div class="page-header">
             <h2 class="page-title">第 ${pageNumber} 页</h2>
        </div>
        <div class="review-section">
             <p>AI 未返回有效内容。</p>
        </div>
    </div>`;

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (groundingChunks && groundingChunks.length > 0) {
        let sourcesHtml = `
        <div class="grounding-sources" style="margin-top: 24px; padding: 16px; background: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 8px;">
            <h4 style="margin: 0 0 12px 0; color: #475569; font-size: 0.9rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                🔍 Google 搜索参考来源
            </h4>
            <ul style="padding-left: 20px; margin: 0; font-size: 0.85rem; color: #2563eb; line-height: 1.6;">
        `;
        
        let hasValidSource = false;
        groundingChunks.forEach((chunk: any) => {
            if (chunk.web?.uri && chunk.web?.title) {
                hasValidSource = true;
                sourcesHtml += `
                <li style="margin-bottom: 4px;">
                    <a href="${chunk.web.uri}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: #2563eb; hover:underline;">
                        ${chunk.web.title}
                    </a>
                </li>`;
            }
        });
        
        sourcesHtml += `</ul></div>`;

        if (hasValidSource) {
            const closeDivIndex = htmlContent.lastIndexOf('</div>');
            if (closeDivIndex !== -1) {
                htmlContent = htmlContent.slice(0, closeDivIndex) + sourcesHtml + htmlContent.slice(closeDivIndex);
            } else {
                htmlContent += sourcesHtml;
            }
        }
    }

    return htmlContent;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return `
    <div class="page-review error-card" id="page-${pageNumber}">
        <div class="page-header">
            <h2 class="page-title">第 ${pageNumber} 页 - ⚠️ 审阅失败</h2>
        </div>
        <div class="review-section">
            <div class="suggestion-item">
                <span class="tag tag-error">系统错误</span>
                <span>此页面处理过程中发生异常，AI 暂无法生成审阅意见。建议导出该页后重试。</span>
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
