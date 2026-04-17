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
