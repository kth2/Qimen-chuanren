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

test('版本 2.3.0；规则 7–10 齐全', () => {
  const { r } = run(new Date('2026-10-28T15:30:00+08:00'), 'wealth', '财运');
  assert.equal(r.version, '2.3.0');
  assert.deepEqual(r.rules.map((x) => x.rule), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
test('规则 7（v2.1＋v2.3）：奇门融合法为主、六壬决胜；贵人之支冲奇门空亡宫的地支时加取贵人之支', () => {
  let single = 0, broke = 0, kept = 0, gui = 0;
  for (const d of dates(200)) {
    const { ch, ws, r, by } = run(d, 'wealth', '财运');
    const x = by[7], sc = r.sanChuan, xk = r.liuren.xunKong;
    // 贵人冲空：独立重算
    const g0 = r.liuren.guiRen;
    const kg = Object.keys(ws.gongs).filter((g) => ws.gongs[g].kongWang);
    const ck = kg.some((g) => (TDP.GONG_ZHI[g] || []).some((z) => CHONG[z] === g0));
    assert.equal(!!x.gui, ck, '贵人冲空判定');
    if (ck) { gui++; assert.deepEqual(x.parts['贵人冲空'], [g0]); assert.ok(x.picks.includes(g0)); }
    assert.equal(x.vote, 0);
    assert.equal(x.method, 'qimen-first');
    assert.deepEqual(x.parts['末传合'], [LIU_HE[sc.chuan[2]]]);
    assert.deepEqual(x.parts['初传合'], [LIU_HE[sc.chuan[0]]]);
    assert.deepEqual(x.parts['三传旬空填实'] || [], [...new Set(sc.chuan.filter((z) => xk.includes(z)))]);
    const q = YingQi.fusionV1(ch, 'wealth').picks;
    assert.deepEqual(x.qimenPicks, q);
    const lr = new Set([LIU_HE[sc.chuan[2]], LIU_HE[sc.chuan[0]], ...sc.chuan.filter((z) => xk.includes(z))]);
    const inLr = q.filter((z) => lr.has(z));
    const add = (arr) => (ck && !arr.includes(g0) ? arr.concat(g0) : arr);
    if (q.length === 1) { assert.deepEqual(x.picks, add(q)); single++; }
    else if (inLr.length) { assert.deepEqual(x.picks, add(inLr)); assert.deepEqual(x.overlap, inLr); broke++; }
    else { assert.deepEqual(x.picks, add(q)); kept++; }
    for (const z of x.picks) assert.ok(q.includes(z) || (ck && z === g0), '规则 7 只取奇门所取之支，加贵人冲空之支');
  }
  assert.ok(single > 0 && broke > 0 && kept > 0 && gui > 0, `单支 ${single}、决胜 ${broke}、照原样 ${kept}、贵人冲空 ${gui}`);
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

/* ---------- v2.2（2026-11-02 占类检查） ---------- */
const YS = require('../vendor/qimen-pwa/core/yongshen.js');
YS.load(require('../vendor/qimen-pwa/knowledge/domains.json'));
/** 照界面同一取法：引擎 buildPrompt 的用神 → YongShen.resolve → pickMain */
function pick(ch, ui, nm) {
  const ec = YS.toEngineCategory(ui, 'zhuanpan');
  const ctx = (QM.zhuanpanPredict.buildPrompt(ch, '', { category: ec, fallbackCategory: ec, nianMingGan: nm || '' }) || {}).context || {};
  return YS.pickMain(YS.resolve({ domain: ui, chart: ch, options: { engineYong: ctx.yong, school: 'zhuanpan', nianMingGan: nm || '' } }));
}
const D = new Date(2026, 9, 30, 12, 46);

test('v2.2 转盘事宫＝【用神落宫】第一个在盘者：失物取玄武宫、出行取开门宫、股市取生门宫（原先都是时干）', () => {
  for (const [ui, dk, name, find] of [['失物', 'lost_item', '玄武', (c) => c.baShen], ['出行', 'travel', '开门', (c) => c.baMen], ['股市', 'stock', '生门', (c) => c.baMen]]) {
    const ch = zhuan(D, ui), y = pick(ch, ui);
    assert.equal(y.name, name, ui);
    const r = Rules.evaluate({ chart: ch, wangshuai: WangShuai.analyze(ch), domain: dk, date: D, nianMing: '庚午', yong: { gong: y.gong, name: y.name, source: y.source } });
    assert.equal(r.quYong.Y, String(y.gong), ui);
    assert.equal(find(ch)[r.quYong.Y], name, ui + ' 事宫上须是该用神');
    assert.equal(r.quYong.ySource, 'engine');
    const old = Rules.evaluate({ chart: ch, wangshuai: WangShuai.analyze(ch), domain: dk, date: D, nianMing: '庚午' });
    assert.equal(old.quYong.yName, '时干', ui + ' 不给 yong 时照五行推理 v1');
  }
});

test('v2.2 引擎无此占类：终身局取年命宫、异梦取腾蛇宫（占类表）', () => {
  const ch = zhuan(D, '终身局');
  const y = pick(ch, '终身局', '丙');
  assert.equal(y.name, '年命'); assert.equal(y.source, 'domain');
  const r = Rules.evaluate({ chart: ch, wangshuai: WangShuai.analyze(ch), domain: 'lifetime', date: D, nianMing: '丙午', yong: y });
  assert.equal(r.quYong.ySource, 'domain');
  assert.equal(ch.tianPan[r.quYong.Y], '丙');
  assert.equal(pick(zhuan(D, '异梦'), '异梦').name, '腾蛇');
});

test('v2.2 规则 8 加失物（财爻，伍剑虹书页 134）；规则 9 加股市', () => {
  const { by } = run(D, 'lost_item', '失物');
  assert.match(by[8].leiShen || '', /财爻/);
  assert.ok(by[8].lrWhy, '失物应有六壬一侧判断');
  assert.notEqual(run(D, 'stock', '股市').by[9].reason, '只用于事业、学业、官司、求财、股市');
  assert.ok(run(D, 'stock', '股市').by[9].lrWhy);
  assert.match(run(D, 'health', '健康').by[8].reason, /未定类神/, '健康书中无类神入传之法，仍弃权');
});

test('v2.2 占类无「我」（天气）：规则 2、3、6、10 弃权；1、4、5、7 照常', () => {
  const ch = zhuan(D, '天气');
  const r = Rules.evaluate({ chart: ch, wangshuai: WangShuai.analyze(ch), domain: 'weather', date: D, nianMing: '庚午', selfless: true });
  const by = Object.fromEntries(r.rules.map((x) => [x.rule, x]));
  for (const n of [2, 3, 6, 10]) { assert.equal(by[n].applicable, false, '规则' + n); assert.match(by[n].reason, /无「我」/); }
  assert.ok(!/无「我」/.test(by[1].reason || '') && by[7].rule === 7);
  assert.equal(!!YS.getDomain('weather').yongshen.self.length, false, '前提：占类表天气 self 为空');
  assert.ok(YS.getDomain('shefu').yongshen.self.length, '射覆占类表有我（日干），不弃权');
});

test('v2.3 贵人冲空：复盘两例（10-30 丑日）规则 7 加取丑；飞盘无融合法时贵人冲空单给此支', () => {
  for (const [d, dom] of [[new Date(2026, 9, 23, 8, 18), 'pregnancy'], [new Date(2026, 8, 7, 20, 22), 'career']]) {
    const ch = zhuan(d), r = Rules.evaluate({ chart: ch, wangshuai: WangShuai.analyze(ch), domain: dom, date: d });
    const x = r.rules.find((v) => v.rule === 7);
    assert.equal(x.gui.zhi, '丑'); assert.equal(x.gui.gong, '2'); assert.equal(x.gui.chongZhi, '未');
    assert.ok(x.picks.includes('丑'));
  }
  // 飞盘：找一个贵人冲空的时刻，规则 7 只给贵人之支；不冲空则弃权
  let seen = 0, abst = 0;
  for (const d of dates(120)) {
    const ch = fei(d), r = Rules.evaluate({ chart: ch, wangshuai: WangShuai.analyze(ch), domain: 'wealth', date: d });
    const x = r.rules.find((v) => v.rule === 7);
    if (x.gui) { seen++; assert.deepEqual(x.picks, [x.gui.zhi]); assert.equal(x.qimenPicks, null); }
    else { abst++; assert.equal(x.applicable, false); }
  }
  assert.ok(seen > 0 && abst > 0, `飞盘贵人冲空 ${seen}、弃权 ${abst}`);
});
