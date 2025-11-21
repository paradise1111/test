

export const SYSTEM_INSTRUCTION = `
**Role:** 你是中国资深的数学教育出版编辑，精通《义务教育数学课程标准（2022年版）》、GB 3102.11 数学符号标准及 GeoGebra 软件操作。

**Task:** 逐页审阅用户上传的 PDF 数学稿件（主要是小初阶段及 GeoGebra 专著）。

**Tools:** 使用 Google Search 查询最新的数学术语定义、出版规范或 GeoGebra 指令拼写。

**CRITICAL EXECUTION RULES (必须严格执行):**

1.  **顺序绝对严格 (STRICT LINEAR ORDER):**
    - **审阅顺序必须完全依照原文的阅读顺序（从上到下，从左到右）。**
    - “审稿修订表”中的每一行必须对应文中出现的先后顺序。
    - 严禁跳跃审阅！严禁先改后面的再改前面的！

2.  **语言绝对专业 (PROFESSIONAL TONE & CONSISTENCY):**
    - **严禁口语化！** 绝对不能出现“这句话读着别扭”、“感觉不对”、“建议改一下”等随意表达。
    - **必须使用出版专业术语：** 如“表述冗余”、“逻辑跳跃”、“指代不明”、“术语不规范”、“符号使用错误”、“存在歧义”、“排版不统一”等。
    - **术语必须前后统一：** 一旦你在前文将某个术语（如“图象”）纠正为标准写法（如“图像”），后文必须保持一致，严禁出现同一概念多种写法。
    - **拒绝机械重复：** 针对同类型的错误，应结合具体语境微调措辞，避免所有建议都复制粘贴完全一样的话术。

3.  **结构与目录对应 (STRUCTURE & TOC ALIGNMENT):**
    - **标题层级校验：** 严格检查文中标题的序号（如 1., 1.1, 1.1.1）是否逻辑连贯。如果发现序号跳跃（如从 1.2 直接跳到 1.4），必须标记为“序号错误”。
    - **样式统一：** 检查各级标题的字体、字号、对齐方式是否在视觉上保持一致。
    - **目录对应：** 如果当前页面包含目录中列出的章节，确保正文标题与目录标题完全一致（一字不差）。

4.  **高亮修改痕迹 (HIGHLIGHT ALL CHANGES):**
    - 在“优化后定稿”部分，你需要重写整页内容。
    - **关键点：** 凡是你修改过的地方（包括纠正错别字、修改标点、调整语序、规范公式），**必须**使用 \`<span class="highlight">...</span>\` 标签包裹修改后的内容。
    - 未修改的内容保持原样。

5.  **数学验算 (VERIFICATION):**
    - 必须对文中出现的所有数学题目进行后台验算。
    - 发现计算错误必须在修订表中标记为【重大计算错误】。
    - 检查几何图形的字母标注是否与题目已知条件矛盾。

**Output Format (STRICT HTML ONLY):**
输出一段 **HTML 代码片段**（不要包含 <html>, <head> 标签，只输出 body 内的 div 结构）。

<div class="page-review" id="page-{当前页码}">
    <div class="page-header">
        <h2 class="page-title">第 {当前页码} 页审阅</h2>
    </div>
    
    <!-- 第一部分：修订建议表 -->
    <div class="review-section">
        <h3 class="section-title">🛑 审稿修订表</h3>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 30%;">原文问题 (严格按阅读顺序)</th>
                        <th style="width: 70%;">专业修订建议</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- 循环插入每一条修改意见，必须严格按文中出现顺序 -->
                    <tr>
                        <td class="original-cell">
                            <div class="original-text">
                                <!-- 摘录原文 -->
                                ...原文片段...
                            </div>
                        </td>
                        <td class="suggestion-cell">
                            <div class="suggestion-item">
                                <span class="tag tag-style">表述不当</span>
                                <span>此处“...”表述口语化，建议修改为“...”，以符合出版规范。</span>
                            </div>
                            <div class="suggestion-item">
                                <span class="tag tag-calc">⛔ 重大计算错误</span>
                                <span>经验算，步骤2中 $2x=10$ 应解得 $x=5$，原文误写为 $x=2$。</span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- 第二部分：最终优化文本 -->
    <div class="final-section">
        <h3 class="section-title">✨ 优化后定稿 (变动已高亮)</h3>
        <div class="content-box">
            <!-- 
                 1. 输出完整的页面文字内容，保持原有段落结构 <p>...</p>。
                 2. 【重要】所有经过修改的地方，**必须**使用 <span class="highlight">...</span> 标签包裹。
                 3. 所有数学公式必须用 LaTeX 格式。
                 4. 保持标题层级样式一致，例如 <h3>1.1 ...</h3>
            -->
            <h3>1.1 章节标题</h3>
            <p>...未修改文本...<span class="highlight">修改后的文本</span>...未修改文本...</p>
        </div>
    </div>
</div>
`;

export const HTML_TEMPLATE_START = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>MathEdit AI 智能审稿报告</title>
    <script>
    MathJax = {
      tex: {inlineMath: [['$', '$'], ['\\\\(', '\\\\)']]},
      svg: {fontCache: 'global'}
    };
    </script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
    <style>
        :root { 
            --primary-color: #2563eb; 
            --primary-dark: #1e40af;
            --bg-color: #f1f5f9; 
            --card-bg: #ffffff;
            --text-main: #1e293b;
            --text-secondary: #64748b;
            --border-color: #e2e8f0;
            --highlight-bg: #fef9c3;
            --highlight-text: #854d0e;
            --error-bg: #fef2f2;
            --error-text: #991b1b;
        }
        
        body { 
            font-family: "Songti SC", "SimSun", "STSong", "Times New Roman", serif; /* 使用衬线字体增强出版感 */
            line-height: 1.8; 
            color: var(--text-main); 
            max-width: 1000px; 
            margin: 0 auto; 
            padding: 40px 20px; 
            background: var(--bg-color); 
            overflow-x: hidden;
        }
        
        h1 { text-align: center; color: var(--primary-dark); margin-bottom: 40px; font-weight: 800; font-size: 1.8rem; font-family: -apple-system, sans-serif; }

        /* 卡片容器 */
        .page-review { 
            background: var(--card-bg); 
            border-radius: 16px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.05); 
            margin-bottom: 30px; 
            padding: 24px; 
            border: 1px solid var(--border-color);
        }
        
        /* 错误状态卡片 */
        .page-review.error-card {
            border-left: 6px solid #ef4444;
            background: #fff5f5;
        }

        /* 标题区 */
        .page-header {
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 12px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            font-family: -apple-system, sans-serif;
        }
        .page-title { 
            color: var(--primary-dark); 
            margin: 0;
            font-size: 1.3rem;
            font-weight: 700;
        }
        .error-card .page-title { color: #991b1b; }

        .section-title {
            font-size: 1rem;
            color: var(--text-secondary);
            margin-bottom: 12px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: -apple-system, sans-serif;
        }

        /* 1. 美化表格 - 移动端适配 */
        .table-container {
            overflow-x: auto;
            border-radius: 8px;
            border: 1px solid var(--border-color);
            margin-bottom: 24px;
            -webkit-overflow-scrolling: touch;
        }
        table { width: 100%; min-width: 500px; border-collapse: collapse; font-size: 0.95rem; }
        
        th { 
            background-color: #f8fafc; 
            padding: 10px 12px;
            border-bottom: 1px solid var(--border-color);
            text-align: left;
            font-family: -apple-system, sans-serif;
        }
        
        td { 
            padding: 12px; 
            vertical-align: top; 
            border-bottom: 1px solid var(--border-color);
        }
        
        /* 原文列样式 */
        .original-text { 
            background-color: #fff1f2; /* 更柔和的红色背景 */
            color: #be123c; 
            padding: 6px 10px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 0.9em;
            border-left: 3px solid #f43f5e;
            word-break: break-all;
        }

        /* 建议列样式 */
        .suggestion-item {
            margin-bottom: 10px;
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .tag {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 700;
            width: fit-content;
            font-family: -apple-system, sans-serif;
        }
        .tag-error { background-color: #fee2e2; color: #991b1b; }
        .tag-style { background-color: #e0f2fe; color: #075985; }
        .tag-calc { background-color: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

        /* 2. 美化定稿区 */
        .final-section {
            background-color: #f8fafc; 
            padding: 16px;
            border-radius: 12px;
            border: 1px dashed var(--border-color);
        }
        
        .content-box { 
            background: white; 
            padding: 24px; 
            border-radius: 8px; 
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            border: 1px solid var(--border-color);
            font-family: "Times New Roman", "Songti SC", serif; /* 正文使用衬线体 */
            font-size: 1.1rem;
            line-height: 1.8;
            text-align: justify;
        }
        
        .content-box p { margin-bottom: 1em; }
        .content-box h1, .content-box h2, .content-box h3 { font-family: -apple-system, sans-serif; color: #1e293b; margin-top: 1.5em; margin-bottom: 0.5em; }

        /* 高亮样式优化 */
        .highlight { 
            background-color: rgba(253, 224, 71, 0.3); /* 柔和的黄色 */
            color: #000;
            padding: 0 2px;
            border-bottom: 2px solid #eab308; /* 底部实线强调 */
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
        }

        /* 桌面端导航栏 (Desktop) */
        .nav-bar { 
            position: fixed; 
            top: 40px; 
            right: 40px; 
            width: 180px; 
            background: white; 
            padding: 16px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
            border-radius: 12px; 
            z-index: 100; 
            max-height: 80vh;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            font-family: -apple-system, sans-serif;
        }

        /* 移动端适配 (Mobile) */
        @media (max-width: 768px) {
            body { padding: 20px 12px 80px 12px; }
            h1 { font-size: 1.5rem; margin-bottom: 24px; }
            .page-review { padding: 16px; }
            .page-header { flex-direction: column; align-items: flex-start; gap: 8px; }
            
            .nav-bar {
                position: fixed;
                top: auto;
                bottom: 0;
                left: 0;
                right: 0;
                width: 100%;
                height: auto;
                max-height: 40vh;
                border-radius: 16px 16px 0 0;
                box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
                transform: translateY(calc(100% - 48px));
                transition: transform 0.3s ease-out;
                padding: 0;
                border: none;
                border-top: 1px solid var(--border-color);
            }
            
            .nav-bar:hover, .nav-bar:focus-within, .nav-bar.active {
                transform: translateY(0);
            }
            
            .nav-bar strong {
                display: block;
                background: #fff;
                padding: 12px;
                text-align: center;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                color: var(--primary-color);
                font-size: 0.9rem;
            }
            .nav-bar strong::after {
                content: " (👆 点击展开导航)";
                font-size: 0.8em;
                opacity: 0.6;
            }
            
            .nav-links-container {
                padding: 12px;
                overflow-y: auto;
                max-height: calc(40vh - 48px);
                background: #fff;
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
            }
            
            .nav-bar a {
                display: block;
                text-align: center;
                background: #f1f5f9;
                border-radius: 4px;
                margin: 0;
                padding: 8px 4px;
                font-size: 0.8rem;
            }
        }

        @media print {
            .nav-bar { display: none; }
            body { background: white; padding: 0; }
            .page-review { box-shadow: none; border: none; margin-bottom: 50px; break-inside: avoid; }
        }
    </style>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const navBar = document.querySelector('.nav-bar');
            if(navBar && window.innerWidth <= 768) {
                navBar.querySelector('strong').addEventListener('click', function() {
                    navBar.classList.toggle('active');
                });
                navBar.querySelectorAll('a').forEach(a => {
                    a.addEventListener('click', () => navBar.classList.remove('active'));
                });
            }
        });
    </script>
</head>
<body>
    <h1>MathEdit AI 审稿报告</h1>
    <div class="nav-bar">
        <strong>📖 快速导航</strong>
        <div class="nav-links-container">
`;

export const HTML_TEMPLATE_END = `
</body>
</html>`;