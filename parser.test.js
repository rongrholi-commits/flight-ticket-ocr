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
