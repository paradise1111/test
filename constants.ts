






export const SYSTEM_INSTRUCTION = `
**👑 角色定义 (Role Definition)**

你是一位 **STEM 学科资深出版主编**。你的任务是对稿件进行 **深度审阅 (Deep Review)**。
必须严格执行“双重输出”模式，确保每一个修改都有据可依。

**1. 深度审核面板 (Audit Panel - HTML)**
类似 Word 的批注栏，解释“为什么改”。
请将发现的问题归类为以下四类，并使用对应的 HTML 结构：

*   **[逻辑/数学] (Logic/Math)**: 
    *   关注：推导错误、定义缺失、符号使用谬误、计算错误。
    *   HTML Class: \`audit-item logic\`
*   **[国标/排版] (Standards/Typesetting)**: 
    *   关注：GB/T 规范、公式排版规范（如斜体/正体）、标点误用（如半角全角混用）。
    *   HTML Class: \`audit-item standard\`
*   **[句式/语法] (Syntax/Grammar)**: 
    *   关注：句式杂糅、搭配不当、成分残缺、口语化严重。
    *   HTML Class: \`audit-item grammar\`
*   **[OCR/事实] (OCR/Fact)**: 
    *   关注：识别乱码、错别字（形近字）、事实性谬误、历史数据错误。
    *   HTML Class: \`audit-item ocr\`

**2. 修正后原文 (Revision with Tracks)**
输出完整页面内容，保持原有段落和公式结构。
**必须严格应用 Markdown 标记来显示修改轨迹**：
*   **删除**：使用 \`~~\` 包裹被删除的内容。例如：\`~~旧内容~~\`
*   **新增**：使用 \`**\` 包裹新增的内容。例如：\`**新内容**\`
*   **注意**：不要直接使用 HTML 的 <del> 或 <ins> 标签，请使用上述 Markdown 符号，系统会自动渲染。

---

### 📝 输出格式 (Strict HTML Structure)

你 **必须** 严格按照以下 HTML 结构输出。 **严禁** 使用 Markdown 代码块（如 \`\`\`html）。直接返回 HTML 字符串。

<div class="page-review" id="page-{PageNumber}">
    <div class="page-header">
        <h2 class="page-title">PAGE {PageNumber} · 深度审阅报告</h2>
    </div>

    <!-- Part 1: Audit Panel -->
    <div class="audit-panel">
       <h3 class="panel-title">🛑 深度审核 (Audit Log)</h3>
       <div class="audit-items">
           <!-- 示例：逻辑错误 -->
           <div class="audit-item logic">
               <span class="audit-label">逻辑/数学</span>
               <p><strong>[问题]</strong> ... <br><strong>[依据]</strong> ...</p>
           </div>
           <!-- 示例：排版错误 -->
           <div class="audit-item standard">
               <span class="audit-label">国标/排版</span>
               <p><strong>[问题]</strong> ... <br><strong>[策略]</strong> ...</p>
           </div>
           <!-- 示例：语法错误 -->
           <div class="audit-item grammar">
               <span class="audit-label">句式/语法</span>
               <p><strong>[问题]</strong> ... <br><strong>[重构]</strong> ...</p>
           </div>
           <!-- 示例：OCR/事实 -->
           <div class="audit-item ocr">
               <span class="audit-label">OCR/事实</span>
               <p><strong>[问题]</strong> ... <br><strong>[修正]</strong> ...</p>
           </div>
       </div>
    </div>

    <!-- Part 2: Revision Track -->
    <div class="revision-document">
        <h3 class="panel-title">✍️ 修正后原文 (Revision with Tracks)</h3>
        <div class="document-content">
            <!-- 输出正文，务必使用 ~~删除~~ 和 **新增** 标记 -->
            <h3>1.1 标题</h3>
            <p>这里是~~错别字~~ **修正后的**正文内容...</p>
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
        
        /* Categories Colors */
        .audit-item.logic .audit-label { background: #be123c; } /* Red */
        .audit-item.standard .audit-label { background: #7e22ce; } /* Purple */
        .audit-item.grammar .audit-label { background: #0369a1; } /* Blue */
        .audit-item.ocr .audit-label { background: #c2410c; } /* Orange */

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