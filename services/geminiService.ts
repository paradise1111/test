
import { SYSTEM_INSTRUCTION } from '../constants';
import { ApiSettings } from '../types';

// Native Fetch Implementation - No SDK Dependency

export const saveApiSettings = (settings: ApiSettings) => {
    localStorage.setItem('mathedit_api_key', settings.apiKey);
    localStorage.setItem('mathedit_base_url', settings.baseUrl);
};

export const getApiSettings = (): ApiSettings | null => {
    const apiKey = localStorage.getItem('mathedit_api_key');
    let baseUrl = localStorage.getItem('mathedit_base_url') || 'https://generativelanguage.googleapis.com';
    
    if (!apiKey && process.env.API_KEY) {
        return { apiKey: process.env.API_KEY, baseUrl };
    }

    if (!apiKey) return null;
    return { apiKey, baseUrl };
};

export const clearApiSettings = () => {
    localStorage.removeItem('mathedit_api_key');
};

const normalizeUrl = (url: string) => {
    let clean = url.trim();
    while (clean.endsWith('/')) clean = clean.slice(0, -1);
    return clean;
};

// --- API Functions ---

export const fetchModels = async (): Promise<string[]> => {
    const settings = getApiSettings();
    if (!settings) return [];

    const baseUrl = normalizeUrl(settings.baseUrl);
    // Use v1beta endpoint to list models
    const url = `${baseUrl}/v1beta/models?key=${settings.apiKey}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn("Failed to fetch models list, falling back to defaults.");
            return [];
        }
        const data = await response.json();
        if (data.models && Array.isArray(data.models)) {
            return data.models
                .map((m: any) => m.name.replace('models/', ''))
                // Prioritize displaying gemini models
                .filter((n: string) => n.includes('gemini'))
                .sort((a: string, b: string) => b.localeCompare(a));
        }
        return [];
    } catch (e) {
        console.warn("Error fetching models:", e);
        return [];
    }
};

export const testConnection = async (apiKey: string, baseUrl: string): Promise<boolean> => {
    const cleanUrl = normalizeUrl(baseUrl);
    // Lightweight check: List models
    const url = `${cleanUrl}/v1beta/models?key=${apiKey}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP Error ${response.status}`);
        }
        return true;
    } catch (error) {
        console.error("Connection Test Failed:", error);
        throw error;
    }
};

const withRetry = async <T>(
  operation: () => Promise<T>, 
  maxRetries: number = 3, 
  baseDelay: number = 2000,
  signal?: AbortSignal
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (error.name === 'AbortError' || signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const msg = (error.message || '').toLowerCase();
      const code = error.status || 0;
      
      const isRetryable = 
        code === 429 || code >= 500 || 
        msg.includes('fetch failed') || 
        msg.includes('networkerror') ||
        msg.includes('overloaded');

      if (!isRetryable || attempt === maxRetries - 1) throw error;

      let delay = baseDelay * Math.pow(2, attempt);
      if (code === 429) delay += 3000;

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

const getErrorDetails = (error: any) => {
    if (error.name === 'AbortError') {
        return { title: '已停止', desc: '用户手动停止了任务。', tips: [] };
    }

    const msg = (error.message || '').toLowerCase();
    
    if (msg.includes('api key') || msg.includes('400') || msg.includes('invalid')) {
        return {
            title: '配置错误 (Invalid Request)',
            desc: 'API Key 无效或请求参数错误。',
            tips: ['请检查 API Key 是否正确。', '检查 Base URL 是否正确。']
        };
    }
    if (msg.includes('429') || msg.includes('quota')) {
        return {
            title: '配额耗尽 (Quota Exceeded)',
            desc: '请求过于频繁或配额已用完。',
            tips: ['请稍后重试。', '尝试切换到 Flash 模型（配额较高）。']
        };
    }
    if (msg.includes('fetch failed') || msg.includes('network')) {
        return {
            title: '网络连接失败',
            desc: '无法连接到 API 服务器。',
            tips: ['请检查网络或代理设置。', '确认 Base URL 是否可访问。']
        };
    }

    return {
        title: '处理异常',
        desc: '发生了一个错误。',
        tips: [`Error: ${msg.slice(0, 100)}`]
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
    const settings = getApiSettings();
    if (!settings) return "User applied manual text style.";

    const baseUrl = normalizeUrl(settings.baseUrl);
    const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${settings.apiKey}`;

    const prompt = `
    Task: Extract a specific "Content Rule" based on the user's correction.
    [AI Original]: ${originalAiText.slice(0, 500)}...
    [User Corrected]: ${userCorrectedText.slice(0, 500)}...
    Return ONLY the rule as a single concise sentence.
    `;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "User prefers manual corrections.";
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
    const settings = getApiSettings();
    if (!settings) throw new Error("API configuration missing. Please login.");

    const baseUrl = normalizeUrl(settings.baseUrl);
    const cleanModel = model.replace('models/', '');
    // Using v1beta for widest compatibility with tools
    const url = `${baseUrl}/v1beta/models/${cleanModel}:generateContent?key=${settings.apiKey}`;

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    let systemPrompt = SYSTEM_INSTRUCTION;
    if (knowledgeBase) systemPrompt += `\n\n=== 📚 Knowledge Base ===\n${knowledgeBase}`;
    if (learnedRules.length > 0) systemPrompt += `\n\n=== 🧠 Learned Rules ===\n${learnedRules.map((r,i)=>`${i+1}. ${r}`).join('\n')}`;
    if (!enableSearch) systemPrompt += `\n\nExternal search disabled.`;

    let userPrompt = "";
    if (refinementContext) {
        userPrompt = `**Correction Task**\nFeedback: "${refinementContext.feedback}"\nPrevious Content: ${refinementContext.previousHtml}\nTask: Regenerate Page ${pageNumber} HTML correcting issues.`;
    } else {
        userPrompt = `Review Page ${pageNumber}. Return valid HTML. ${enableSolutions ? 'Include math solutions.' : ''}`;
    }

    // Construct Payload
    const payload: any = {
        contents: [{
            role: 'user',
            parts: [
                { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
                { text: userPrompt }
            ]
        }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
        generationConfig: {
            temperature: 0.2 // Low temperature for factual accuracy
        }
    };

    if (enableSearch) {
        payload.tools = [{ googleSearch: {} }];
    }

    const performRequest = async (currentEnableSearch: boolean) => {
        if (!currentEnableSearch && payload.tools) delete payload.tools;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.error?.message || `HTTP ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Handle potential empty responses or blocks
        if (!data.candidates || data.candidates.length === 0) {
            if (data.promptFeedback?.blockReason) {
                throw new Error(`Blocked by AI Safety: ${data.promptFeedback.blockReason}`);
            }
            throw new Error("AI returned empty response.");
        }

        const text = data.candidates[0].content?.parts?.map((p: any) => p.text).join('') || '';
        const grounding = data.candidates[0].groundingMetadata;

        return { text, groundingMetadata: grounding, fallbackUsed: !currentEnableSearch && enableSearch };
    };

    try {
        const responseData = await withRetry(async () => {
            try {
                return await performRequest(enableSearch);
            } catch (error: any) {
                if (signal?.aborted) throw error;
                // If search fails (e.g. 400 or quota), try without search
                if (enableSearch && !error.message?.includes('timed out')) {
                    console.warn("Search failed, retrying without search...", error);
                    return await performRequest(false);
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
        if (error.name === 'AbortError') throw error;
        
        console.error("Gemini Fetch Error:", error);
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
