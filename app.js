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
    document.getElementById('label-outbound').textContent = this.files[0].name;
    document.getElementById('zone-outbound').classList.add('selected');
  }
  checkBothSelected();
});

document.getElementById('input-return').addEventListener('change', function () {
  returnFile = this.files[0];
  if (returnFile) {
    document.getElementById('label-return').textContent = this.files[0].name;
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
          setProgress(base + m.progress * 35, '识别第 ' + (phase + 1) + ' 张图片 ' + Math.round(m.progress * 100) + '%');
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
