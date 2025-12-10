
import { SYSTEM_INSTRUCTION } from '../constants';
import { ApiSettings, AiProvider } from '../types';

// Native Fetch Implementation - No SDK Dependency

export const saveApiSettings = (settings: ApiSettings) => {
    localStorage.setItem('mathedit_api_key', settings.apiKey);
    localStorage.setItem('mathedit_base_url', settings.baseUrl);
    localStorage.setItem('mathedit_provider', settings.provider);
};

export const getApiSettings = (): ApiSettings | null => {
    const apiKey = localStorage.getItem('mathedit_api_key');
    let baseUrl = localStorage.getItem('mathedit_base_url');
    const provider = (localStorage.getItem('mathedit_provider') as AiProvider) || 'google';
    
    // Set default base URLs if missing
    if (!baseUrl) {
        if (provider === 'google') baseUrl = 'https://generativelanguage.googleapis.com';
        else if (provider === 'openai') baseUrl = 'https://api.openai.com/v1';
        else if (provider === 'anthropic') baseUrl = 'https://api.anthropic.com';
    }
    
    if (!apiKey && process.env.API_KEY && provider === 'google') {
        return { apiKey: process.env.API_KEY, baseUrl: baseUrl!, provider };
    }

    if (!apiKey) return null;
    return { apiKey, baseUrl: baseUrl!, provider };
};

export const clearApiSettings = () => {
    localStorage.removeItem('mathedit_api_key');
    // We keep the provider/url preference for convenience
};

const normalizeUrl = (url: string) => {
    let clean = url.trim();
    while (clean.endsWith('/')) clean = clean.slice(0, -1);
    return clean;
};

// --- Provider Specific Logic ---

const getFetchModelsUrl = (settings: ApiSettings) => {
    const base = normalizeUrl(settings.baseUrl);
    switch (settings.provider) {
        case 'google':
            return `${base}/v1beta/models?key=${settings.apiKey}`;
        case 'openai':
            // Standard OpenAI compatible endpoint
            return `${base}/models`;
        case 'anthropic':
            // Anthropic doesn't have a public public list models endpoint that is standard
            // We return null to indicate usage of static list
            return null;
        default:
            return `${base}/models`;
    }
};

const getGenerateUrl = (settings: ApiSettings, model: string) => {
    const base = normalizeUrl(settings.baseUrl);
    const cleanModel = model.replace('models/', '');
    
    switch (settings.provider) {
        case 'google':
            return `${base}/v1beta/models/${cleanModel}:generateContent?key=${settings.apiKey}`;
        case 'openai':
            return `${base}/chat/completions`;
        case 'anthropic':
            return `${base}/v1/messages`;
    }
};

const getHeaders = (settings: ApiSettings) => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    
    if (settings.provider === 'openai') {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
    } else if (settings.provider === 'anthropic') {
        headers['x-api-key'] = settings.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    
    return headers;
};

// --- API Functions ---

export const fetchModels = async (): Promise<string[]> => {
    const settings = getApiSettings();
    if (!settings) return [];

    const url = getFetchModelsUrl(settings);
    if (!url) {
        // Fallback for providers without model listing (like standard Anthropic or restricted proxies)
        if (settings.provider === 'anthropic') {
            return ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'];
        }
        return []; 
    }

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders(settings)
        });
        
        if (!response.ok) {
            console.warn("Failed to fetch models list, falling back to defaults.");
            return [];
        }
        const data = await response.json();
        
        if (settings.provider === 'google' && data.models) {
            return data.models
                .map((m: any) => m.name.replace('models/', ''))
                .filter((n: string) => n.includes('gemini'))
                .sort((a: string, b: string) => b.localeCompare(a));
        } else if (settings.provider === 'openai') {
             // For OpenAI compatible endpoints (OneAPI, NewAPI, Grok, DeepSeek, etc.)
             // The standard response is { data: [ { id: "..." }, ... ] }
             
             let modelList: any[] = [];
             if (data.data && Array.isArray(data.data)) {
                 modelList = data.data;
             } else if (Array.isArray(data)) {
                 // Some non-standard proxies might return array directly
                 modelList = data;
             }

             return modelList
                .map((m: any) => m.id)
                .filter((id: any) => typeof id === 'string') // Ensure ID is a string
                .sort();
        }
        return [];
    } catch (e) {
        console.warn("Error fetching models:", e);
        return [];
    }
};

export const testConnection = async (apiKey: string, baseUrl: string, provider: AiProvider): Promise<boolean> => {
    // For test, we use a simple call. 
    // Google: list models. OpenAI: list models. Anthropic: simple message (since list models isn't standard)
    
    const settings: ApiSettings = { apiKey, baseUrl, provider };
    
    try {
        if (provider === 'anthropic') {
             // Test Anthropic with a dummy message
             const url = getGenerateUrl(settings, 'claude-3-haiku-20240307');
             const response = await fetch(url, {
                 method: 'POST',
                 headers: getHeaders(settings),
                 body: JSON.stringify({
                     model: 'claude-3-haiku-20240307',
                     max_tokens: 1,
                     messages: [{ role: 'user', content: 'Hi' }]
                 })
             });
             if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `HTTP ${response.status}`);
             }
             return true;
        } else {
            const url = getFetchModelsUrl(settings);
            if (!url) return true; // Should not happen for google/openai

            const response = await fetch(url, { method: 'GET', headers: getHeaders(settings) });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `HTTP ${response.status}`);
            }
            return true;
        }
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
    
    if (msg.includes('api key') || msg.includes('401') || msg.includes('403') || msg.includes('invalid')) {
        return {
            title: '鉴权失败 (Auth Error)',
            desc: 'API Key 无效或无权访问该模型。',
            tips: ['请检查 API Key 是否正确。', 'Anthropic 需要开启 direct browser access。']
        };
    }
    if (msg.includes('404')) {
        return {
            title: '模型或路径不存在',
            desc: '请求的 URL 或模型名称无效。',
            tips: ['检查 Base URL 设置。', 'OpenAI 兼容接口通常以 /v1 结尾。']
        };
    }
    if (msg.includes('429') || msg.includes('quota')) {
        return {
            title: '配额耗尽 (Quota Exceeded)',
            desc: '请求过于频繁或配额已用完。',
            tips: ['请稍后重试。', '检查您的 API 账户余额。']
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

    // Convert Markdown trackers to HTML tags for visualization
    cleaned = cleaned.replace(/~~(.*?)~~/g, '<del>$1</del>');
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '<ins>$1</ins>');

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

// --- Main Analysis Logic ---

export const extractLearningRule = async (
    originalAiText: string,
    userCorrectedText: string,
    model: string = 'gemini-2.5-flash'
): Promise<string> => {
    const settings = getApiSettings();
    if (!settings) return "User applied manual text style.";

    const url = getGenerateUrl(settings, model);
    const prompt = `Task: Extract a specific "Content Rule" based on the user's correction.\n[AI Original]: ${originalAiText.slice(0, 500)}...\n[User Corrected]: ${userCorrectedText.slice(0, 500)}...\nReturn ONLY the rule as a single concise sentence.`;

    let body: any;
    if (settings.provider === 'google') {
        body = { contents: [{ parts: [{ text: prompt }] }] };
    } else if (settings.provider === 'openai') {
        body = {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1
        };
    } else if (settings.provider === 'anthropic') {
         body = {
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 100
        };
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: getHeaders(settings),
            body: JSON.stringify(body)
        });
        const data = await response.json();
        
        if (settings.provider === 'google') return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (settings.provider === 'openai') return data.choices?.[0]?.message?.content?.trim();
        if (settings.provider === 'anthropic') return data.content?.[0]?.text?.trim();
        
        return "User applied manual text style.";
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

    const url = getGenerateUrl(settings, model);
    const cleanModel = model.replace('models/', '');

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    let systemPrompt = SYSTEM_INSTRUCTION;
    if (knowledgeBase) systemPrompt += `\n\n=== 📚 Knowledge Base ===\n${knowledgeBase}`;
    if (learnedRules.length > 0) systemPrompt += `\n\n=== 🧠 Learned Rules ===\n${learnedRules.map((r,i)=>`${i+1}. ${r}`).join('\n')}`;
    
    // Search is only supported on Google via tool use natively in this app structure.
    // For others, we assume the model has internal knowledge or user disabled it.
    if (settings.provider !== 'google' && enableSearch) {
        // Soft warning in prompt, as we can't inject the tool
        systemPrompt += `\n\n(Note: External live search is unavailable for ${settings.provider}. Use internal knowledge.)`;
    } else if (!enableSearch) {
        systemPrompt += `\n\nExternal search disabled.`;
    }

    let userPrompt = "";
    if (refinementContext) {
        userPrompt = `**Correction Task**\nFeedback: "${refinementContext.feedback}"\nPrevious Content: ${refinementContext.previousHtml}\nTask: Regenerate Page ${pageNumber} HTML correcting issues.`;
    } else {
        userPrompt = `Review Page ${pageNumber}. Return valid HTML. ${enableSolutions ? 'Include math solutions.' : ''}`;
    }

    // Construct Payload based on provider
    let payload: any = {};

    if (settings.provider === 'google') {
        payload = {
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: mimeType, data: base64Data } },
                    { text: userPrompt }
                ]
            }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            safetySettings: [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
            generationConfig: { temperature: 0.2 }
        };
        if (enableSearch) payload.tools = [{ googleSearch: {} }];
    } 
    else if (settings.provider === 'openai') {
        // OpenAI / Grok / DeepSeek format
        // This format is "OpenAI Compatible" - most proxies (OneAPI) expect this structure 
        // regardless of whether the backend model is actually Claude or Grok.
        payload = {
            model: cleanModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { 
                    role: 'user', 
                    content: [
                        { type: "text", text: userPrompt },
                        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                    ] 
                }
            ],
            temperature: 0.2
        };
    } 
    else if (settings.provider === 'anthropic') {
        payload = {
            model: cleanModel,
            system: systemPrompt,
            messages: [
                { 
                    role: 'user', 
                    content: [
                        { type: "image", source: { type: "base64", media_type: mimeType, data: base64Data } },
                        { type: "text", text: userPrompt }
                    ] 
                }
            ],
            max_tokens: 4096, // Anthropic requires max_tokens
            temperature: 0.2
        };
    }

    const performRequest = async (currentEnableSearch: boolean) => {
        // For Google, we might need to strip tools if retrying without search
        if (settings.provider === 'google' && !currentEnableSearch && payload.tools) {
            delete payload.tools;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: getHeaders(settings),
            body: JSON.stringify(payload),
            signal
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.error?.message || JSON.stringify(errBody) || `HTTP ${response.status}`);
        }

        const data = await response.json();
        let text = '';
        let grounding = null;

        if (settings.provider === 'google') {
            if (!data.candidates || data.candidates.length === 0) {
                 if (data.promptFeedback?.blockReason) throw new Error(`Blocked: ${data.promptFeedback.blockReason}`);
                 throw new Error("Empty response");
            }
            text = data.candidates[0].content?.parts?.map((p: any) => p.text).join('') || '';
            grounding = data.candidates[0].groundingMetadata;
        } else if (settings.provider === 'openai') {
            text = data.choices?.[0]?.message?.content || '';
        } else if (settings.provider === 'anthropic') {
            text = data.content?.[0]?.text || '';
        }

        return { text, groundingMetadata: grounding, fallbackUsed: !currentEnableSearch && enableSearch && settings.provider === 'google' };
    };

    try {
        const responseData = await withRetry(async () => {
            try {
                return await performRequest(enableSearch);
            } catch (error: any) {
                if (signal?.aborted) throw error;
                // Only retry Google search errors without search
                if (settings.provider === 'google' && enableSearch && !error.message?.includes('timed out')) {
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
        
        console.error("Fetch Error:", error);
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
