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

// ── OCR 工具函数 ─────────────────────────────────────────
function compressImage(file) {
  return new Promise(function (resolve) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      URL.revokeObjectURL(url);
      var maxSide = 1600;
      var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      var canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', 0.88);
    };
    img.src = url;
  });
}

async function recognizeText(file) {
  var blob = await compressImage(file);
  var fd = new FormData();
  fd.append('file', blob, 'ticket.jpg');
  fd.append('apikey', 'helloworld');
  fd.append('language', 'chs');
  fd.append('OCREngine', '1');
  fd.append('scale', 'true');

  var res = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: fd });
  var data = await res.json();
  if (data.IsErroredOnProcessing) {
    throw new Error((data.ErrorMessage || ['OCR 服务出错'])[0]);
  }
  return (data.ParsedResults[0] || {}).ParsedText || '';
}

// ── OCR ─────────────────────────────────────────────────
document.getElementById('btn-ocr').addEventListener('click', async function () {
  this.disabled = true;
  const progressArea = document.getElementById('progress-area');
  progressArea.hidden = false;
  setProgress(0, '准备中...');

  try {
    setProgress(20, '识别去程截图...');
    var outText = await recognizeText(outboundFile);

    setProgress(60, '识别回程截图...');
    var retText = await recognizeText(returnFile);

    setProgress(90, '解析中...');
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

  if (!o.date || !o.from || !o.to || !o.time || !o.flight ||
      !r.date || !r.from || !r.to || !r.time || !r.flight) {
    alert('请检查所有字段是否已填写');
    return;
  }

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
  } catch (clipboardErr) {
    console.warn('Clipboard API unavailable, using fallback:', clipboardErr);
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
