// 影子追踪 v2：判法照 docs/SHADOW-liuren-v2.md；原书例作 golden
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = global.window || {};
require('../vendor/qimen-pwa/engine.bundle.js');
const QM = global.window.QM;
const WS = require('../vendor/qimen-pwa/core/wangshuai.js');
const Rules = require('../core/rules.js');
const SC = require('../core/liuren/sanchuan.js');
const TDP = require('../core/liuren/tiandipan.js');
const SH2 = require('../core/liuren/shadow2.js');
const SH1 = require('../core/liuren/shadow.js');
const CB = require('../core/casebook.js');

const zhuan = (iso) => QM.qimen.calculate(new Date(iso), { type: '四柱', method: '时家', purpose: '综合', location: '默认位置' });
const fei = (iso) => QM.feipanQimen.calculate(new Date(iso), { method: '时家', purpose: '综合' });
function evalAt(iso, mk, domain) {
  const pan = (mk || zhuan)(iso), ws = WS.analyze(pan);
  const res = Rules.evaluate({ chart: pan, wangshuai: ws, domain: domain || '', date: new Date(iso) });
  const sz = pan.siZhu;
  return { pan, res, s: SH2.evaluate({ school: res.school, chart: pan, ws, sc: res.sanChuan, riZhu: sz.day, xunKong: res.liuren.xunKong,
    Y: res.quYong.Y, domain: domain || '', yueZhi: sz.month[1], taiSui: sz.year[1] }) };
}

test('奇门迟速表与 Qimen-pwa knowledge/timing-rules.json 的 pace.map 一致（引用，不另改）', () => {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '../vendor/qimen-pwa/knowledge/timing-rules.json'), 'utf8'));
  const m = {}; for (const k in j.pace.map) m[k] = j.pace.map[k].speed;
  assert.deepEqual(SH2.PACE, m);
});

test('S7-A、S7-B：袁-8 癸酉日丑将戌时，三传辰未戌 → 成期酉、散期辰；末传合卯', () => {
  const p = SH2.liurenPart({ riZhu: '癸酉', yueJiang: '丑', shiZhi: '戌', yueZhi: '子', taiSui: '戌', domain: '' });
  assert.deepEqual([p.S7A.cheng, p.S7A.san], ['酉', '辰']);
  assert.deepEqual(p.S7A.picks, ['酉', '辰']);
  assert.deepEqual(p.S7B.picks, ['卯']);
  // 首从发用：初传辰，非太岁（戌）、月建（子）、月将（丑）、旬首、日干枝（丑、酉）、占时（戌）；辰在酉后第 7 位，出四位不取
  assert.deepEqual([p.S7F.kinds, p.S7F.d], [[], 0]);
});

test('S7-F：发用起占时 → 当时；初传在日枝后一至三位 → 第 d+1 日', () => {
  // 遍历找两种例子，并按定义逐项核对
  let seenShi = false, seenD = false;
  for (const rz of ['甲子', '乙丑', '丙寅', '丁卯', '戊辰', '己巳']) for (const yj of '子丑寅卯辰巳午未申酉戌亥') for (const sz of '子卯午酉') {
    const sc = SC.compute({ riGan: rz[0], riZhi: rz[1], yueJiang: yj, shiZhi: sz });
    const p = SH2.liurenPart({ sc, riZhu: rz, yueZhi: '', taiSui: '', domain: '' });
    if (sc.chuan[0] === sz) { assert.ok(p.S7F.kinds.includes('时')); seenShi = true; }
    if (!p.S7F.kinds.length && p.S7F.d) {
      const ZHI = '子丑寅卯辰巳午未申酉戌亥';
      assert.equal(((ZHI.indexOf(sc.chuan[0]) - ZHI.indexOf(rz[1])) % 12 + 12) % 12, p.S7F.d);
      seenD = true;
    }
  }
  assert.ok(seenShi && seenD);
});

test('S8-A：只在失物、行人；发用为日干之墓才触发（乙墓戌）', () => {
  let fired = 0;
  for (const yj of '子丑寅卯辰巳午未申酉戌亥') for (const sz of '子丑寅卯辰巳午未申酉戌亥') {
    const sc = SC.compute({ riGan: '乙', riZhi: '丑', yueJiang: yj, shiZhi: sz });
    const p = SH2.liurenPart({ sc, riZhu: '乙丑', domain: 'lost_item' });
    assert.equal(p.S8A.fired, sc.chuan[0] === '戌');
    if (p.S8A.fired) fired++;
    assert.equal(SH2.liurenPart({ sc, riZhu: '乙丑', domain: 'wealth' }).S8A.fired, false);
  }
  assert.ok(fired > 0);
});

test('N1：飞盘不立；初传旬空无遁干则弃权；记下各条件；票照规格合成', () => {
  assert.equal(evalAt('2026-03-15T10:30:00+08:00', fei).s.N1.reason, '飞盘本版不立');
  const seen = { 两边同吉: 0, 两边同凶: 0, 混: 0, 弃权: 0 }, reasons = new Set();
  const t0 = Date.parse('2026-01-01T00:30:00+08:00');
  for (let i = 0; i < 400; i++) {
    const iso = new Date(t0 + i * 7 * 3600e3 + (i % 5) * 864e5 * 3).toISOString();
    const { pan, res, s } = evalAt(iso);
    const v = s.N1;
    seen[v.verdict]++;
    if (v.reason) reasons.add(v.reason.replace(/[甲乙丙丁戊己庚辛壬癸]/g, 'X'));
    const c1 = res.sanChuan.chuan[0], gan = TDP.dunGan(pan.siZhu.day)[c1];
    if (!gan) { assert.equal(v.reason, '初传旬空，无遁干'); continue; }
    assert.equal(v.gan, gan);
    if (!v.gong) continue;
    // 落宫：该干在天盘八宫
    assert.ok(String(pan.tianPan[v.gong]).includes(gan));
    const P = v.parts;
    const hurt = P.ruMu || P.jiXing || P.menPo || P.kong;
    assert.equal(v.qm, hurt ? -1 : P.menClass === '吉' ? 1 : 0);
    assert.equal(v.lr, SH2.GAN_SIDE[gan]);
    if (v.lr && v.qm && v.lr === v.qm) assert.equal(v.vote, v.lr);
    else assert.equal(v.vote, 0);
    // 入墓、击刑只算本干（天盘），不算同宫地盘干
    const w = WS.analyze(pan).gongs[v.gong];
    assert.equal(P.ruMu, String(w.ruMuDetail).includes('天盘' + gan));
  }
  for (const k of Object.keys(seen)) assert.ok(seen[k] > 0, '未出现：' + k);
  assert.ok(reasons.has('初传旬空，无遁干'));
});

test('N3：六壬单看按主速、主迟条数；奇门单看按用神宫旺衰；两边一致才合看', () => {
  const t0 = Date.parse('2026-02-01T09:00:00+08:00');
  const rel = new Set();
  for (let i = 0; i < 120; i++) {
    const { s } = evalAt(new Date(t0 + i * 13 * 3600e3).toISOString(), zhuan, 'wealth');
    const n = s.N3;
    assert.equal(n.lr, n.su.length > n.chi.length ? '速' : n.chi.length > n.su.length ? '迟' : '');
    assert.equal(n.qm, SH2.PACE[n.state] || '');
    assert.equal(n.fused, n.lr && n.lr === n.qm ? n.lr : '');
    rel.add(n.relation);
  }
  assert.ok(rel.has('一致') && rel.has('相反'));
});

test('计分小件：一致性 C、逐题瞎猜概率的尾概率', () => {
  assert.equal(SH2.concord([1, 2], [5, 6]), 1);
  assert.equal(SH2.concord([5], [5]), 0.5);
  assert.equal(SH2.concord([], [1]), null);
  assert.ok(Math.abs(SH2.pAtLeast([0.5, 0.5], 1) - 0.75) < 1e-12);
  assert.ok(Math.abs(SH2.pAtLeast(new Array(12).fill(1 / 12), 0) - 1) < 1e-12);
  const h = SH2.hitStats([{ picks: ['子', '丑'], zhi: '子' }, { picks: ['寅'], zhi: '卯' }]);
  assert.deepEqual([h.n, h.hit, h.expect], [2, 1, 0.25]);
});

// 造案例
const mk = (id, at, o) => ({ id, createdAt: at, question: 'q' + id, input: { date: o.date || '2026-11-20 10:00', domain: o.domain || '' },
  chart: { siZhu: { day: o.day || '癸酉', time: '壬' + (o.shi || '戌'), month: '丙子', year: '丙戌' } },
  liuren: { yueJiang: o.yj || '丑', xunKong: o.kong || ['戌', '亥'] },
  votes: o.votes || [], shadow2: o.shadow2,
  feedback: { archived: true, note: 'n' + id, verdict: 'happened', actualDate: o.actual || '', actualDayZhi: o.zhi || '',
    s8: o.s8 || null, labels: { type: 'yesno', want: 'hope', happened: o.happened || 'no' } } });

test('检验集按录入时间分；N1、N3 只认起盘时存下的；S7 旧案例可重算', () => {
  const recs = [
    mk(1, '2026-11-10T01:00:00.000Z', { zhi: '酉', actual: '2026-11-21' }),   // 回看
    mk(2, '2026-11-17T01:00:00.000Z', { zhi: '酉', actual: '2026-11-21' }),   // 检验集，无 shadow2 → S7 重算
  ];
  const s = SH2.stats(recs, CB, SH1);
  assert.equal(s.test.S7.A.n, 1);
  assert.equal(s.test.S7.A.hit, 1);          // 成期酉
  assert.equal(s.lookback.S7.A.n, 1);
  assert.equal(s.test.N1.eligible, 0);        // 没存 N1
  assert.equal(s.test.N3.n, 0);
  assert.equal(s.test.S7.A.verdict, null);    // 未到评估点
});

test('S8-A：失物、行人分开；物在与找回分开计', () => {
  const recs = [];
  // 甲子日未将……：直接给存好的 shadow2，免得找盘
  const sh = (fired) => ({ v: 'liuren-shadow-v2', N1: null, N3: null, S7A: { cheng: '子', san: '午', picks: ['子', '午'] }, S7B: { picks: ['丑'] },
    S7F: { kinds: [], d: 0, toXunEnd: 9 }, S8A: { domain: 'lost_item', c1: '未', stage: fired ? '墓' : '帝旺', fired } });
  for (let i = 0; i < 10; i++) recs.push(mk('f' + i, '2026-11-18T00:00:00.000Z', { domain: 'lost_item', shadow2: sh(true), s8: { wuZai: i < 8 ? 'yes' : 'no', zhaoHui: i < 3 ? 'yes' : 'no' } }));
  for (let i = 0; i < 30; i++) recs.push(mk('r' + i, '2026-11-18T00:00:00.000Z', { domain: 'lost_item', shadow2: sh(false), s8: { wuZai: i < 15 ? 'yes' : 'no' } }));
  const x = SH2.stats(recs, CB, SH1).test.S8A.lost_item;
  assert.deepEqual([x.fired, x.rest], [10, 30]);
  assert.ok(Math.abs(x.diff - 0.3) < 1e-9);
  assert.equal(x.reached.label, '第一次评估');
  assert.equal(x.verdict, '通过');
  assert.equal(x.secondary.firedRate, 0.3);   // 物在 80%，找回只 30%：两件事
  assert.equal(SH2.stats(recs, CB, SH1).test.S8A.traveler.total, 0);
});

test('N3 计分：判速者实际来得早则 C 高；合看要比单看较好的一方再好 5 点才通过', () => {
  const recs = [];
  const n3 = (lr, qm) => ({ lr, qm, fused: lr === qm ? lr : '', relation: lr === qm ? '一致' : '相反', su: [], chi: [], state: '', gong: '' });
  const base = { v: 'liuren-shadow-v2', N1: null, S7A: { cheng: '子', san: '午', picks: ['子', '午'] }, S7B: { picks: ['丑'] }, S7F: { kinds: [], d: 0, toXunEnd: 9 }, S8A: { domain: '', fired: false } };
  for (let i = 0; i < 10; i++) recs.push(mk('a' + i, '2026-11-18T00:00:00.000Z', { date: '2026-11-20 10:00', actual: '2026-11-21', shadow2: Object.assign({ N3: n3('速', '速') }, base) }));
  for (let i = 0; i < 10; i++) recs.push(mk('b' + i, '2026-11-18T00:00:00.000Z', { date: '2026-11-20 10:00', actual: '2026-12-20', shadow2: Object.assign({ N3: n3('迟', '迟') }, base) }));
  // 两边相反的 10 题：六壬说速而实际慢，奇门说迟而实际慢——奇门单看较好
  for (let i = 0; i < 10; i++) recs.push(mk('c' + i, '2026-11-18T00:00:00.000Z', { date: '2026-11-20 10:00', actual: '2026-12-25', shadow2: Object.assign({ N3: n3('速', '迟') }, base) }));
  const r = SH2.stats(recs, CB, SH1).test.N3;
  assert.equal(r.fused.c, 1);
  assert.ok(r.lr.c < 1 && r.qm.c === 1);
  assert.equal(r.reached.label, '第一次评估');
  assert.equal(r.verdict, '继续');           // 合看 1.00 不比奇门单看 1.00 高 5 点
});

test('组合实验：同一批如愿题，出票率与全集正确率（弃权算半对）都列', () => {
  const recs = [];
  const v = (k, vote) => ({ rule: k, applicable: true, vote });
  for (let i = 0; i < 4; i++) recs.push(mk('k' + i, '2026-11-18T00:00:00.000Z', { happened: i < 2 ? 'yes' : 'no', votes: [v(1, i < 2 ? 1 : -1)] }));
  const c = SH2.stats(recs, CB, SH1).test.combo;
  const he = c.rows[0][1];
  assert.deepEqual([he.all, he.n, he.coverage, he.adjusted, he.balanced], [4, 4, 1, 1, 1]);
  const n1 = c.rows[3][1];
  assert.deepEqual([n1.n, n1.coverage, n1.adjusted], [0, 0, 0.5]);
});

test('规格登记：冻结日与分界一致', () => {
  assert.equal(SH2.SPEC.cutoff.slice(0, 10), SH2.SPEC.frozenAt);
  assert.deepEqual(SH2.RUYUAN_RULES, [1, 2, 3, 4, 6, 9, 10]);
});

test('较早的案例只存占类名：失物、行人按名补上占类键', () => {
  assert.equal(SH2.domainOf({ input: { ui: '失物' } }), 'lost_item');
  assert.equal(SH2.domainOf({ input: { ui: '行人' } }), 'traveler');
  assert.equal(SH2.domainOf({ input: { ui: '财运', domain: 'wealth' } }), 'wealth');
  assert.equal(SH2.domainOf({ input: { ui: '综合' } }), '');
});

test('S7 另列起盘当天就应验者除外的一栏', () => {
  const recs = [mk(1, '2026-11-17T01:00:00.000Z', { date: '2026-11-20 10:00', actual: '2026-11-20', zhi: '酉' }),
    mk(2, '2026-11-17T01:00:00.000Z', { date: '2026-11-20 10:00', actual: '2026-11-22', zhi: '酉' })];
  const s = SH2.stats(recs, CB, SH1).test.S7;
  assert.equal(s.A.n, 2);
  assert.equal(s.notSameDay.A.n, 1);
});
