
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import { SYSTEM_INSTRUCTION } from '../constants';
import { ApiSettings } from '../types';

let client: GoogleGenAI | null = null;

export const saveApiSettings = (settings: ApiSettings) => {
    localStorage.setItem('mathedit_api_key', settings.apiKey);
    localStorage.setItem('mathedit_base_url', settings.baseUrl);
    client = null; // Force re-initialization
};

export const getApiSettings = (): ApiSettings | null => {
    const apiKey = localStorage.getItem('mathedit_api_key');
    let baseUrl = localStorage.getItem('mathedit_base_url') || 'https://generativelanguage.googleapis.com';
    
    // Fallback to env if not in local storage (for backward compatibility or dev)
    if (!apiKey && process.env.API_KEY) {
        return { apiKey: process.env.API_KEY, baseUrl };
    }

    if (!apiKey) return null;
    return { apiKey, baseUrl };
};

export const clearApiSettings = () => {
    localStorage.removeItem('mathedit_api_key');
    // We keep base_url as it might be tedious to re-type
    client = null;
};

// Helper to test connection with specific settings
export const testConnection = async (apiKey: string, baseUrl: string): Promise<boolean> => {
    try {
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const testClient = new GoogleGenAI({ apiKey, baseUrl: cleanBaseUrl });
        
        // Simple test request
        await testClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { role: 'user', parts: [{ text: 'Hi' }] }
        });
        return true;
    } catch (error) {
        console.error("Connection Test Failed:", error);
        throw error;
    }
};

// Retry helper with AbortSignal support
const withRetry = async <T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3, 
  baseDelay: number = 2000,
  signal?: AbortSignal
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (error.name === 'AbortError' || signal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
      }

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
        errorMessage.includes('Resource exhausted') ||
        errorMessage.includes('empty response'); 

      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }

      let delay = baseDelay * Math.pow(2, attempt);
      
      if (errorCode === 429) {
          delay += 3000;
          console.warn(`Hit Rate Limit. Pausing for ${delay}ms...`);
      }

      await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, delay);
          if (signal) {
              signal.addEventListener('abort', () => {
                  clearTimeout(timeout);
                  reject(new DOMException('Aborted', 'AbortError'));
              }, { once: true });
          }
      });
    }
  }
  throw lastError;
};

const getClient = (): GoogleGenAI => {
  if (!client) {
    const settings = getApiSettings();
    if (!settings) {
      throw new Error("API configuration missing. Please login.");
    }
    
    // Normalize URL: Remove trailing slash
    const cleanBaseUrl = settings.baseUrl.endsWith('/') 
        ? settings.baseUrl.slice(0, -1) 
        : settings.baseUrl;

    // Initialize with user provided settings
    client = new GoogleGenAI({ 
        apiKey: settings.apiKey,
        baseUrl: cleanBaseUrl
    });
  }
  return client;
};

const getErrorDetails = (error: any) => {
    if (error.name === 'AbortError' || error.message?.includes('Aborted')) {
        return { title: '已停止', desc: '用户手动停止了任务。', tips: [] };
    }

    const msg = (error.message || error.toString() || '').toLowerCase();
    const code = error.status || error.code;

    if (code === 401 || msg.includes('invalid api key')) {
        return {
            title: '鉴权失败 (Authentication Failed)',
            desc: 'API Key 无效或已过期。',
            tips: ['请退出登录后检查您的 API Key 是否正确。', '如果您使用了自定义代理地址，请确认该地址需要鉴权。']
        };
    }

    if (code === 404 || msg.includes('not found')) {
        return {
            title: '接口地址错误 (404 Not Found)',
            desc: '无法连接到指定的 API 地址。',
            tips: ['请检查登录页配置的 "API Endpoint" 是否正确。', '如果是第三方代理，请确认路径后缀（如 /v1beta/openai）是否匹配。']
        };
    }

    if (code === 429 || msg.includes('resource exhausted') || msg.includes('quota')) {
        const isSearchQuota = msg.includes('search_grounding');
        return {
            title: isSearchQuota ? '搜索配额耗尽 (Search Quota Exceeded)' : 'API 配额耗尽 (Quota Exceeded)',
            desc: isSearchQuota 
                ? 'Google Search Grounding 的每日调用限制（100次）已用完。' 
                : '当前 API Key 的并发或总量已达上限。',
            tips: [
                isSearchQuota ? '系统已自动降级为“无搜索模式”。' : '请稍后重试。',
                '如果您是付费会员，请检查 Google Cloud Console 的 Quota 设置。',
                '建议在首页尝试切换为 "Flash" 模型，它的速率限制更宽松。'
            ]
        };
    }

    if (msg.includes('safety') || msg.includes('blocked') || (error.filters && error.filters.length > 0)) {
        return {
            title: '内容安全拦截 (Safety Filter)',
            desc: 'AI 判定该页面内容可能涉及敏感信息，拒绝生成。',
            tips: [
                '这是 Google AI 的内置安全机制。',
                '尝试降低图片分辨率或裁剪图片。'
            ]
        };
    }

    if (msg.includes('xhr') || msg.includes('fetch') || msg.includes('network') || msg.includes('rpc')) {
        return {
            title: '网络传输失败',
            desc: '上传图片数据时连接中断或超时。',
            tips: [
                '当前页面图片数据量过大。',
                '系统已自动压缩图片，但网络环境可能不稳定。',
                '请检查您的网络连接或代理设置。'
            ]
        };
    }
    
    if (code >= 500 && code < 600) {
        return {
            title: '服务端异常 (Server Error)',
            desc: `API 服务暂时不可用 (Error ${code})。`,
            tips: ['上游服务临时故障，请稍后重试。']
        };
    }

    return {
        title: '处理异常',
        desc: '发生了一个未知错误。',
        tips: [`Error: ${msg.slice(0, 100)}...`]
    };
};

const cleanGeminiOutput = (text: string, pageNumber: number): string => {
    let cleaned = text.replace(/```html/gi, '').replace(/```/g, '').trim();

    const startTag = '<div class="page-review"';
    const startIndex = cleaned.indexOf(startTag);
    if (startIndex !== -1) {
        cleaned = cleaned.substring(startIndex);
    } else {
        cleaned = cleaned.replace(/^tool_code[\s\S]*?\n/gm, ''); 
        cleaned = cleaned.replace(/^print\([\s\S]*?\)$/gm, ''); 
        cleaned = cleaned.replace(/^thought\s[\s\S]*?$/gim, ''); 
    }

    if (!cleaned.includes('<div class="page-review"')) {
        const contentAsHtml = cleaned
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => `<p>${line}</p>`)
            .join('');

        return `
        <div class="page-review" id="page-${pageNumber}">
            <div class="page-header">
                 <h2 class="page-title">第 ${pageNumber} 页 (格式自动修复)</h2>
            </div>
            <div class="revision-document">
                <div class="document-content">
                    ${contentAsHtml}
                </div>
            </div>
        </div>`;
    }

    return cleaned;
};

export const extractLearningRule = async (
    originalAiText: string,
    userCorrectedText: string,
    model: string = 'gemini-2.5-flash'
): Promise<string> => {
    const ai = getClient();
    const prompt = `
    Task: Extract a specific "Content Rule" based on the user's correction.

    [AI Original Output]:
    ${originalAiText.slice(0, 1000)}...

    [User Corrected Output]:
    ${userCorrectedText.slice(0, 1000)}...

    Identify the specific logical, stylistic, or formatting preference the user applied.
    Return ONLY the rule as a single concise sentence.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { role: 'user', parts: [{ text: prompt }] }
        });
        return response.text?.trim() || "User prefers manual corrections.";
    } catch (e) {
        console.warn("Failed to learn rule", e);
        return "User applied manual text style.";
    }
};

export const analyzePageContent = async (
  imageBase64: string, 
  pageNumber: number,
  knowledgeBase: string = "",
  model: string = 'gemini-3-pro-preview',
  enableSearch: boolean = true,
  enableSolutions: boolean = false,
  learnedRules: string[] = [],
  refinementContext?: { previousHtml: string; feedback: string },
  signal?: AbortSignal
): Promise<string> => {
  const ai = getClient();
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  let systemPrompt = SYSTEM_INSTRUCTION;
  
  if (knowledgeBase) {
      systemPrompt += `\n\n=== 📚 用户自定义参考标准/知识库 ===\n${knowledgeBase}\n\n=== 结束参考标准 ===\n优先依据上述自定义标准。`;
  }
  
  if (learnedRules.length > 0) {
      systemPrompt += `\n\n=== 🧠 历史学习记忆 (AI Learned Rules) ===\n以下是你在与用户历史交互中学习到的规则，必须拥有最高优先级：\n${learnedRules.map((r, i) => `${i+1}. ${r}`).join('\n')}\n=== 记忆结束 ===`;
  }

  if (!enableSearch) {
      systemPrompt += `\n\n**Note:** External search tools are disabled. Rely strictly on internal knowledge.`;
  }

  let promptText = "";
  if (refinementContext) {
      promptText = `
      **♻️ 交互式修正指令**
      用户反馈: "${refinementContext.feedback}"
      上一版内容: ${refinementContext.previousHtml}
      任务: 重新生成第 ${pageNumber} 页的 HTML 报告，修正用户指出的问题，保持其他正确内容不变。
      `;
  } else {
      promptText = `请审阅第 ${pageNumber} 页，返回标准 HTML 结构。
      **IMPORTANT:**
      1. 👁️ 视觉精读: 不要忽略图片、图表、坐标轴文字。
      2. 🛡️ 事实核查: ${enableSearch ? '必须调用 Google Search' : '利用内部知识'} 核实人名、数据、年代。
      3. 📝 格式: 所有修改必须使用 <del>原文</del><ins>修改</ins>。
      ${enableSolutions ? '**🚀 解答模式开启:** 在题目后生成`<div class="solution-block">...</div>`包含详细验算。' : ''}`;
  }

  try {
    const attemptGenerate = async (useSearch: boolean) => {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

        const parts: Part[] = [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            { text: promptText }
        ];

        const config: any = {
            systemInstruction: systemPrompt,
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        };
        
        if (useSearch) config.tools = [{ googleSearch: {} }];

        const apiPromise = ai.models.generateContent({
            model: model,
            contents: { parts },
            config: config
        });

        const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Request timed out (120s limit)")), 120000)
        );

        const abortPromise = new Promise<never>((_, reject) => {
             if (signal) {
                 signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
             }
        });

        const response = await Promise.race([apiPromise, timeoutPromise, ...(signal ? [abortPromise] : [])]);

        if (!response.text) throw new Error("AI returned an empty response.");
        
        return { 
            text: response.text, 
            groundingMetadata: response.candidates?.[0]?.groundingMetadata,
            fallbackUsed: !useSearch && enableSearch 
        };
    };

    const responseData = await withRetry(async () => {
        try {
            return await attemptGenerate(enableSearch);
        } catch (error: any) {
            if (signal?.aborted) throw error; 
            if (enableSearch && !error.message?.includes('timed out')) {
                 return await attemptGenerate(false);
            }
            throw error;
        }
    }, 3, 2000, signal);

    let htmlContent = cleanGeminiOutput(responseData.text, pageNumber);

    if (responseData.fallbackUsed) {
        const warningHtml = `<div class="review-section" style="background:#fffbeb;border-bottom:1px solid #fcd34d;"><div class="suggestion-item"><span class="tag tag-style" style="background:#fbbf24;color:#78350f;">⚠️ 搜索受限</span><span>自动切换至纯推理模式。</span></div></div>`;
        const idx = htmlContent.indexOf('<div class="review-section"');
        if (idx !== -1) htmlContent = htmlContent.slice(0, idx) + warningHtml + htmlContent.slice(idx);
    }

    return htmlContent;

  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('Aborted')) {
        throw error;
    }

    console.error("Gemini API Error:", error);
    const errorDetails = getErrorDetails(error);

    return `
    <div class="page-review error-card" id="page-${pageNumber}">
        <div class="page-header">
            <h2 class="page-title">PAGE ${pageNumber} - ⚠️ ${errorDetails.title}</h2>
        </div>
        <div class="review-section">
            <div class="suggestion-item">
                <span class="tag tag-error">处理失败</span>
                <span>${errorDetails.desc}</span>
            </div>
             <p style="padding:15px; font-family:monospace; color:#991b1b; font-size: 0.8em;">Debug: ${(error as Error).message}</p>
        </div>
    </div>`;
  }
};
