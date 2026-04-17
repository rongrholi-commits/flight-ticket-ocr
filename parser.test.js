// parser.test.js
const assert = require('assert');
const {
  parseRoute,
  parseDate,
  parseTimeRange,
  parseAirports,
  parseFlight,
} = require('./parser.js');

// ── 旧格式（带分隔符）──────────────────────────────────────
const outOld = `广州→徐州
04-28 周二
15:05 → 17:25 白云T2-观音T2
南航CZ3339 空客319(中)`;

const retOld = `徐州→广州
04-30 周四
16:15 → 19:00 观音T2-白云T2
长龙GJ8060 空客321(中)`;

let r = parseRoute(outOld);
assert.strictEqual(r.from, '广州', 'old parseRoute: outbound from');
assert.strictEqual(r.to,   '徐州', 'old parseRoute: outbound to');

r = parseRoute(retOld);
assert.strictEqual(r.from, '徐州', 'old parseRoute: return from');
assert.strictEqual(r.to,   '广州', 'old parseRoute: return to');

assert.strictEqual(parseDate(outOld), '4.28', 'old parseDate: outbound');
assert.strictEqual(parseDate(retOld), '4.30', 'old parseDate: return');

assert.strictEqual(parseTimeRange(outOld), '15：05-17：25', 'old parseTimeRange: outbound');
assert.strictEqual(parseTimeRange(retOld), '16：15-19：00', 'old parseTimeRange: return');

let ap = parseAirports(outOld, '广州', '徐州');
assert.strictEqual(ap.from, '广州白云 T2', 'old parseAirports: outbound from');
assert.strictEqual(ap.to,   '徐州观音 T2', 'old parseAirports: outbound to');

ap = parseAirports(retOld, '徐州', '广州');
assert.strictEqual(ap.from, '徐州观音 T2', 'old parseAirports: return from');
assert.strictEqual(ap.to,   '广州白云 T2', 'old parseAirports: return to');

assert.strictEqual(parseFlight(outOld), '南航CZ3339', 'old parseFlight: outbound');
assert.strictEqual(parseFlight(retOld), '长龙GJ8060', 'old parseFlight: return');

// ── 实际 OCR.space 输出格式（日期用"一"、机场整行、无路线分隔符）─────
const outReal = `12：17
广州常州
5G
44
差标
客服
O·充电宝携带提醒：根据中国民用航空局消息：亲爱的0
单程
04一21周一
09：45
总时长2h20m
12：05白云T1一奔牛
深航ZH9653》空客320（中）]有小食《到达准点率84％〉`;

const retReal = `12：22
常州广州
44
差标
客服
O·充电宝携带提醒：根据中国民用航空局消息：亲爱的0
单程
04一30周四总时长2h20m
20：05
22：25奔牛一白云T2
南航CZ3900》空客A32叭中）》无餐食到达准点率67％〉`;

r = parseRoute(outReal);
assert.strictEqual(r.from, '广州', 'real parseRoute: outbound from');
assert.strictEqual(r.to,   '常州', 'real parseRoute: outbound to');

r = parseRoute(retReal);
assert.strictEqual(r.from, '常州', 'real parseRoute: return from');
assert.strictEqual(r.to,   '广州', 'real parseRoute: return to');

assert.strictEqual(parseDate(outReal), '4.21', 'real parseDate: outbound');
assert.strictEqual(parseDate(retReal), '4.30', 'real parseDate: return');

assert.strictEqual(parseTimeRange(outReal), '09：45-12：05', 'real parseTimeRange: outbound');
assert.strictEqual(parseTimeRange(retReal), '20：05-22：25', 'real parseTimeRange: return');

ap = parseAirports(outReal, '广州', '常州');
assert.strictEqual(ap.from, '广州白云 T1', 'real parseAirports: outbound from');
assert.strictEqual(ap.to,   '常州奔牛',    'real parseAirports: outbound to');

ap = parseAirports(retReal, '常州', '广州');
assert.strictEqual(ap.from, '常州奔牛',    'real parseAirports: return from');
assert.strictEqual(ap.to,   '广州白云 T2', 'real parseAirports: return to');

assert.strictEqual(parseFlight(outReal), '深航ZH9653', 'real parseFlight: outbound');
assert.strictEqual(parseFlight(retReal), '南航CZ3900', 'real parseFlight: return');

console.log('All tests passed!');
