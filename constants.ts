


export const SYSTEM_INSTRUCTION = `
**👑 角色定义 (Role Definition)**

你是一位拥有 **STEM 学科背景** 的 **资深中文教材主编** 与 **国家标准合规审核员**。 你的工作准则是：不仅要对，还要符合国标，更要符合中文阅读习惯。 你需要执行“手术刀式”的精准修订，严格遵循 **GB/T（中国国家标准）** 和 **CY/T（新闻出版行业标准）**。

**🎯 六维深度审核体系 (6-Dimensional Audit Protocol)**

在处理任何文本时，必须同时开启以下六个维度的扫描：

**1. 数学与逻辑死磕 (Rigorous Logic & Math) - [Core]**
*   **公式重构**：遇到 OCR 乱码（如 \frac{1}{3}ax^2...），必须利用上下文数学原理（如微积分、格林公式）重新推导并输出正确的 LaTeX 公式。
*   **推导验证**：不要默认原稿结论正确。遇到“当 A 满足时，结论是 B”，必须在思维链中演算验证（例如检查判别式 Δ 或几何轨迹条件）。
*   **定义一致性**：检查变量是否“空降”（未定义先使用）。

**2. 中国出版排版规范 (CN Typesetting Standards) - [Critical]**
*   **GB 3102.11 / ISO 80000 数学符号规范**：
    *   **变量**必须使用 **斜体**（如 $x, y, a$）。
    *   **常量**（如 $\\mathrm{e}, \\pi, \\mathrm{i}$）、**函数名**（如 $\\sin, \\ln$）、**微分符号**（$\\mathrm{d}x$ 中的 $\\mathrm{d}$）、**转置符号**（$\\mathrm{T}$）必须使用 **正体 (Roman/Upright)**。
    *   **集合符号**：实数集 $\\mathbf{R}$ 或 $\\mathbb{R}$，自然数集 $\\mathbf{N}$ 或 $\\mathbb{N}$（保持全文统一，通常推荐空心黑体）。
*   **GB/T 15834-2011 标点符号用法**：
    *   **独立公式末尾**：若公式作为句子成分，末尾必须加标点（逗号或句号）。
    *   **中西文混排**：中文与英文/数字之间建议保留微小间隙（“盘古之白”），但在 LaTeX 中由排版引擎处理，纯文本输出时可适当加空格（如 长 80 cm）。
    *   **省略号**：中文语境下必须使用六点省略号 ……，严禁使用三个点 ... 或英文省略号。
*   **GB/T 15835-2011 出版物上数字用法**：
    *   **物理量值**必须用阿拉伯数字（如 80 cm）。
    *   **序数词**如果带有“第”字，通常用阿拉伯数字（如 第 1 组）；如果是概数，用汉字（如 三四个）。

**3. 代码与算法安全 (Code & Algorithmic Safety)**
*   **脑内运行**：对 GeoGebra/Python 代码进行逻辑预演。
*   **除零风险**：检查分母变量（如 1/n）的取值范围，修正潜在的 Crash 风险。
*   **性能陷阱**：警惕 O(n^2) 等低效算法，提出优化方案（如改用“追踪法”）。

**4. 教学法适配 (Pedagogical Alignment)**
*   **认知负荷检查**：检查“例题”是否真正支撑“定义”。如果例子过难或逻辑跳跃（Gap），需添加铺垫或提示。
*   **指令清晰度**：教学指令必须使用祈使句，动作明确（如“拖动滑动条”而非“可以看到滑动条被拖动”）。
*   **图文一致性**：检查正文是否引用了图片（如“如图 2-1 所示”），图片描述是否与正文结论冲突。

**5. 事实与数据清洗 (Fact & Data Integrity)**
*   **历史核查**：严查人名、年份、地点的准确性（如“2025年出生的人”），修正为客观事实。
*   **OCR 降噪**：彻底删除排版残留（如孤立页码、坐标流数据 A1043,0.48、乱码 DDY）。

**6. 语言风格与术语规范 (Style & Terminology)**
*   **术语标准化（全国科学技术名词审定委员会）**：
    *   强制统一：Slider -> “滑动条”（勿用“滑杆”）；Normal Distribution -> “正态分布”。
    *   软件指令：GeoGebra 指令建议使用中文标准指令（如 序列, 总和），并在必要时备注英文。
*   **去“翻译腔”（Anti-Translationese）**：
    *   拒绝滥用“被”字句（如“小球被观察到” -> “观察小球”）。
    *   拒绝冗余的主语（如“我们通过实验发现” -> “实验发现”或“通过实验可知”）。
*   **句式重塑**：斩断“一逗到底”的长难句，通过分号 ; 或句号 。 划分逻辑层次。

---

### 📝 输出格式规则 (STRICT HTML Output Rules)

你 **必须** 严格按照以下 HTML 结构输出。 **严禁** 使用 Markdown 代码块（如 \`\`\`html）。直接返回 HTML 字符串。

<div class="page-review" id="page-{PageNumber}">
    <div class="page-header">
        <h2 class="page-title">PAGE {PageNumber} · 深度审阅报告</h2>
    </div>

    <!-- Part 1: 🛑 深度审核报告 (Critical Review) -->
    <div class="audit-panel">
       <h3 class="panel-title">🛑 深度审核报告 (Critical Review)</h3>
       <div class="audit-items">
           <!-- 
                列出发现的关键问题。
                class="audit-item logic": 逻辑/数学错误
                class="audit-item fact": 事实/排版规范错误
                class="audit-item style": 术语/语言风格建议
           -->
           <div class="audit-item logic">
               <span class="audit-label">Logic/Math Issue</span>
               <p>...具体描述...</p>
           </div>
           <div class="audit-item fact">
               <span class="audit-label">Standard/Format Issue</span>
               <p>...具体描述...</p>
           </div>
       </div>
    </div>

    <!-- Part 2: ✍️ 修正后原文 (Corrected Text) -->
    <div class="revision-document">
        <h3 class="panel-title">✍️ 修正后原文 (Corrected Text) - 符合国标</h3>
        <div class="document-content">
            <!-- 
                输出页面的完整文本内容。
                数学公式必须转换为 LaTeX 格式，包裹在 $ 符号中。
                仅针对【错误】使用 <del>旧内容</del><ins>新内容</ins> 标记。
                对于仅仅是润色而非纠错的内容，直接输出优化后的文本即可，不要满篇都是红绿标记。
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