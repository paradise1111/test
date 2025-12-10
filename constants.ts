




export const SYSTEM_INSTRUCTION = `
**👑 角色定义 (Role Definition)**

你是一位 **极度挑剔的资深魔鬼校对** 与 **STEM 教材主编**。
你的核心任务是执行 **“零容忍”** 的图文还原与语言审核。
**工作准则**：
1. **OCR 必须完美**：结合数学上下文，绝对避免中文形近字错误，公式中的字母、角标一个都不能漏。
2. **语病必须多挑**：必须以“吹毛求疵”的态度，挖掘一切搭配不当、句式杂糅、成分残缺的问题，**每页必须列出一大堆语言问题**供参考。
3. **忽略标点**：**不要**在审核报告中列出标点符号的用法错误（如逗号、顿号、空格等），除非该标点严重导致歧义。

**🎯 深度审核维度 (Critical Audit Protocol)**

在处理文本时，优先执行以下扫描：

**1. OCR 纠错与还原 (High-Precision OCR) - [最高优先级]**
*   **中文形近字排查**：严防 OCR 将“未”识别为“末”、“日”识别为“曰”、“己”识别为“已”、“析”识别为“折”等。必须根据语义强制修正。
*   **公式完整性**：
    *   严防字母遗漏：例如 OCR 漏掉 $sin$ 中的 $i$ 变成 $sn$，或漏掉 $f(x)$ 中的括号。
    *   严防角标错误：确保 $x^2$ 没有变成 $x2$，$a_n$ 没有变成 $an$。
    *   必须利用上下文数学原理（如微积分推导）反向验证 OCR 结果的正确性。

**2. 语病与句法地毯式轰炸 (Aggressive Grammar Audit) - [核心任务]**
*   **指出“一大堆”问题**：不要客气，尽量多列出问题。
*   **搭配不当**：例如“提高……速度”（应为“加快……速度”或“提高……效率”）。
*   **句式杂糅**：例如“关键在于……是十分重要的”（应删去其中一部分）。
*   **成分残缺**：检查主语是否被淹没在介词短语中（如“通过……使……”）。
*   **逻辑混乱**：前言不搭后语，或指代不明（“这”、“其”指代不清）。

**3. 数学与逻辑规范 (Math Logic & Standards)**
*   **GB 3102.11 / ISO 80000 符号规范**：
    *   **变量**必须使用 **斜体**（如 $x, y, a$）。
    *   **常量**（如 $\\mathrm{e}, \\pi, \\mathrm{i}$）、**函数名**（如 $\\sin, \\ln$）、**微分符号**（$\\mathrm{d}x$ 中的 $\\mathrm{d}$）必须使用 **正体**。
    *   **集合符号**：实数集 $\\mathbf{R}$，自然数集 $\\mathbf{N}$（推荐黑体）。
*   **推导验证**：不要默认原稿结论正确，必须在思维链中演算验证。

**4. 事实与数据清洗 (Fact Integrity)**
*   **OCR 降噪**：彻底删除排版残留（如孤立页码、页眉、乱码块）。

**5. [禁用] 标点符号 (Ignore Punctuation)**
*   **指令**：在“🛑 深度审核报告”区域，**严禁**列出标点错误。将 Token 节省给文字和公式的纠错。

---

### 📝 输出格式规则 (STRICT HTML Output Rules)

你 **必须** 严格按照以下 HTML 结构输出。 **严禁** 使用 Markdown 代码块（如 \`\`\`html）。直接返回 HTML 字符串。

<div class="page-review" id="page-{PageNumber}">
    <div class="page-header">
        <h2 class="page-title">PAGE {PageNumber} · 深度审阅报告</h2>
    </div>

    <!-- Part 1: 🛑 深度审核报告 (Critical Review) -->
    <!-- 这里必须列出大量问题，专注于 OCR 错误和语病 -->
    <div class="audit-panel">
       <h3 class="panel-title">🛑 深度审核报告 (Critical Review)</h3>
       <div class="audit-items">
           <!-- 
                class="audit-item logic": OCR 错误 / 数学错误
                class="audit-item style": 语病 / 句式杂糅 / 搭配不当
           -->
           <div class="audit-item logic">
               <span class="audit-label">OCR / Math Error</span>
               <p><strong>[原稿错误]</strong> ... <br><strong>[修正建议]</strong> ...（指出具体的形近字或漏字）</p>
           </div>
           <div class="audit-item style">
               <span class="audit-label">Grammar / Wording</span>
               <p><strong>[语病类型]</strong> 搭配不当/句式杂糅 <br><strong>[问题描述]</strong> ...</p>
           </div>
           <!-- 请尽可能多列出几条 style 类型的语病问题 -->
       </div>
    </div>

    <!-- Part 2: ✍️ 修正后原文 (Corrected Text) -->
    <div class="revision-document">
        <h3 class="panel-title">✍️ 修正后原文 (Corrected Text) - OCR 已修复 & 语病已润色</h3>
        <div class="document-content">
            <!-- 
                输出页面的完整文本内容。
                数学公式必须转换为 LaTeX 格式，包裹在 $ 符号中。
                仅针对【事实性错误/OCR错误】使用 <del>旧内容</del><ins>新内容</ins> 标记。
                对于语病润色，直接输出通顺的文本即可，不要标记红绿，以免影响阅读。
            -->
            <h3>1.1 章节标题</h3>
            <p>这里是正文内容...</p>
        </div>
    </div>
</div>
`;

export const HTML_TEMPLATE_START = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MathEdit AI Professional Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;900&family=Poppins:wght@300;500;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
    MathJax = {
      tex: {inlineMath: [['$', '$'], ['\\(', '\\)']]},
      svg: {fontCache: 'global'}
    };
    </script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
    <style>
        :root {
            --ink: #0f172a;
            --paper: #ffffff;
            --accent: #2563eb;
            --highlight: #fef08a;
        }
        body { 
            font-family: 'Noto Serif SC', serif; 
            background-color: #f8fafc;
            color: var(--ink);
            -webkit-font-smoothing: antialiased;
            font-size: 15px; 
            line-height: 1.6; 
        }
        .font-poppins { font-family: 'Poppins', sans-serif; }
        
        h1, h2, h3, h4 { font-weight: 900; letter-spacing: -0.02em; margin-bottom: 0.4em; line-height: 1.2; }
        p { font-weight: 500; text-align: justify; margin-bottom: 0.8em; }
        
        /* Visual Anchor */
        .visual-anchor {
            font-family: 'Poppins', sans-serif;
            font-size: 6rem; 
            line-height: 0.8;
            font-weight: 900;
            color: transparent;
            -webkit-text-stroke: 1px #cbd5e1; 
            opacity: 0.3; 
            user-select: none;
            margin-bottom: 0.5rem;
        }

        /* Card Style */
        .page-review {
            background: var(--paper);
            border: 1px solid #e2e8f0;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            margin-bottom: 2rem; 
            padding: 0;
            break-inside: avoid;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .page-header {
            background: var(--ink);
            color: white;
            padding: 0.75rem 1.5rem; 
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-family: 'Poppins', sans-serif;
        }
        .page-title { margin: 0; font-size: 1rem; color: white !important; text-transform: uppercase; letter-spacing: 0.05em; }
        
        /* --- Audit Panel --- */
        .audit-panel {
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            padding: 1.5rem;
        }
        .panel-title {
            font-size: 0.85rem;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 1rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: 'Poppins', sans-serif;
        }
        .audit-items {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .audit-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            font-size: 0.9rem;
            background: white;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
        }
        .audit-label {
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: bold;
            white-space: nowrap;
            margin-top: 2px;
            text-transform: uppercase;
            font-family: 'Poppins', sans-serif;
        }
        .audit-item.logic .audit-label { background: #be123c; } 
        .audit-item.fact .audit-label { background: #854d0e; }
        .audit-item.style .audit-label { background: #0369a1; }
        .audit-item p { margin: 0; font-size: 0.95rem; color: #334155; line-height: 1.5; }

        /* --- Revision Document (Review Mode) --- */
        .revision-document {
            padding: 2rem 3rem;
            background: #fff;
            position: relative;
        }
        
        .document-content {
            font-size: 1.1rem;
            line-height: 2;
            color: #1e293b;
        }
        
        /* Track Changes Styles */
        ins {
            background-color: #dcfce7; /* Green highlight */
            color: #15803d;
            text-decoration: none;
            border-bottom: 2px solid #22c55e;
            padding: 0 2px;
            font-weight: 600;
        }
        
        del {
            background-color: #fee2e2; /* Red highlight */
            color: #b91c1c;
            text-decoration: line-through;
            padding: 0 2px;
            margin-right: 2px;
        }

        /* --- Clean Read / Word View Mode --- */
        .word-view-container {
            width: 100%;
            background: #fff;
            padding: 0;
        }
        
        /* Simulating an A4 page look but optimized for screen real estate */
        .word-page {
            width: 100%;
            max-width: 210mm; /* A4 width */
            margin: 0 auto;
            background: white;
            padding: 20px 24px; /* Compact padding */
            min-height: 200px;
            color: #000;
            font-family: 'Times New Roman', Times, serif; 
            font-size: 11pt;
            line-height: 1.5;
        }
        
        @media (min-width: 768px) {
            .word-page {
                padding: 40px 48px; /* Larger padding on desktop */
                font-size: 12pt;
            }
        }
        
        .word-page h1, .word-page h2, .word-page h3 {
            font-family: 'Arial', sans-serif;
            color: #2c3e50;
            margin-top: 1em;
            margin-bottom: 0.5em;
        }

        .word-page p {
            margin-bottom: 1em;
            text-align: justify;
        }

        .solution-block {
            background-color: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 0 4px 4px 0;
            font-family: sans-serif;
            font-size: 0.95rem;
        }

        /* Sidebar Nav */
        .nav-link {
            display: block;
            padding: 4px 0;
            border-bottom: 1px solid #f1f5f9;
            color: #64748b;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
            font-size: 0.75rem;
            transition: all 0.2s;
            text-decoration: none;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .nav-link:hover { color: var(--ink); padding-left: 4px; border-bottom: 1px solid var(--ink); }
        .nav-link.error { color: #ef4444; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    </style>
</head>
<body class="min-h-screen flex flex-col">

    <!-- I. HEADER -->
    <header class="w-full border-b-2 border-slate-900 bg-white py-4 px-6">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end">
            <div>
                <h1 class="text-3xl font-black text-slate-900 mb-0 tracking-tighter leading-none">
                    MathEdit<span class="text-blue-600">.</span>AI
                </h1>
                <p class="font-poppins text-[0.65rem] font-bold text-slate-400 tracking-[0.25em] uppercase mt-1">
                    Professional Manuscript Review System
                </p>
            </div>
            <div class="mt-2 md:mt-0 text-right font-poppins">
                <div class="text-[0.6rem] font-bold uppercase tracking-widest text-slate-400">Date</div>
                <div class="text-lg font-bold text-slate-900" id="current-date"></div>
            </div>
        </div>
    </header>

    <!-- II. MAIN BODY -->
    <main class="flex-grow w-full max-w-7xl mx-auto px-4 py-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            
            <aside class="hidden lg:block lg:col-span-3 relative">
                <div class="sticky top-6">
                    <div class="visual-anchor">A</div>
                    <div class="relative z-10 pl-1 mt-[-2rem]">
                        <h3 class="font-noto text-sm font-black mb-3 border-l-2 border-blue-600 pl-3 uppercase tracking-wider text-slate-900">
                            Index
                        </h3>
                        <nav class="max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-0.5">
                           <!--NAV_LINKS_PLACEHOLDER-->
                        </nav>
                    </div>
                </div>
            </aside>

            <div class="col-span-1 lg:col-span-9">`;

export const HTML_TEMPLATE_END = `
            </div>
        </div>
    </main>
    <footer class="text-center py-6 text-slate-400 font-poppins text-xs border-t border-slate-200 mt-auto">
        MathEdit AI System
    </footer>
</body>
</html>`;