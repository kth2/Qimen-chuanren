/**
 * 奇门穿壬 · 六壬判法影子追踪 v1（只记账，不投票，不进规则票）。纯函数，无副作用。appliesTo: chuanren-exp
 *
 * 规格见 docs/SHADOW-liuren-v1.md（2026-11-10 冻结）。这里只做两件事：
 *   ① 照规格给一张盘记下两条判法各自的预测；
 *   ② 照规格按录入时间分出检验集，到评估点才给判定。
 * 判法只依《大六壬探原》原文，原文没说的情形一律不投票。
 * 旧案例照存档的日柱、月将、占时重算（与新盘同一算法），所以不必改案例格式。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sanchuan.js'));
  else root.LiurenShadow = factory(root.LiurenSanChuan);
})(typeof self !== 'undefined' ? self : this, function (SC) {
  'use strict';

  const SPEC = {
    id: 'liuren-shadow-v1',
    frozenAt: '2026-11-10',
    /** 检验集：录入时间（createdAt）不早于此者。此前的只作回看，不计入判定。 */
    cutoff: '2026-11-10T00:00:00.000Z',
  };
  const ITEMS = [
    { id: 'S1', name: '干上神生克日干', src: '探原 61',
      yuan: '干上神生干，大吉；干上神克干，大凶',
      rule: '第一课上神五行生日干 → 记「如愿」；克日干 → 记「不如愿」；比和、干生上神、干克上神不投票',
      truth: '如愿／不如愿（同各规则）', kind: 'two-sided' },
    { id: 'S2', name: '初传落旬空', src: '探原 63',
      yuan: '用空亡，忧喜不成，谋事出旬可望',
      rule: '初传为六壬日旬空 → 记「所问之事不发生」；初传不空不投票',
      truth: '事是否发生（同规则 8）', kind: 'one-sided' },
  ];
  /** 评估点（只看两次）。S1 按投票题数；S2 按触发题数与未触发题数。 */
  const EVAL = {
    S1: [{ n: 40, each: 10, label: '第一次评估' }, { n: 100, each: 25, label: '第二次（最后一次）评估' }],
    S2: [{ fired: 10, rest: 30, label: '第一次评估' }, { fired: 25, rest: 75, label: '第二次（最后一次）评估' }],
  };
  /** S2 通过门槛：未触发组的发生率减触发组的发生率，至少 15 个百分点 */
  const S2_MARGIN = 0.15;

  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const ZHI_WX = { 子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土' };
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

  /**
   * 一张盘的两条影子预测。
   * @param p { riZhu, yueJiang, shiZhi, xunKong }
   * @returns { S1: { vote: +1|-1|0, shang, rel }, S2: { fired: bool, c1 } }
   */
  function votes(p) {
    const riGan = p.riZhu[0], riZhi = p.riZhu[1];
    const sc = SC.compute({ riGan, riZhi, yueJiang: p.yueJiang, shiZhi: p.shiZhi });
    const shang = sc.ke[0].shang, me = GAN_WX[riGan], g = ZHI_WX[shang];
    const rel = SHENG[g] === me ? '干上神生干' : KE[g] === me ? '干上神克干'
      : SHENG[me] === g ? '干生上神' : KE[me] === g ? '干克上神' : '比和';
    const c1 = sc.chuan[0];
    return {
      S1: { vote: rel === '干上神生干' ? 1 : rel === '干上神克干' ? -1 : 0, shang, rel },
      S2: { fired: (p.xunKong || []).includes(c1), c1 },
    };
  }

  /** 旧案例：照存档的日柱、月将、占时重算。缺项返回 null */
  function recVotes(rec) {
    const sz = (rec.chart && rec.chart.siZhu) || {}, lr = rec.liuren || {};
    if (!sz.day || !sz.time || !lr.yueJiang) return null;
    try { return votes({ riZhu: sz.day, yueJiang: lr.yueJiang, shiZhi: sz.time[1], xunKong: lr.xunKong }); }
    catch (e) { return null; }
  }

  const rate = (a) => (a.length ? a.filter(Boolean).length / a.length : null);

  /** 一组记录上的两条计分（不含判定） */
  function tally(recs, CB) {
    const rows1 = [], fired = [], rest = [], ai = [];
    for (const r of recs) {
      const v = recVotes(r);
      if (!v) continue;
      const o = CB.outcome(r), h = CB.happened(r);
      if (o !== null && v.S1.vote !== 0) {
        rows1.push({ pred: v.S1.vote > 0, truth: o });
        const a = CB.aiPred(r);
        if (a !== null) ai.push({ pred: a, truth: o });   // 同一批题上的 AI 结论，作基准
      }
      if (h !== null) (v.S2.fired ? fired : rest).push(h);
    }
    const s1 = CB.score(rows1), aiS = CB.score(ai);
    const rf = rate(fired), rr = rate(rest);
    return {
      S1: Object.assign(s1, { ai: aiS }),
      S2: { fired: fired.length, rest: rest.length, firedRate: rf, restRate: rr, diff: rf != null && rr != null ? rr - rf : null },
    };
  }

  /**
   * 统计：检验集（录入不早于 cutoff）给评估进度与判定；此前的只作回看。
   * @param records 案例本全部记录
   * @param CB      core/casebook.js（取 outcome、happened、aiPred、score、dedupe）
   */
  function stats(records, CB) {
    const done = CB.dedupe((records || []).filter((r) => r && r.feedback && r.feedback.archived));
    const isTest = (r) => String(r.createdAt || '') >= SPEC.cutoff;
    const test = tally(done.filter(isTest), CB), look = tally(done.filter((r) => !isTest(r)), CB);

    // S1：判定照各规则的同一套（比同批 AI 结论高 5 点且不低于 55% 为通过；低于 AI 为停止）
    const a = test.S1;
    let r1 = null;
    for (const e of EVAL.S1) if (a.n >= e.n && a.pos >= e.each && a.neg >= e.each) r1 = e;
    let v1 = null;
    if (r1 && a.balanced != null && a.ai.balanced != null) {
      if (a.balanced >= a.ai.balanced + 0.05 && a.balanced >= 0.55) v1 = '通过';
      else if (a.balanced < a.ai.balanced) v1 = '停止';
      else v1 = r1 === EVAL.S1[1] ? '停止' : '继续';
    }
    // S2：单向判法，比的是触发与未触发两组的发生率
    const b = test.S2;
    let r2 = null;
    for (const e of EVAL.S2) if (b.fired >= e.fired && b.rest >= e.rest) r2 = e;
    let v2 = null;
    if (r2 && b.diff != null) {
      if (b.diff >= S2_MARGIN) v2 = '通过';
      else if (b.diff <= 0) v2 = '停止';
      else v2 = r2 === EVAL.S2[1] ? '停止' : '继续';
    }
    return {
      spec: SPEC,
      S1: { test: a, lookback: look.S1, reached: r1, verdict: v1, next: EVAL.S1.find((e) => !(a.n >= e.n && a.pos >= e.each && a.neg >= e.each)) || null },
      S2: { test: b, lookback: look.S2, reached: r2, verdict: v2, next: EVAL.S2.find((e) => !(b.fired >= e.fired && b.rest >= e.rest)) || null },
    };
  }

  return { SPEC, ITEMS, EVAL, S2_MARGIN, votes, recVotes, tally, stats };
});
