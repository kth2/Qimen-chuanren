/**
 * 奇门穿壬 · 六壬判法影子追踪 v1（只记账，不投票，不进规则票）。纯函数，无副作用。appliesTo: chuanren-exp
 *
 * 规格见 docs/SHADOW-liuren-v1.md（2026-11-10 冻结）。这里只做两件事：
 *   ① 照规格给一张盘记下三条判法各自的预测；
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
    { id: 'S3', name: '类神九处（探原取法）', src: '探原 66、75',
      yuan: '惟必须发见于课、传、年、命之中，旺相不空，而又与日辰德合相生，始可言……所谋皆通。若刑克日、辰、年、命，虽入课传，终归失败。若不入课传，谓之类在闲地，如值休囚空亡，谓之无类，所占更少结果。',
      rule: '类神见于四课、三传、行年、本命九处，旺相不空，且生日干或合日干日枝或为日德枝德 → 记「如愿」；不见、休囚、空亡、或刑克日干日枝 → 记「不如愿」；其余不投票',
      truth: '如愿／不如愿（同各规则）', kind: 'two-sided' },
  ];
  /**
   * S3 的类神（探原 66「论阴神」所列各占所视之将；婚姻另照探原 75「以官杀、六合为男，财星、天后为女」）。
   * 只取求谋一类的占：见类神为所谋可通。疾病视白虎、词讼视勾陈、盗窃视玄武等，类神现未必是如愿，不立。
   * 键为案例本所存的占类名。
   */
  const S3_LEI = {
    事业: { jiang: ['贵人', '青龙'], note: '贵人（谒贵升迁）、青龙（官爵）' },
    财运: { jiang: ['青龙'], note: '青龙（财利）' },
    股市: { jiang: ['青龙'], note: '青龙（财利）' },
    学业: { jiang: ['朱雀'], note: '朱雀（考选文书）' },
    怀孕: { jiang: ['六合'], note: '六合（子孙）' },
    婚姻: { byXingBie: { 男: { jiang: ['天后'], qin: '财', note: '男占：财星、天后为女' }, 女: { jiang: ['六合'], qin: '官', note: '女占：官杀、六合为男' } },
      jiang: ['六合'], note: '六合（婚姻；未给性别）' },
  };
  /** 评估点（只看两次）。S1 按投票题数；S2 按触发题数与未触发题数。 */
  const EVAL = {
    S1: [{ n: 40, each: 10, label: '第一次评估' }, { n: 100, each: 25, label: '第二次（最后一次）评估' }],
    S3: [{ n: 40, each: 10, label: '第一次评估' }, { n: 100, each: 25, label: '第二次（最后一次）评估' }],
    S2: [{ fired: 10, rest: 30, label: '第一次评估' }, { fired: 25, rest: 75, label: '第二次（最后一次）评估' }],
  };
  /** S2 通过门槛：未触发组的发生率减触发组的发生率，至少 15 个百分点 */
  const S2_MARGIN = 0.15;

  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const ZHI_WX = { 子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土' };
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

  const JI_GONG = { 甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳', 己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑' };
  const LIU_HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const XING = { 子: '卯', 卯: '子', 寅: '巳', 巳: '申', 申: '寅', 丑: '戌', 戌: '未', 未: '丑', 辰: '辰', 午: '午', 酉: '酉', 亥: '亥' };
  const RI_DE = { 甲: '寅', 己: '寅', 乙: '申', 庚: '申', 丙: '戌', 辛: '戌', 戊: '巳', 癸: '巳', 丁: '亥', 壬: '亥' };
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  /** 月令旺相（当令为旺，令生为相） */
  const wangXiang = (z, yueZhi) => ZHI_WX[z] === ZHI_WX[yueZhi] || SHENG[ZHI_WX[yueZhi]] === ZHI_WX[z];

  /**
   * S3：类神九处。
   * @param p { riZhu, yueJiang, shiZhi, xunKong, yueZhi, ui, xingBie, nianMing, xingNian }
   * @returns { vote: +1|-1|0, lei: [{ zhi, name, state }], note } ；占类不在表内或缺月支则 vote 0、lei 空
   */
  function leiShen(p, sc) {
    const T = S3_LEI[p.ui];
    if (!T || !p.yueZhi) return { vote: 0, lei: [], note: T ? '缺月支' : '本占类不立类神' };
    const L = (T.byXingBie && T.byXingBie[p.xingBie]) || T;
    const ln = sc.liuren, riGan = p.riZhu[0], riZhi = p.riZhu[1], me = GAN_WX[riGan];
    const kong = p.xunKong || [];
    const nine = [...sc.ke.map((k) => k.shang), ...sc.chuan];
    const xn = String(p.xingNian || '')[1], nm = String(p.nianMing || '')[1];
    if (xn && ZHI.includes(xn)) nine.push(ln.tianOver(xn));
    if (nm && ZHI.includes(nm)) nine.push(ln.tianOver(nm));
    const cand = [];
    for (const j of L.jiang) { const z = [...ZHI].find((x) => ln.jiangOf(x) === j); if (z) cand.push({ zhi: z, name: j }); }
    if (L.qin) {
      // 财星＝日干所克之五行；官杀＝克日干之五行。六亲之类只在九处里找，找不到即不现
      const want = L.qin === '财' ? KE[me] : Object.keys(KE).find((w) => KE[w] === me);
      const zs = [...new Set(nine.filter((z) => ZHI_WX[z] === want))];
      if (zs.length) zs.forEach((z) => cand.push({ zhi: z, name: L.qin === '财' ? '财星' : '官杀' }));
      else cand.push({ zhi: '', name: L.qin === '财' ? '财星' : '官杀' });
    }
    for (const c of cand) {
      const z = c.zhi;
      if (!z || !nine.includes(z)) { c.state = '闲地'; c.v = -1; continue; }
      if (kong.includes(z)) { c.state = '空亡'; c.v = -1; continue; }
      if (!wangXiang(z, p.yueZhi)) { c.state = '休囚'; c.v = -1; continue; }
      const w = ZHI_WX[z];
      if (KE[w] === me || KE[w] === ZHI_WX[riZhi] || (XING[z] === riZhi && z !== riZhi)) { c.state = '刑克日辰'; c.v = -1; continue; }
      if (SHENG[w] === me || LIU_HE[z] === JI_GONG[riGan] || LIU_HE[z] === riZhi || z === RI_DE[riGan] || z === ZHI[(ZHI.indexOf(riZhi) + 5) % 12]) { c.state = '现而德合相生'; c.v = 1; continue; }
      c.state = '现而无生合'; c.v = 0;
    }
    // 多个类神：有一个可通即记如愿；全都不成才记不如愿；其余不投票
    const vote = cand.some((c) => c.v === 1) ? 1 : cand.length && cand.every((c) => c.v === -1) ? -1 : 0;
    return { vote, lei: cand.map((c) => ({ zhi: c.zhi, name: c.name, state: c.state })), note: L.note };
  }

  /**
   * 一张盘的三条影子预测。
   * @param p { riZhu, yueJiang, shiZhi, xunKong, yueZhi?, ui?, xingBie?, nianMing?, xingNian? }
   * @returns { S1: { vote: +1|-1|0, shang, rel }, S2: { fired: bool, c1 }, S3: { vote, lei, note } }
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
      S3: leiShen(p, sc),
    };
  }

  /** 旧案例：照存档的日柱、月将、占时重算。缺项返回 null */
  function recVotes(rec) {
    const sz = (rec.chart && rec.chart.siZhu) || {}, lr = rec.liuren || {};
    if (!sz.day || !sz.time || !lr.yueJiang) return null;
    const inp = rec.input || {};
    try {
      return votes({ riZhu: sz.day, yueJiang: lr.yueJiang, shiZhi: sz.time[1], xunKong: lr.xunKong,
        yueZhi: sz.month ? sz.month[1] : '', ui: inp.ui || '', xingBie: inp.xingBie || '', nianMing: inp.nianMing || '', xingNian: inp.xingNian || '' });
    }
    catch (e) { return null; }
  }

  const rate = (a) => (a.length ? a.filter(Boolean).length / a.length : null);

  /** 一组记录上的两条计分（不含判定） */
  function tally(recs, CB) {
    const rows1 = [], fired = [], rest = [], ai = [], rows3 = [], ai3 = [];
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
      if (o !== null && v.S3.vote !== 0) {
        rows3.push({ pred: v.S3.vote > 0, truth: o });
        const a3 = CB.aiPred(r);
        if (a3 !== null) ai3.push({ pred: a3, truth: o });
      }
    }
    const s1 = CB.score(rows1), aiS = CB.score(ai), s3 = CB.score(rows3);
    const rf = rate(fired), rr = rate(rest);
    return {
      S1: Object.assign(s1, { ai: aiS }),
      S3: Object.assign(s3, { ai: CB.score(ai3) }),
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

    // S1、S3：判定照各规则的同一套（比同批 AI 结论高 5 点且不低于 55% 为通过；低于 AI 为停止）
    const twoSided = (a, ev) => {
      let r = null;
      for (const e of ev) if (a.n >= e.n && a.pos >= e.each && a.neg >= e.each) r = e;
      let v = null;
      if (r && a.balanced != null && a.ai.balanced != null) {
        if (a.balanced >= a.ai.balanced + 0.05 && a.balanced >= 0.55) v = '通过';
        else if (a.balanced < a.ai.balanced) v = '停止';
        else v = r === ev[1] ? '停止' : '继续';
      }
      return { reached: r, verdict: v, next: ev.find((e) => !(a.n >= e.n && a.pos >= e.each && a.neg >= e.each)) || null };
    };
    const a = test.S1, j1 = twoSided(a, EVAL.S1), r1 = j1.reached, v1 = j1.verdict;
    const j3 = twoSided(test.S3, EVAL.S3);
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
      S3: Object.assign({ test: test.S3, lookback: look.S3 }, j3),
      S2: { test: b, lookback: look.S2, reached: r2, verdict: v2, next: EVAL.S2.find((e) => !(b.fired >= e.fired && b.rest >= e.rest)) || null },
    };
  }

  return { SPEC, ITEMS, EVAL, S2_MARGIN, S3_LEI, votes, recVotes, tally, stats };
});
