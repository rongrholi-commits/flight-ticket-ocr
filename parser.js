// parser.js

// 从 OCR 文本提取城市对
// 支持三种格式：
//   "广州→徐州"  "广州 一 徐州"  "广州徐州"（OCR 省略分隔符）
// [^\S\n]* 仅允许空格，不跨行，防止把相邻两行的汉字误拼成城市对
function parseRoute(text) {
  const match = text.match(/([\u4e00-\u9fff]{2,3})[^\S\n]*[→一]?[^\S\n]*([\u4e00-\u9fff]{2,3})/);
  if (!match) return null;
  return { from: match[1], to: match[2] };
}

// 提取日期，"04-28" / "04一28" → "4.28"
// OCR 常把日期里的"-"识别为汉字"一"
function parseDate(text) {
  const match = text.match(/(\d{1,2})[-./一](\d{1,2})/);
  if (!match) return '';
  return `${parseInt(match[1])}.${parseInt(match[2])}`;
}

// 提取时间段：找文本中距离最近的两个 HH:MM，不依赖分隔符字符
// OCR 常把 "→" 识别为 "-—" 或其他混合字符，故不做分隔符匹配
function parseTimeRange(text) {
  const times = [...text.matchAll(/(\d{2})[:：](\d{2})/g)];
  for (let i = 0; i < times.length - 1; i++) {
    if (times[i + 1].index - times[i].index < 30) {
      return `${times[i][1]}：${times[i][2]}-${times[i + 1][1]}：${times[i + 1][2]}`;
    }
  }
  return '';
}

// 提取机场信息
// OCR 输出的航线行格式为 "白云T1一奔牛" 或 "奔牛一白云T2"
// 策略：优先匹配整行 "机场A(T\d)?一机场B(T\d)?" 同时拿到两端信息
// 降级：只找到 T+数字 → 仅对应端填完整，另一端填城市
// 兜底：都没有 → 填城市名
function parseAirports(text, fromCity, toCity) {
  const m = text.match(/([\u4e00-\u9fff]{2,3})(T\d)?(?:一|-)([\u4e00-\u9fff]{2,3})(T\d)?/);
  if (m && (m[2] || m[4])) {
    const from = fromCity + m[1] + (m[2] ? ' ' + m[2] : '');
    const to   = toCity   + m[3] + (m[4] ? ' ' + m[4] : '');
    return { from, to };
  }
  const hits = [...text.matchAll(/([\u4e00-\u9fff]{2,3})\s*(T\d)/g)].map(h => ({
    name: h[1], term: h[2],
  }));
  const from = hits[0] ? `${fromCity}${hits[0].name} ${hits[0].term}` : fromCity;
  const to   = hits[1] ? `${toCity}${hits[1].name} ${hits[1].term}` : toCity;
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
