// 规则 7–10（v2）：定义逐条核对；用王雷之书中有应期的例子核规则 7 的六壬三法照书取支
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = global.window || {};
require('../vendor/qimen-pwa/engine.bundle.js');
const QM = global.window.QM;
const WangShuai = require('../vendor/qimen-pwa/core/wangshuai.js');
const YingQi = require('../vendor/qimen-pwa/core/yingqi.js');
const Rules = require('../core/rules.js');
const TDP = require('../core/liuren/tiandipan.js');
const XY = require('../core/liuren/xiangyi.js');

const LIU_HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const zhuan = (d, purpose) => QM.qimen.calculate(d, { type: '四柱', method: '时家', purpose: purpose || '综合', location: '默认位置' });
const fei = (d) => QM.feipanQimen.calculate(d, { method: '时家', purpose: '综合' });
function dates(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(new Date(Date.UTC(2024, 0, 1) + i * 41 * 3600 * 1000 + (i % 5) * 900 * 1000));
  return out;
}
const run = (d, domain, purpose) => {
  const ch = zhuan(d, purpose), ws = WangShuai.analyze(ch);
  const r = Rules.evaluate({ chart: ch, wangshuai: ws, domain, date: d, nianMing: '庚午' });
  return { ch, ws, r, by: Object.fromEntries(r.rules.map((x) => [x.rule, x])) };
};

test('版本 2.1.0；规则 7–10 齐全', () => {
  const { r } = run(new Date('2026-10-28T15:30:00+08:00'), 'wealth', '财运');
  assert.equal(r.version, '2.1.0');
  assert.deepEqual(r.rules.map((x) => x.rule), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('规则 7（v2.1）：奇门应期融合法 v1 为主；并列时只留落在六壬三法取支里的，都不在则照奇门', () => {
  let single = 0, broke = 0, kept = 0;
  for (const d of dates(200)) {
    const { ch, r, by } = run(d, 'wealth', '财运');
    const x = by[7], sc = r.sanChuan, xk = r.liuren.xunKong;
    assert.equal(x.vote, 0);
    assert.equal(x.method, 'qimen-first');
    assert.deepEqual(x.parts['末传合'], [LIU_HE[sc.chuan[2]]]);
    assert.deepEqual(x.parts['初传合'], [LIU_HE[sc.chuan[0]]]);
    assert.deepEqual(x.parts['三传旬空填实'] || [], [...new Set(sc.chuan.filter((z) => xk.includes(z)))]);
    const q = YingQi.fusionV1(ch, 'wealth').picks;
    assert.deepEqual(x.qimenPicks, q);
    const lr = new Set([LIU_HE[sc.chuan[2]], LIU_HE[sc.chuan[0]], ...sc.chuan.filter((z) => xk.includes(z))]);
    const inLr = q.filter((z) => lr.has(z));
    if (q.length === 1) { assert.deepEqual(x.picks, q); single++; }
    else if (inLr.length) { assert.deepEqual(x.picks, inLr); broke++; }
    else { assert.deepEqual(x.picks, q); kept++; }
    for (const z of x.picks) assert.ok(q.includes(z), '规则 7 不得取奇门没取的支');
  }
  assert.ok(single > 0 && broke > 0 && kept > 0, `单支 ${single}、决胜 ${broke}、照原样 ${kept}`);
});

test('规则 8：类神按占类取；入传不空＝六壬＋，两边同向才投票，判的是「发生」', () => {
  let n = 0, mixed = 0;
  for (const d of dates(200)) {
    const { ws, r, by } = run(d, 'wealth', '财运');
    const x = by[8];
    assert.equal(x.target, 'happened');
    const sz = zhuan(d).siZhu, gan = sz.day[0];
    const ln = TDP.build({ riGan: gan, yueJiang: r.yueJiang.yueJiang, shiZhi: sz.time[1] });
    const lei = (z) => XY.liuQin(gan, z) === '财' || ln.jiangOf(z) === '青龙';
    assert.deepEqual(x.inChuan, r.sanChuan.chuan.filter(lei));
    const xk = r.liuren.xunKong;
    const expLr = x.inChuan.some((z) => !xk.includes(z)) ? 1 : x.inChuan.length ? -1 : r.sanChuan.ke.some((k) => lei(k.shang)) ? 0 : -1;
    assert.equal(x.lr, expLr);
    const w = ws.gongs[r.quYong.Y] || {};
    const expQm = (w.kongWang || w.ruMu || w.jiXing || w.menPo) ? -1 : (w.gongState === '旺' || w.gongState === '相') ? 1 : 0;
    assert.equal(x.qm, expQm);
    if (x.qm && x.lr && x.qm === x.lr) { assert.equal(x.vote, x.qm); assert.ok(x.applicable); n++; }
    else { assert.equal(x.vote, 0); assert.ok(!x.applicable); if (x.qm && x.lr) { assert.equal(x.verdict, '混'); mixed++; } }
  }
  assert.ok(n > 0 && mixed > 0, `投票 ${n}、混 ${mixed}`);
});

test('规则 8：综合、健康等未定类神的占类弃权', () => {
  for (const dom of ['general', 'health', 'lawsuit', 'lost_item']) {
    const { by } = run(new Date('2026-10-28T15:30:00+08:00'), dom);
    assert.equal(by[8].applicable, false);
    assert.ok(by[8].reason);
  }
});

test('规则 9：贵人空亡或临辰戌＝六壬－；值符宫空墓刑迫＝奇门－；只用于事业、学业、官司、求财', () => {
  let n = 0;
  for (const d of dates(200)) {
    const { ch, ws, r, by } = run(d, 'career', '事业');
    const x = by[9];
    const bad = r.liuren.xunKong.includes(x.guiRen) || x.guiRenOverDi === '辰' || x.guiRenOverDi === '戌';
    assert.equal(x.lr, bad ? -1 : 1);
    const w = ws.gongs[String(ch.zhiFuLuoGong || ch.zhiFuGong)] || {};
    assert.equal(x.qm, (w.kongWang || w.ruMu || w.jiXing || w.menPo) ? -1 : 1);
    if (x.applicable) n++;
  }
  assert.ok(n > 0);
  assert.equal(run(new Date('2026-10-28T15:30:00+08:00'), 'relationship', '婚姻').by[9].applicable, false);
});

test('规则 10：干上神与支上神——合生比为＋，冲刑克为－，吉凶并见为不定；巳申合中带刑克不定', () => {
  for (const d of dates(200)) {
    const { r, by } = run(d, 'relationship', '婚姻');
    const x = by[10];
    assert.equal(x.ganShang, r.sanChuan.ke[0].shang);
    assert.equal(x.zhiShang, r.sanChuan.ke[2].shang);
    if ((x.ganShang === '巳' && x.zhiShang === '申') || (x.ganShang === '申' && x.zhiShang === '巳')) assert.equal(x.lr, 0);
    // 六合而不带克者（寅亥、辰酉、午未）为＋；子丑、卯戌合中带克，巳申合中带刑克，皆不定
    if (LIU_HE[x.ganShang] === x.zhiShang) assert.equal(x.lr, ['寅', '亥', '辰', '酉', '午', '未'].includes(x.ganShang) ? 1 : 0, x.lrWhy);
    assert.ok([-1, 0, 1].includes(x.qm));
    if (x.applicable) assert.equal(x.vote, x.lr);
  }
});
