# 机票识别 PWA — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个手机 PWA，用户上传两张机票截图，浏览器内 OCR 识别后展示可编辑确认界面，一键生成固定格式预订委托文字并复制。

**Architecture:** 纯静态前端（HTML + CSS + JS），Tesseract.js v5 在浏览器 WebAssembly 中运行中文 OCR，解析函数抽取到独立 parser.js 以便 Node.js 单元测试，部署到 Vercel 公网访问。

**Tech Stack:** HTML5, CSS3, Vanilla JS, Tesseract.js v5 (CDN), Node.js (单元测试), Vercel (部署)

---

## 文件规划

| 文件 | 职责 |
|------|------|
| `index.html` | 三屏 DOM 结构（上传 / 确认 / 结果） |
| `style.css` | 移动优先样式，卡片布局 |
| `parser.js` | 纯函数：从 OCR 文本提取日期 / 时间 / 机场 / 航班号，无 DOM 依赖 |
| `app.js` | 事件绑定、Tesseract.js 调用、屏幕切换、模板生成、剪贴板 |
| `parser.test.js` | parser.js 单元测试，用 Node.js 运行 |

---

### Task 1: 初始化项目并编写 parser 单元测试

**Files:**
- Create: `parser.test.js`

- [ ] **Step 1: 初始化 Git 仓库**

```bash
cd "D:/claude-code/识别机票"
git init
git add IMG_2649.PNG IMG_2651.PNG docs/
git commit -m "chore: initial commit with screenshots and design docs"
```

- [ ] **Step 2: 创建 parser.test.js**

```javascript
// parser.test.js
const assert = require('assert');
const {
  parseRoute,
  parseDate,
  parseTimeRange,
  parseAirports,
  parseFlight,
} = require('./parser.js');

// Sample text simulating Tesseract OCR output for the two screenshots
const outText = `广州→徐州
04-28 周二
15:05 → 17:25 白云T2-观音T2
南航CZ3339 空客319(中)`;

const retText = `徐州→广州
04-30 周四
16:15 → 19:00 观音T2-白云T2
长龙GJ8060 空客321(中)`;

// --- parseRoute ---
let r = parseRoute(outText);
assert.strictEqual(r.from, '广州', 'parseRoute: outbound from');
assert.strictEqual(r.to,   '徐州', 'parseRoute: outbound to');

r = parseRoute(retText);
assert.strictEqual(r.from, '徐州', 'parseRoute: return from');
assert.strictEqual(r.to,   '广州', 'parseRoute: return to');

// --- parseDate ---
assert.strictEqual(parseDate(outText), '4.28', 'parseDate: outbound');
assert.strictEqual(parseDate(retText), '4.30', 'parseDate: return');

// --- parseTimeRange ---
assert.strictEqual(parseTimeRange(outText), '15：05-17：25', 'parseTimeRange: outbound');
assert.strictEqual(parseTimeRange(retText), '16：15-19：00', 'parseTimeRange: return');

// --- parseAirports ---
let ap = parseAirports(outText, '广州', '徐州');
assert.strictEqual(ap.from, '广州白云 T2', 'parseAirports: outbound from');
assert.strictEqual(ap.to,   '徐州观音 T2', 'parseAirports: outbound to');

ap = parseAirports(retText, '徐州', '广州');
assert.strictEqual(ap.from, '徐州观音 T2', 'parseAirports: return from');
assert.strictEqual(ap.to,   '广州白云 T2', 'parseAirports: return to');

// --- parseFlight ---
assert.strictEqual(parseFlight(outText), '南航CZ3339', 'parseFlight: outbound');
assert.strictEqual(parseFlight(retText), '长龙GJ8060', 'parseFlight: return');

console.log('All tests passed!');
```

- [ ] **Step 3: 运行测试，确认失败**

```bash
node parser.test.js
```

Expected: `Error: Cannot find module './parser.js'`（证明测试能捕获缺失实现）

---

### Task 2: 实现 parser.js 通过所有测试

**Files:**
- Create: `parser.js`

- [ ] **Step 1: 创建 parser.js**

```javascript
// parser.js

// 从 OCR 文本首行提取城市对，如 "广州→徐州" → { from: '广州', to: '徐州' }
function parseRoute(text) {
  const match = text.match(/([\u4e00-\u9fff]{2,4})\s*→\s*([\u4e00-\u9fff]{2,4})/);
  if (!match) return null;
  return { from: match[1], to: match[2] };
}

// 提取日期，"04-28" 或 "04.28" → "4.28"
function parseDate(text) {
  const match = text.match(/(\d{1,2})[-./](\d{1,2})/);
  if (!match) return '';
  return `${parseInt(match[1])}.${parseInt(match[2])}`;
}

// 提取时间段，"15:05 → 17:25" → "15：05-17：25"（全角冒号，半角连字符）
function parseTimeRange(text) {
  const m = text.match(/(\d{2})[:：](\d{2})\s*[→\-–—]+\s*(\d{2})[:：](\d{2})/);
  if (!m) return '';
  return `${m[1]}：${m[2]}-${m[3]}：${m[4]}`;
}

// 提取航站楼列表（仅匹配中文字符紧跟 T+数字），结合城市名拼合完整机场
// 示例："白云T2-观音T2" + fromCity="广州" + toCity="徐州"
//      → { from: "广州白云 T2", to: "徐州观音 T2" }
function parseAirports(text, fromCity, toCity) {
  const hits = [...text.matchAll(/([\u4e00-\u9fff]{2,3})\s*(T\d)/g)].map(m => ({
    name: m[1],
    term: m[2],
  }));
  const from = hits[0] ? `${fromCity}${hits[0].name} ${hits[0].term}` : '';
  const to   = hits[1] ? `${toCity}${hits[1].name} ${hits[1].term}` : '';
  return { from, to };
}

// 提取航司+航班号，如 "南航CZ3339"、"长龙GJ8060"
function parseFlight(text) {
  const airlines = [
    '南航', '长龙', '国航', '东航', '厦航', '海航',
    '深航', '川航', '山东', '吉祥', '春秋', '西藏', '多彩',
  ];
  for (const airline of airlines) {
    const m = text.match(new RegExp(airline + '\\s*([A-Z]{2}\\d{3,5})'));
    if (m) return `${airline}${m[1]}`;
  }
  // 降级：只提取裸航班号
  const m = text.match(/([A-Z]{2}\d{3,5})/);
  return m ? m[1] : '';
}

// 聚合所有字段，供 app.js 调用
function parseFlightInfo(text) {
  const route = parseRoute(text) || { from: '', to: '' };
  const airports = parseAirports(text, route.from, route.to);
  return {
    date:   parseDate(text),
    from:   airports.from,
    to:     airports.to,
    time:   parseTimeRange(text),
    flight: parseFlight(text),
  };
}

if (typeof module !== 'undefined') {
  module.exports = { parseRoute, parseDate, parseTimeRange, parseAirports, parseFlight, parseFlightInfo };
}
```

- [ ] **Step 2: 运行测试，确认全部通过**

```bash
node parser.test.js
```

Expected: `All tests passed!`

- [ ] **Step 3: 提交**

```bash
git add parser.js parser.test.js
git commit -m "feat: add OCR text parser with unit tests"
```

---

### Task 3: 创建 index.html（三屏结构）

**Files:**
- Create: `index.html`

- [ ] **Step 1: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <title>机票识别</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <!-- ① 上传页 -->
  <div id="screen-upload" class="screen active">
    <h1>机票识别</h1>
    <p class="subtitle">上传往返机票截图，自动生成预订文字</p>

    <label class="upload-zone" id="zone-outbound" for="input-outbound">
      <span class="upload-icon">✈</span>
      <span class="upload-label" id="label-outbound">点击选择去程截图</span>
      <input type="file" accept="image/*" id="input-outbound" hidden>
    </label>

    <label class="upload-zone" id="zone-return" for="input-return">
      <span class="upload-icon">✈</span>
      <span class="upload-label" id="label-return">点击选择回程截图</span>
      <input type="file" accept="image/*" id="input-return" hidden>
    </label>

    <div id="progress-area" hidden>
      <p id="progress-text">正在识别...</p>
      <div class="progress-bar"><div id="progress-fill"></div></div>
    </div>

    <button id="btn-ocr" class="btn-primary" disabled>开始识别</button>
  </div>

  <!-- ② 确认页 -->
  <div id="screen-confirm" class="screen">
    <h2>确认去程</h2>
    <div class="field-group">
      <label for="out-date">日期</label>
      <input type="text" id="out-date" placeholder="如 4.28">
      <label for="out-from">出发机场</label>
      <input type="text" id="out-from" placeholder="如 广州白云 T2">
      <label for="out-to">到达机场</label>
      <input type="text" id="out-to" placeholder="如 徐州观音 T2">
      <label for="out-time">时间</label>
      <input type="text" id="out-time" placeholder="如 15：05-17：25">
      <label for="out-flight">航班号</label>
      <input type="text" id="out-flight" placeholder="如 南航CZ3339">
    </div>

    <h2>确认回程</h2>
    <div class="field-group">
      <label for="ret-date">日期</label>
      <input type="text" id="ret-date" placeholder="如 4.30">
      <label for="ret-from">出发机场</label>
      <input type="text" id="ret-from" placeholder="如 徐州观音 T2">
      <label for="ret-to">到达机场</label>
      <input type="text" id="ret-to" placeholder="如 广州白云 T2">
      <label for="ret-time">时间</label>
      <input type="text" id="ret-time" placeholder="如 16：15-19：00">
      <label for="ret-flight">航班号</label>
      <input type="text" id="ret-flight" placeholder="如 长龙GJ8060">
    </div>

    <button id="btn-generate" class="btn-primary">生成预订文字</button>
  </div>

  <!-- ③ 结果页 -->
  <div id="screen-result" class="screen">
    <h2>预订文字</h2>
    <div class="result-box">
      <pre id="result-text"></pre>
    </div>
    <button id="btn-copy" class="btn-primary">复制</button>
    <button id="btn-restart" class="btn-secondary">重新开始</button>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
  <script src="parser.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: 在浏览器打开验证 HTML 结构**

双击 `index.html` 在浏览器打开，或运行：
```bash
start "D:/claude-code/识别机票/index.html"
```

Expected: 显示「机票识别」标题、两个上传区域、灰色不可点击的「开始识别」按钮。没有 JS 报错（F12 控制台）。

- [ ] **Step 3: 提交**

```bash
git add index.html
git commit -m "feat: add three-screen HTML structure"
```

---

### Task 4: 创建 style.css（移动优先）

**Files:**
- Create: `style.css`

- [ ] **Step 1: 创建 style.css**

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
  background: #f2f2f7;
  color: #1c1c1e;
  min-height: 100vh;
}

/* Screens */
.screen {
  display: none;
  flex-direction: column;
  gap: 16px;
  padding: 28px 20px 40px;
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
}

.screen.active {
  display: flex;
}

/* Typography */
h1 {
  font-size: 28px;
  font-weight: 700;
  text-align: center;
  color: #1c1c1e;
  margin-top: 12px;
}

h2 {
  font-size: 17px;
  font-weight: 600;
  color: #1c1c1e;
  margin-top: 4px;
}

.subtitle {
  text-align: center;
  color: #8e8e93;
  font-size: 14px;
  margin-top: -8px;
}

/* Upload zones */
.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 2px dashed #c7c7cc;
  border-radius: 14px;
  padding: 32px 16px;
  background: #ffffff;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  min-height: 110px;
}

.upload-zone.selected {
  border-color: #007aff;
  background: #f0f7ff;
}

.upload-icon {
  font-size: 30px;
  line-height: 1;
}

.upload-label {
  font-size: 15px;
  color: #636366;
  text-align: center;
  word-break: break-all;
}

.upload-zone.selected .upload-label {
  color: #007aff;
}

/* Progress */
#progress-area {
  text-align: center;
}

#progress-text {
  font-size: 13px;
  color: #636366;
  margin-bottom: 8px;
}

.progress-bar {
  background: #e5e5ea;
  border-radius: 4px;
  height: 6px;
  overflow: hidden;
}

#progress-fill {
  height: 100%;
  background: #007aff;
  border-radius: 4px;
  width: 0%;
  transition: width 0.25s ease;
}

/* Field groups */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #ffffff;
  border-radius: 14px;
  padding: 16px;
}

.field-group label {
  font-size: 12px;
  color: #8e8e93;
  font-weight: 500;
  margin-top: 8px;
}

.field-group label:first-child {
  margin-top: 0;
}

.field-group input {
  border: 1px solid #e5e5ea;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 16px;
  color: #1c1c1e;
  background: #f9f9f9;
  outline: none;
  width: 100%;
  transition: border-color 0.15s;
}

.field-group input:focus {
  border-color: #007aff;
  background: #fff;
}

/* Result */
.result-box {
  background: #ffffff;
  border-radius: 14px;
  padding: 20px;
  flex: 1;
}

#result-text {
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;
  font-size: 15px;
  line-height: 1.9;
  white-space: pre-wrap;
  color: #1c1c1e;
}

/* Buttons */
.btn-primary {
  width: 100%;
  padding: 16px;
  background: #007aff;
  color: #ffffff;
  border: none;
  border-radius: 14px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  min-height: 54px;
  margin-top: 4px;
}

.btn-primary:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn-primary:active:not(:disabled) {
  opacity: 0.75;
}

.btn-secondary {
  width: 100%;
  padding: 14px;
  background: transparent;
  color: #007aff;
  border: 2px solid #007aff;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  min-height: 52px;
}

.btn-secondary:active {
  background: #e8f0fe;
}
```

- [ ] **Step 2: 刷新浏览器验证样式**

Expected: 白色卡片式上传区域（虚线边框），浅灰色背景，蓝色 disabled 按钮（半透明），整体接近原生 iOS 风格。

- [ ] **Step 3: 提交**

```bash
git add style.css
git commit -m "feat: add mobile-first iOS-style CSS"
```

---

### Task 5: 创建 app.js（完整应用逻辑）

**Files:**
- Create: `app.js`

- [ ] **Step 1: 创建 app.js**

```javascript
// app.js

// ── 屏幕切换 ─────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ── 文件上传 ─────────────────────────────────────────────
let outboundFile = null;
let returnFile   = null;

function checkBothSelected() {
  document.getElementById('btn-ocr').disabled = !(outboundFile && returnFile);
}

document.getElementById('input-outbound').addEventListener('change', function () {
  outboundFile = this.files[0];
  if (outboundFile) {
    document.getElementById('label-outbound').textContent = outboundFile.name;
    document.getElementById('zone-outbound').classList.add('selected');
  }
  checkBothSelected();
});

document.getElementById('input-return').addEventListener('change', function () {
  returnFile = this.files[0];
  if (returnFile) {
    document.getElementById('label-return').textContent = returnFile.name;
    document.getElementById('zone-return').classList.add('selected');
  }
  checkBothSelected();
});

// ── 进度条 ───────────────────────────────────────────────
function setProgress(pct, msg) {
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = msg;
}

// ── OCR ─────────────────────────────────────────────────
document.getElementById('btn-ocr').addEventListener('click', async function () {
  this.disabled = true;
  const progressArea = document.getElementById('progress-area');
  progressArea.hidden = false;
  setProgress(0, '加载语言包（首次约需 30 秒）...');

  try {
    let phase = 0; // 0 = outbound, 1 = return

    const worker = await Tesseract.createWorker('chi_sim', 1, {
      logger: function (m) {
        if (m.status === 'recognizing text') {
          const base = phase === 0 ? 15 : 55;
          setProgress(base + m.progress * 35, `识别第 ${phase + 1} 张图片 ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    setProgress(10, '识别去程截图...');
    phase = 0;
    const { data: { text: outText } } = await worker.recognize(outboundFile);

    setProgress(50, '识别回程截图...');
    phase = 1;
    const { data: { text: retText } } = await worker.recognize(returnFile);

    setProgress(95, '解析中...');
    await worker.terminate();

    // 填充确认页字段
    const outInfo = parseFlightInfo(outText);
    const retInfo = parseFlightInfo(retText);

    document.getElementById('out-date').value   = outInfo.date;
    document.getElementById('out-from').value   = outInfo.from;
    document.getElementById('out-to').value     = outInfo.to;
    document.getElementById('out-time').value   = outInfo.time;
    document.getElementById('out-flight').value = outInfo.flight;

    document.getElementById('ret-date').value   = retInfo.date;
    document.getElementById('ret-from').value   = retInfo.from;
    document.getElementById('ret-to').value     = retInfo.to;
    document.getElementById('ret-time').value   = retInfo.time;
    document.getElementById('ret-flight').value = retInfo.flight;

    setProgress(100, '识别完成！');
    setTimeout(function () { showScreen('screen-confirm'); }, 400);

  } catch (err) {
    progressArea.hidden = true;
    document.getElementById('btn-ocr').disabled = false;
    alert('识别失败，请重试。\n' + err.message);
  }
});

// ── 生成预订文字 ─────────────────────────────────────────
document.getElementById('btn-generate').addEventListener('click', function () {
  var o = {
    date:   document.getElementById('out-date').value.trim(),
    from:   document.getElementById('out-from').value.trim(),
    to:     document.getElementById('out-to').value.trim(),
    time:   document.getElementById('out-time').value.trim(),
    flight: document.getElementById('out-flight').value.trim(),
  };
  var r = {
    date:   document.getElementById('ret-date').value.trim(),
    from:   document.getElementById('ret-from').value.trim(),
    to:     document.getElementById('ret-to').value.trim(),
    time:   document.getElementById('ret-time').value.trim(),
    flight: document.getElementById('ret-flight').value.trim(),
  };

  var text = 'Dear Candy,\n请帮忙预定以下往返机票，谢谢~\n\n' +
    o.date + '\n' + o.from + '-' + o.to + '\n' + o.time + '\n' + o.flight +
    '\n\n' +
    r.date + '\n' + r.from + '-' + r.to + '\n' + r.time + '\n' + r.flight;

  document.getElementById('result-text').textContent = text;
  showScreen('screen-result');
});

// ── 复制到剪贴板 ─────────────────────────────────────────
document.getElementById('btn-copy').addEventListener('click', async function () {
  var text = document.getElementById('result-text').textContent;
  var btn = this;

  try {
    await navigator.clipboard.writeText(text);
  } catch (_) {
    // 降级方案：execCommand（iOS Safari 旧版）
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  btn.textContent = '已复制 ✓';
  setTimeout(function () { btn.textContent = '复制'; }, 2000);
});

// ── 重新开始 ─────────────────────────────────────────────
document.getElementById('btn-restart').addEventListener('click', function () {
  outboundFile = null;
  returnFile   = null;

  document.getElementById('input-outbound').value = '';
  document.getElementById('input-return').value   = '';
  document.getElementById('label-outbound').textContent = '点击选择去程截图';
  document.getElementById('label-return').textContent   = '点击选择回程截图';
  document.getElementById('zone-outbound').classList.remove('selected');
  document.getElementById('zone-return').classList.remove('selected');
  document.getElementById('progress-area').hidden = true;
  document.getElementById('progress-fill').style.width = '0%';

  var btn = document.getElementById('btn-ocr');
  btn.disabled = true;

  showScreen('screen-upload');
});
```

- [ ] **Step 2: 手动测试上传流程**

在浏览器打开 index.html（需通过本地服务器才能加载 Tesseract CDN；运行下方命令后访问 http://localhost:8080）：

```bash
# 任选一种：
npx serve "D:/claude-code/识别机票"
# 或
python -m http.server 8080 --directory "D:/claude-code/识别机票"
```

测试步骤：
1. 点击「去程截图」区域 → 选择 `IMG_2651.PNG` → 确认区域变蓝、显示文件名
2. 点击「回程截图」区域 → 选择 `IMG_2649.PNG` → 确认区域变蓝
3. 确认「开始识别」按钮变为实心蓝色（可点击）

- [ ] **Step 3: 测试 OCR 全流程**

点击「开始识别」（首次运行会下载 chi_sim 语言包，约 20-40MB，需等待）：

Expected 进度：
- 0% → "加载语言包"
- ~15-50% → "识别第 1 张图片"
- ~55-90% → "识别第 2 张图片"
- 100% → "识别完成！"→ 自动跳转确认页

Expected 确认页字段（部分字段可能为空，OCR 有误差时手动纠正即可）：
```
去程日期：4.28
去程出发：广州白云 T2
去程到达：徐州观音 T2
去程时间：15：05-17：25
去程航班：南航CZ3339

回程日期：4.30
回程出发：徐州观音 T2
回程到达：广州白云 T2
回程时间：16：15-19：00
回程航班：长龙GJ8060
```

- [ ] **Step 4: 测试生成与复制**

确认字段无误后点击「生成预订文字」。

Expected 结果页文字（完整内容）：
```
Dear Candy,
请帮忙预定以下往返机票，谢谢~

4.28
广州白云 T2-徐州观音 T2
15：05-17：25
南航CZ3339

4.30
徐州观音 T2-广州白云 T2
16：15-19：00
长龙GJ8060
```

点击「复制」→ 粘贴到备忘录 → 确认内容完整一致。

点击「重新开始」→ 确认回到上传页、文件选择已清空、按钮恢复 disabled。

- [ ] **Step 5: 提交**

```bash
git add app.js
git commit -m "feat: add OCR orchestration, field population, generate and copy"
```

---

### Task 6: 部署到 Vercel

**Files:** 无新文件

- [ ] **Step 1: 推送到 GitHub**

在 GitHub.com 创建新仓库（名称如 `flight-ticket-ocr`，Public 或 Private 均可），然后：

```bash
git remote add origin https://github.com/YOUR_USERNAME/flight-ticket-ocr.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Vercel 一键部署**

1. 打开 https://vercel.com，用 GitHub 账号登录
2. 点击「Add New Project」→ 选择 `flight-ticket-ocr` 仓库
3. Framework Preset 选「**Other**」（不要选 Vite/Next.js）
4. Root Directory 保持默认（根目录）
5. 点击「**Deploy**」

等待约 30 秒，Vercel 分配公网 URL（如 `https://flight-ticket-ocr.vercel.app`）。

- [ ] **Step 3: 手机验证**

手机浏览器打开 Vercel URL：
- iOS Safari: 底部分享按钮 → 「添加到主屏幕」
- Android Chrome: 右上角菜单 → 「添加到主屏幕」

从主屏幕图标打开，完整走一遍上传 → OCR → 确认 → 生成 → 复制流程。

---

## 自检

- [x] **parseRoute** — 从截图标题提取城市，测试覆盖去程+回程两个方向
- [x] **parseDate** — 格式化为 M.D
- [x] **parseTimeRange** — 全角冒号+半角连字符
- [x] **parseAirports** — 中文字符正则避免误匹配数字和标点
- [x] **parseFlight** — 枚举主流航司，降级裸航班号
- [x] **OCR 失败处理** — alert + 恢复按钮
- [x] **剪贴板降级** — execCommand 兼容 iOS Safari 旧版
- [x] **重新开始** — 清空所有状态含进度条
- [x] **Vercel 部署** — 静态站点，无后端依赖
