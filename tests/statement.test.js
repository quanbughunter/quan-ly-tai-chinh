import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStatement, summarize, encodeStatement, decodeStatement, normalizeStatement, statementLink, shareBase, DEFAULT_SHARE_BASE, MAX_ROWS } from '../web/js/statement.js';

// Mọi dữ liệu ở đây là số tự đặt.
const txs = [
  { id: 't1', kind: 'lend', amount: 500_000, currency: 'VND', partyId: 'p1', date: '2026-10-01', ts: 1, note: 'Ăn tối cả nhóm' },
  { id: 't2', kind: 'repay_in', amount: 200_000, currency: 'VND', partyId: 'p1', date: '2026-10-10', ts: 2, note: '' },
  { id: 't3', kind: 'lend', amount: 100.5, currency: 'USD', partyId: 'p1', date: '2026-10-05', ts: 3, note: 'Vé máy bay' },
  { id: 't4', kind: 'lend', amount: 300_000, currency: 'VND', partyId: 'p1', date: '2026-10-01', ts: 0, note: 'Grab' },
  { id: 't5', kind: 'lend', amount: 999, currency: 'VND', partyId: 'p2', date: '2026-10-02', ts: 4, note: 'người khác' },
  { id: 't6', kind: 'expense', amount: 50_000, currency: 'VND', accountId: 'a1', date: '2026-10-03', ts: 5, note: 'không phải nợ' },
  { id: 't7', kind: 'borrow', amount: 50_000, currency: 'VND', partyId: 'p1', date: '2026-10-20', ts: 6, note: 'mượn lại' },
  { id: 't8', kind: 'repay_out', amount: 10_000, currency: 'VND', partyId: 'p1', date: '2026-10-21', ts: 7, note: '' },
];
const base = { txs, partyId: 'p1', owner: 'Quân', party: 'An', asOf: '2026-11-03' };

test('chỉ lấy giao dịch nợ của đúng người, chia theo tiền tệ, sắp theo ngày rồi theo thứ tự nhập', () => {
  const st = buildStatement(base);
  assert.deepEqual(st.c.map((b) => b.k), ['VND', 'USD']);
  const vnd = st.c[0];
  assert.deepEqual(vnd.r.map((r) => r[0] + ' ' + r[1] + ' ' + r[2]), [
    '2026-10-01 lend 300000', '2026-10-01 lend 500000', '2026-10-10 repay_in 200000', '2026-10-20 borrow 50000', '2026-10-21 repay_out 10000',
  ]);
  assert.equal(st.p, 'An');
  assert.equal(st.o, 'Quân');
  assert.equal(st.d, '2026-11-03');
  assert.equal(st.f, undefined);
  assert.equal(st.n, undefined);
});

test('tổng từng tiền tệ: dương = người này nợ mình; khớp cách tính ở màn hình Vay nợ', () => {
  const s = summarize(buildStatement(base));
  const vnd = s.find((x) => x.cur === 'VND');
  // +300k +500k −200k −50k(đi vay) +10k(trả nợ) = 560k
  assert.deepEqual([vnd.up, vnd.down, vnd.balance, vnd.count], [810_000, 250_000, 560_000, 5]);
  const usd = s.find((x) => x.cur === 'USD');
  assert.equal(usd.balance, 100.5);
});

test('lọc từ ngày: các giao dịch trước đó gộp thành số dư đầu kỳ, tổng cuối không đổi', () => {
  const full = summarize(buildStatement(base));
  const st = buildStatement({ ...base, from: '2026-10-10' });
  const vnd = st.c.find((b) => b.k === 'VND');
  assert.equal(vnd.o, 800_000);
  assert.equal(vnd.r.length, 3);
  assert.equal(st.f, '2026-10-10');
  assert.equal(summarize(st).find((x) => x.cur === 'VND').balance, full.find((x) => x.cur === 'VND').balance);
  // USD chỉ có giao dịch trước mốc → vẫn còn một khối với số dư đầu kỳ, không có dòng nào
  const usd = st.c.find((b) => b.k === 'USD');
  assert.deepEqual([usd.o, usd.r.length], [100.5, 0]);
});

test('khối tiền tệ đã về 0 và không còn dòng nào thì bỏ', () => {
  const t = [
    { id: 'a', kind: 'lend', amount: 100, currency: 'RUB', partyId: 'p1', date: '2026-01-01', ts: 1 },
    { id: 'b', kind: 'repay_in', amount: 100, currency: 'RUB', partyId: 'p1', date: '2026-01-02', ts: 2 },
  ];
  assert.equal(buildStatement({ txs: t, partyId: 'p1', from: '2026-02-01' }).c.length, 0);
  assert.equal(buildStatement({ txs: t, partyId: 'p1' }).c[0].r.length, 2);
});

test('người chưa có giao dịch nợ → bảng rỗng', () => {
  const st = buildStatement({ txs, partyId: 'p9' });
  assert.deepEqual(st.c, []);
  assert.deepEqual(summarize(st), []);
});

test('ghi chú gửi kèm được cắt gọn; để trống thì không có khóa n', () => {
  assert.equal(buildStatement({ ...base, note: '   ' }).n, undefined);
  assert.equal(buildStatement({ ...base, note: 'x'.repeat(900) }).n.length, 400);
  assert.equal(buildStatement({ ...base, note: ' STK 0123 ' }).n, 'STK 0123');
});

test('mã hóa rồi giải mã ra đúng dữ liệu cũ (tiếng Việt, số lẻ, nhiều tiền tệ)', async () => {
  const st = buildStatement({ ...base, note: 'Chuyển khoản MB — STK 0123456789 (Nguyễn Văn Á)', from: '2026-10-02' });
  const token = await encodeStatement(st);
  assert.match(token, /^v1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeStatement(token), st);
  assert.deepEqual(await decodeStatement('#' + token), st);
});

test('nén thật: bảng 150 dòng vẫn ngắn gọn (link dưới 3.000 ký tự)', async () => {
  const many = Array.from({ length: 150 }, (_, i) => ({ id: 'x' + i, kind: i % 4 === 3 ? 'repay_in' : 'lend', amount: 25_000 + i * 1000, currency: 'VND', partyId: 'p1', date: `2026-0${1 + (i % 9)}-${String(1 + (i % 27)).padStart(2, '0')}`, ts: i, note: i % 3 ? 'Ăn trưa' : 'Cà phê buổi sáng' }));
  const token = await encodeStatement(buildStatement({ txs: many, partyId: 'p1', owner: 'Quân', party: 'An' }));
  assert.ok(token.length < 3000, `độ dài ${token.length}`);
});

test('link hỏng, bị cắt, sai phiên bản hoặc chứa dữ liệu xấu đều bị từ chối', async () => {
  const st = buildStatement(base);
  const token = await encodeStatement(st);
  for (const bad of ['', '#', 'abc', 'v9.AAAA', 'v1.', 'v1.@@@', token.slice(0, token.length - 20), 'v0.' + Buffer.from('{"v":1,"c":"x"}').toString('base64url'), 'v0.' + Buffer.from('not json').toString('base64url')]) {
    await assert.rejects(() => decodeStatement(bad), /Link không hợp lệ/, JSON.stringify(bad));
  }
  const tweak = (fn) => { const c = structuredClone(st); fn(c); return () => normalizeStatement(c); };
  assert.throws(tweak((c) => { c.v = 2; }), /không hợp lệ/);
  assert.throws(tweak((c) => { c.c[0].k = '<script>'; }), /không hợp lệ/);
  assert.throws(tweak((c) => { c.c[0].r[0][1] = 'expense'; }), /không hợp lệ/);
  assert.throws(tweak((c) => { c.c[0].r[0][0] = '2026-13-xx'; }), /không hợp lệ/);
  assert.throws(tweak((c) => { c.c[0].r[0][2] = -5; }), /không hợp lệ/);
  assert.throws(tweak((c) => { c.c[0].r[0][2] = 'abc'; }), /không hợp lệ/);
  assert.throws(tweak((c) => { c.c[0].r = Array.from({ length: MAX_ROWS + 1 }, () => ['2026-01-01', 'lend', 1, '']); }), /không hợp lệ/);
});

test('chữ trong link bị cắt độ dài (không tin dữ liệu từ link)', () => {
  const st = buildStatement(base);
  st.o = 'o'.repeat(500); st.c[0].r[0][3] = 'n'.repeat(500);
  const n = normalizeStatement(st);
  assert.equal(n.o.length, 60);
  assert.equal(n.c[0].r[0][3].length, 120);
});

test('dựng địa chỉ link và địa chỉ gốc của trang', () => {
  assert.equal(statementLink('https://a.github.io/app/', 'v1.xyz'), 'https://a.github.io/app/share.html#v1.xyz');
  assert.equal(statementLink('https://a.github.io/app', 'v1.xyz'), 'https://a.github.io/app/share.html#v1.xyz');
  assert.equal(statementLink('', 'v0.q'), DEFAULT_SHARE_BASE + 'share.html#v0.q');
  assert.equal(shareBase({ protocol: 'https:', hostname: 'quan.github.io', origin: 'https://quan.github.io', pathname: '/qltc/index.html' }), 'https://quan.github.io/qltc/');
  assert.equal(shareBase({ protocol: 'https:', hostname: 'localhost', origin: 'https://localhost', pathname: '/' }), DEFAULT_SHARE_BASE);
  assert.equal(shareBase({ protocol: 'http:', hostname: '127.0.0.1', origin: 'http://127.0.0.1:5173', pathname: '/' }), DEFAULT_SHARE_BASE);
});
