
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
    // Default to openai if not set, as requested for OneAPI compatibility
    const provider = (localStorage.getItem('mathedit_provider') as AiProvider) || 'openai';
    
    if (!baseUrl) {
        if (provider === 'google') baseUrl = 'https://generativelanguage.googleapis.com';
        else baseUrl = 'https://api.openai.com/v1'; // Default placeholder
    }
    
    if (!apiKey) return null;
    return { apiKey, baseUrl: baseUrl!, provider };
};

export const clearApiSettings = () => {
    localStorage.removeItem('mathedit_api_key');
};

const normalizeUrl = (url: string) => {
    let clean = url.trim();
    while (clean.endsWith('/')) clean = clean.slice(0, -1);
    // Ensure we don't accidentally double-append /v1 if the user already provided it
    // But for raw base URLs like http://domain.com, we might need it. 
    // The user example shows input: http://.../v1, so we assume user inputs full base path.
    return clean;
};

// --- API Functions ---

export const fetchModels = async (): Promise<string[]> => {
    const settings = getApiSettings();
    if (!settings) return [];

    const baseUrl = normalizeUrl(settings.baseUrl);
    
    // Google Native Path
    if (settings.provider === 'google') {
        const url = `${baseUrl}/v1beta/models?key=${settings.apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return (data.models || [])
                .map((m: any) => m.name.replace('models/', ''))
                .filter((n: string) => n.includes('gemini'))
                .sort();
        } catch (e) {
            console.warn("Google fetch models failed", e);
            return [];
        }
    }

    // OpenAI / OneAPI Path
    // Standard: GET /models
    const url = `${baseUrl}/models`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${settings.apiKey}` }
        });
        
        if (!response.ok) {
            console.warn(`Fetch models failed: ${response.status}`);
            return [];
        }

        const data = await response.json();
        
        // Handle various response formats from different proxies
        // Standard: { data: [{ id: "..." }, ...] }
        // Some: { models: [...] }
        // Some: [...]
        let list: any[] = [];
        if (Array.isArray(data.data)) list = data.data;
        else if (Array.isArray(data.models)) list = data.models;
        else if (Array.isArray(data)) list = data;

        return list
            .map((item: any) => item.id || item.name) // prioritize ID
            .filter((id: any) => typeof id === 'string')
            .sort();
            
    } catch (e) {
        console.warn("OpenAI/OneAPI fetch models failed", e);
        return [];
    }
};

export const testConnection = async (apiKey: string, baseUrl: string, provider: AiProvider): Promise<boolean> => {
    const cleanBase = normalizeUrl(baseUrl);

    try {
        if (provider === 'google') {
             const url = `${cleanBase}/v1beta/models?key=${apiKey}`;
             const res = await fetch(url);
             if (!res.ok) throw new Error(`HTTP ${res.status}`);
             return true;
        }

        // For OpenAI/OneAPI, we test by fetching models as per the example
        const url = `${cleanBase}/models`;
        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error?.message || `HTTP ${res.status}`);
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
      const msg = (error.message || '').toLowerCase();
      const code = error.status || 0;
      const isRetryable = code === 429 || code >= 500 || msg.includes('fetch failed') || msg.includes('networkerror');
      if (!isRetryable || attempt === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
    }
  }
  throw lastError;
};

const cleanGeminiOutput = (text: string, pageNumber: number): string => {
    // Remove markdown code blocks if present
    let cleaned = text.replace(/```html/gi, '').replace(/```/g, '').trim();

    // Try to find the start of the valid HTML structure
    const startTag = '<div class="page-review"';
    const startIndex = cleaned.indexOf(startTag);
    if (startIndex !== -1) {
        cleaned = cleaned.substring(startIndex);
    } 

    // Basic cleaning of markdown bold/strikethrough if the model returned markdown instead of HTML tags
    cleaned = cleaned.replace(/~~(.*?)~~/g, '<del>$1</del>');
    cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '<ins>$1</ins>');

    // Fallback wrapper if strictly formatted HTML is missing
    if (!cleaned.includes('<div class="page-review"')) {
        const contentAsHtml = cleaned
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => `<p>${line}</p>`)
            .join('');

        return `
        <div class="page-review" id="page-${pageNumber}">
            <div class="page-header">
                 <h2 class="page-title">PAGE ${pageNumber} (Auto-Formatted)</h2>
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
    model: string
): Promise<string> => {
    const settings = getApiSettings();
    if (!settings) return "Manual correction.";
    
    // Simple prompt for rule extraction
    const prompt = `Task: Extract a specific rule based on the user's correction.\nOriginal: ${originalAiText.slice(0, 300)}\nCorrection: ${userCorrectedText.slice(0, 300)}\nRule:`;

    // OpenAI Compatible Call
    try {
        const url = `${normalizeUrl(settings.baseUrl)}/chat/completions`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 100
            })
        });
        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || "Manual correction.";
    } catch (e) {
        return "Manual correction.";
    }
};

export const analyzePageContent = async (
  imageBase64: string, 
  pageNumber: number,
  knowledgeBase: string = "",
  model: string = 'gpt-4o',
  enableSearch: boolean = true,
  enableSolutions: boolean = false,
  learnedRules: string[] = [],
  refinementContext?: { previousHtml: string; feedback: string },
  signal?: AbortSignal
): Promise<string> => {
    const settings = getApiSettings();
    if (!settings) throw new Error("API configuration missing.");

    const baseUrl = normalizeUrl(settings.baseUrl);
    const cleanModel = model.replace('models/', '');

    // Image Prep
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

    // Prompt Construction
    let systemPrompt = SYSTEM_INSTRUCTION;
    if (knowledgeBase) systemPrompt += `\n\n=== 📚 Knowledge Base ===\n${knowledgeBase}`;
    if (learnedRules.length > 0) systemPrompt += `\n\n=== 🧠 Learned Rules ===\n${learnedRules.map((r,i)=>`${i+1}. ${r}`).join('\n')}`;
    
    if (settings.provider !== 'google' && enableSearch) {
        systemPrompt += `\n\n(Note: External live search is unavailable in this mode.)`;
    }

    let userPrompt = "";
    if (refinementContext) {
        userPrompt = `Correction Task:\nFeedback: "${refinementContext.feedback}"\nPrevious: ${refinementContext.previousHtml}\nRegenerate Page ${pageNumber} HTML.`;
    } else {
        userPrompt = `Review Page ${pageNumber}. Return valid HTML. ${enableSolutions ? 'Include math solutions.' : ''}`;
    }

    // Google Native Path
    if (settings.provider === 'google') {
        const url = `${baseUrl}/v1beta/models/${cleanModel}:generateContent?key=${settings.apiKey}`;
        const payload = {
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: mimeType, data: base64Data } },
                    { text: userPrompt }
                ]
            }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.2 }
        };
        // @ts-ignore
        if (enableSearch) payload.tools = [{ googleSearch: {} }];

        const response = await withRetry(async () => {
             const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal
             });
             if (!res.ok) throw new Error(`Google API Error: ${res.status}`);
             return res.json();
        }, 3, 2000, signal);

        const text = response.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
        return cleanGeminiOutput(text, pageNumber);
    }

    // OpenAI / OneAPI Path (The "Logic Kernel" replacement)
    // Uses POST /chat/completions
    const url = `${baseUrl}/chat/completions`;
    
    const payload = {
        model: cleanModel,
        messages: [
            { role: 'system', content: systemPrompt },
            { 
                role: 'user', 
                content: [
                    { type: "text", text: userPrompt },
                    { 
                        type: "image_url", 
                        image_url: { 
                            url: `data:${mimeType};base64,${base64Data}`,
                            detail: "high" 
                        } 
                    }
                ] 
            }
        ],
        temperature: 0.2,
        stream: false 
    };

    try {
        const data = await withRetry(async () => {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.apiKey}`
                },
                body: JSON.stringify(payload),
                signal
            });
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error?.message || `HTTP ${res.status}`);
            }
            return res.json();
        }, 3, 2000, signal);

        const text = data.choices?.[0]?.message?.content || '';
        return cleanGeminiOutput(text, pageNumber);

    } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        console.error("Analysis Failed:", error);
        
        return `
        <div class="page-review error-card" id="page-${pageNumber}">
            <div class="page-header"><h2 class="page-title">PAGE ${pageNumber} - ERROR</h2></div>
            <div class="review-section">
                <div class="suggestion-item">
                    <span class="tag tag-error">Failed</span>
                    <span>${error.message || "Unknown error"}</span>
                </div>
            </div>
        </div>`;
    }
};
