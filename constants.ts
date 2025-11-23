

export const SYSTEM_INSTRUCTION = `
**Role:** 你是中国顶级资深数学教育出版编辑，精通《义务教育数学课程标准（2022年版）》、GB 3102.11 标准。
**Driven By:** Gemini 3 Pro (High Reasoning Mode)

**Task:** 逐页审阅数学稿件。

**CRITICAL RULES (TOP PRIORITY - 必须强制执行):**

1.  **🛡️ 政治敏感性与合规审查 (POLITICAL SENSITIVITY - HIGHEST PRIORITY):**
    - **地图边界:** 如果文中出现中国地图，必须严格检查藏南、阿克赛钦、台湾岛、南海诸岛（九段线）是否完整。如有任何模糊或错误，必须标记为【重大政治错误】。
    - **主权表述:** 严禁将“台湾”、“香港”、“澳门”与“国家”并列。必须检查是否使用了“我国”、“国内”等指代不明且可能引发歧义的词汇。
    - **涉政用语:** 检查题目背景是否涉及不当的政治隐喻或过时的政治口号。
    - **执行动作:** 遇到任何不确定的地名或政治表述，**必须使用 Google Search 工具**联网核实其官方定义和标准表述。

2.  **📝 内容查重与逻辑一致性 (DUPLICATION & LOGIC):**
    - **题目查重:** 检查当前页面出现的题目是否与前文（或同一页内）重复。如果题目仅仅是改了数字但逻辑完全一样且无教学必要，标记为【疑似重复题目】。
    - **前后矛盾:** 检查“已知条件”与“求解目标”是否存在逻辑闭环。例如，几何题的文字描述是否与图形标注（如字母位置）冲突。

3.  **📐 数学与出版规范:**
    - **术语:** 严禁口语化。必须使用标准术语（如将“图象”统一为“图像”，将“粘”改为“黏”等）。
    - **符号:** 检查斜体（变量）、正体（单位、特殊函数）是否符合 GB 3102.11。
    - **验算:** 对所有计算题进行后台验算，标记计算错误。

4.  **⛔ 审阅顺序:** 严格从上到下，从左到右。

**Output Format (STRICT HTML):**
输出 body 内的 div 结构。

<div class="page-review" id="page-{当前页码}">
    <div class="page-header">
        <h2 class="page-title">第 {当前页码} 页</h2>
    </div>
    
    <!-- ⚠️ 政治与敏感性专区 (仅当发现问题时显示) -->
    <!-- 如果发现政治/地图/主权问题，必须放在最前面，用醒目的红色样式 -->
    <div class="safety-check-section" style="display: {如果有问题 ? 'block' : 'none'}; border: 2px solid #dc2626; background: #fef2f2; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #991b1b; margin: 0 0 10px 0;">🛑 政治与合规性警报</h3>
        <p style="color: #7f1d1d;">检测到潜在的政治表述或地图错误：...</p>
    </div>

    <!-- 修订表 -->
    <div class="review-section">
        <h3 class="section-title">审稿修订表</h3>
        <div class="table-container">
            <table>
                <thead><tr><th>原文问题</th><th>修订建议</th></tr></thead>
                <tbody>
                    <tr>
                        <td class="original-cell"><div class="original-text">...</div></td>
                        <td class="suggestion-cell">
                            <div class="suggestion-item">
                                <span class="tag tag-calc">⛔ 计算错误</span>
                                <span>...</span>
                            </div>
                             <div class="suggestion-item">
                                <span class="tag tag-dup">🔁 题目重复</span>
                                <span>本题与第X题逻辑高度雷同...</span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- 定稿 -->
    <div class="final-section">
        <h3 class="section-title">优化后定稿</h3>
        <div class="content-box">
            <p>...<span class="highlight">修改内容</span>...</p>
        </div>
    </div>
</div>
`;

export const HTML_TEMPLATE_START = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MathEdit AI Pro 报告</title>
    <script>
    MathJax = {
      tex: {inlineMath: [['$', '$'], ['\\\\(', '\\\\)']]},
      svg: {fontCache: 'global'}
    };
    </script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
    <style>
        :root { 
            --app-bg: #F5F5F7;
            --card-bg: #ffffff;
            --text-primary: #1d1d1f;
            --text-secondary: #86868b;
            --accent-blue: #0071e3;
            --border-light: #d2d2d7;
        }
        
        body { 
            font-family: -apple-system, "Songti SC", serif;
            line-height: 1.6; 
            color: var(--text-primary); 
            max-width: 960px; 
            margin: 0 auto; 
            padding: 40px 20px; 
            background: var(--app-bg); 
            -webkit-font-smoothing: antialiased;
        }
        
        .page-review { 
            background: var(--card-bg); 
            border-radius: 20px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.03); 
            margin-bottom: 40px; 
            padding: 40px; 
            border: 1px solid rgba(0,0,0,0.05);
        }
        
        .page-review.error-card { border-left: 6px solid #ff3b30; }

        .page-title { 
            font-size: 24px; 
            font-weight: 700; 
            letter-spacing: -0.02em;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-light);
        }

        table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; margin: 20px 0; }
        th { text-align: left; padding: 12px; color: var(--text-secondary); font-weight: 600; border-bottom: 1px solid var(--border-light); }
        td { padding: 16px 12px; vertical-align: top; border-bottom: 1px solid #f2f2f2; }
        
        .original-text { background: #fff2f2; color: #d70015; padding: 8px; border-radius: 8px; font-family: monospace; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; margin-right: 6px; text-transform: uppercase; }
        .tag-error { background: #ff3b30; color: white; }
        .tag-calc { background: #ff9500; color: white; }
        .tag-dup { background: #af52de; color: white; } /* Purple for duplication */
        .tag-style { background: #0071e3; color: white; }

        .content-box { 
            font-family: "Songti SC", "Times New Roman", serif; 
            font-size: 17px; 
            line-height: 1.8;
            color: #1d1d1f;
            background: #fafafa;
            padding: 30px;
            border-radius: 12px;
        }

        .highlight { background-color: rgba(255, 214, 10, 0.4); border-bottom: 2px solid #ffd60a; padding: 0 2px; }
        
        a { color: var(--accent-blue); text-decoration: none; }
        a:hover { text-decoration: underline; }
        
        .safety-check-section {
            border: 2px solid #dc2626; 
            background: #fef2f2; 
            padding: 15px; 
            border-radius: 8px; 
            margin-bottom: 20px;
        }
    </style>
</head>
<body>
    <div style="text-align: center; margin-bottom: 60px;">
        <h1 style="font-weight: 800; font-size: 32px; letter-spacing: -0.03em;">MathEdit AI 审阅报告</h1>
        <p style="color: #86868b;">Powered by Gemini 3 Pro</p>
    </div>
`;

export const HTML_TEMPLATE_END = `</body></html>`;