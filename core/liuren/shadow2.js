/**
 * 奇门穿壬 · 影子追踪 v2（只记账，不投票，不进规则票，不改 AI 解读）。纯函数，无副作用。appliesTo: chuanren-exp
 *
 * 规格见 docs/SHADOW-liuren-v2.md（2026-11-16 冻结，kt 同日定）。六项：
 *   N1   天干融合：初传旬遁干 × 该干在奇门盘（转盘）的落宫环境；逐项记下各条件，再合成正、负、混、弃权
 *   N3   迟速融合：六壬迟速（书页 87）× 奇门迟速（用神宫旺衰，纲要·三节应期5）；单看、合看分开记
 *   S7-A 初传所合为成期、末传所冲为散期（书页 72）
 *   S7-B 现行规则 7 所用的「末传合」
 *   S7-F 首从发用（书页 71–72）：只记录，本版不判定
 *   S8-A 发用逢墓：失物「物在」、行人「人归」（书页 63）；物在不等于找回，人归不等于平安，分开标
 *
 * N1、N3 要用到奇门盘，案例里不存整张盘，所以起盘时算好存进记录（rec.shadow2）。
 * S7、S8-A 只用六壬层，旧案例可照存档的日柱、月将、占时重算（同 v1）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sanchuan.js'), require('./tiandipan.js'), require('./tuili.js'));
  else root.LiurenShadow2 = factory(root.LiurenSanChuan, root.LiurenTianDiPan, root.LiurenTuiLi);
})(typeof self !== 'undefined' ? self : this, function (SC, TDP, TL) {
  'use strict';

  const SPEC = { id: 'liuren-shadow-v2', frozenAt: '2026-11-16', cutoff: '2026-11-16T00:00:00.000Z' };

  const GAN = '甲乙丙丁戊己庚辛壬癸';
  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const GONG_WX = { 1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火' };
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const LIU_HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };

  /* ---------- N1 天干融合 ---------- */
  /** 六壬一侧：书页 64「论遁干」。乙丙利明、丁主动利暗、庚辛肃杀、癸主安静收藏。只取下列六干；癸记录不投 */
  const GAN_SIDE = { 乙: 1, 丙: 1, 丁: 1, 庚: -1, 辛: -1, 癸: 0 };
  /** 奇门门、星、神的吉凶分档：通行分法，本 app 所定，只作记录，不进投票（投票只用门之吉） */
  const MEN_CLASS = { 开: '吉', 休: '吉', 生: '吉', 伤: '凶', 死: '凶', 惊: '凶', 杜: '平', 景: '平' };
  const XING_CLASS = { 辅: '吉', 禽: '吉', 心: '吉', 任: '吉', 冲: '吉', 蓬: '凶', 芮: '凶', 柱: '凶', 英: '凶' };
  const SHEN_CLASS = { 值符: '吉', 太阴: '吉', 六合: '吉', 九天: '吉', 九地: '吉', 螣蛇: '凶', 腾蛇: '凶', 白虎: '凶', 玄武: '凶' };
  const classOf = (tbl, name) => { for (const ch of String(name || '').replace(/^天/, '')) if (tbl[ch]) return tbl[ch]; return ''; };

  function relOf(gongWx, ganWx) {
    if (!gongWx || !ganWx) return '';
    if (gongWx === ganWx) return '比和';
    if (SHENG[gongWx] === ganWx) return '宫生干';
    if (KE[gongWx] === ganWx) return '宫克干';
    if (SHENG[ganWx] === gongWx) return '干生宫';
    return '干克宫';
  }

  /** 两边同向才投票（同规则 8–10 的共同原则） */
  function agree(qm, lr) {
    if (qm && lr && qm === lr) return { vote: qm, verdict: qm > 0 ? '两边同吉' : '两边同凶' };
    if (qm && lr) return { vote: 0, verdict: '混' };
    return { vote: 0, verdict: '弃权' };
  }

  function n1(a) {
    const out = { vote: 0, verdict: '弃权', reason: '', gan: '', gong: '', lr: 0, qm: 0, parts: null };
    if (a.school !== 'zhuanpan') { out.reason = '飞盘本版不立'; return out; }
    const c1 = a.sc.chuan[0], dun = TDP.dunGan(a.riZhu);
    const gan = dun[c1];
    if (!gan) { out.reason = '初传旬空，无遁干'; return out; }
    out.gan = gan;
    if (!(gan in GAN_SIDE)) { out.reason = '遁干' + gan + '不在本条（只取乙丙丁庚辛癸）'; return out; }
    const ch = a.chart || {}, tp = ch.tianPan || {};
    const g = ['1', '2', '3', '4', '6', '7', '8', '9'].find((k) => String(tp[k] || '').includes(gan)) || '';
    if (!g) { out.reason = gan + '不在天盘八宫（寄中宫），落宫不定'; return out; }
    out.gong = g;
    const w = (a.ws && a.ws.gongs && a.ws.gongs[g]) || {};
    const ja = (ch.jiuGongAnalysis || {})[g] || {};
    const men = (ch.baMen || {})[g] || '', xing = (ch.jiuXing || {})[g] || '', shen = (ch.baShen || {})[g] || '';
    const ky = ja.keYing || null;
    const parts = {
      ruMu: String(w.ruMuDetail || '').includes('天盘' + gan),
      jiXing: String(w.jiXingDetail || '').includes('天盘' + gan),
      menPo: !!w.menPo, kong: !!w.kongWang,
      men, menClass: classOf(MEN_CLASS, men),
      xing, xingClass: classOf(XING_CLASS, xing),
      shen, shenClass: SHEN_CLASS[shen] || '',
      ge: ky ? ky.name || '' : '', geJX: ky ? ({ ji: '吉', xiong: '凶', ping: '平' })[ky.jiXiong] || '' : '',
      rel: relOf(GONG_WX[g], GAN_WX[gan]),
      ganState: w.tianGanState || '',
    };
    out.parts = parts;
    out.lr = GAN_SIDE[gan];
    const hurt = parts.ruMu || parts.jiXing || parts.menPo || parts.kong;
    out.qm = hurt ? -1 : parts.menClass === '吉' ? 1 : 0;
    if (!out.lr) { out.reason = '癸主安静收藏，原文不分成败，只记录'; return out; }
    const ag = agree(out.qm, out.lr);
    out.vote = ag.vote; out.verdict = ag.verdict;
    if (!ag.vote) out.reason = ag.verdict === '混' ? '两边相反，记混' : '奇门一侧不定（无四害而非吉门）';
    return out;
  }

  /* ---------- N3 迟速融合 ---------- */
  /** 奇门迟速：照 Qimen-pwa knowledge/timing-rules.json 的 pace.map（test/shadow2.test.js 核对两份一致） */
  const PACE = { 旺: '速', 相: '速', 休: '常', 囚: '迟', 死: '迟' };
  function n3(a) {
    const dun = TDP.dunGan(a.riZhu), kong = new Set(a.xunKong || []);
    const cs = TL.chiSu({ sc: a.sc, riGan: a.riZhu[0], riZhi: a.riZhu[1], dun, kong });
    const lr = cs.su.length > cs.chi.length ? '速' : cs.chi.length > cs.su.length ? '迟' : '';
    const Y = a.Y ? String(a.Y) : '';
    const state = Y ? (((a.ws || {}).gongs || {})[Y] || {}).gongState || '' : '';
    const qm = PACE[state] || '';
    const fused = lr && (qm === '速' || qm === '迟') && lr === qm ? lr : '';
    return { lr, su: cs.su, chi: cs.chi, qm, gong: Y, state, fused,
      relation: !lr || !(qm === '速' || qm === '迟') ? '有一边不定' : lr === qm ? '一致' : '相反' };
  }

  /* ---------- S7、S8-A（只用六壬层） ---------- */
  function liurenPart(p) {
    const riGan = p.riZhu[0], riZhi = p.riZhu[1];
    const sc = p.sc || SC.compute({ riGan, riZhi, yueJiang: p.yueJiang, shiZhi: p.shiZhi });
    const [c1, , c3] = sc.chuan, dun = TDP.dunGan(p.riZhu);
    const cheng = LIU_HE[c1], san = CHONG[c3];
    const sf = TL.shouFa({ sc, riGan, riZhi, yueZhi: p.yueZhi || '', taiSui: p.taiSui || '', dun });
    const s8dom = p.domain === 'lost_item' || p.domain === 'traveler' ? p.domain : '';
    return {
      S7A: { cheng, san, picks: [...new Set([cheng, san])] },
      S7B: { picks: [LIU_HE[c3]] },
      S7F: { kinds: sf.kinds, d: sf.d, c1, toXunEnd: 9 - GAN.indexOf(riGan) },
      S8A: { domain: s8dom, c1, stage: TL.stage(riGan, c1), fired: !!s8dom && TL.stage(riGan, c1) === '墓' },
    };
  }

  /**
   * 起盘时算好、存进记录。
   * @param a { school, chart, ws, sc, riZhu, xunKong, Y, domain, yueZhi, taiSui }
   */
  function evaluate(a) {
    const lp = liurenPart({ sc: a.sc, riZhu: a.riZhu, yueZhi: a.yueZhi, taiSui: a.taiSui, domain: a.domain });
    return Object.assign({ v: SPEC.id, N1: n1(a), N3: n3(a) }, lp);
  }

  /** 案例的占类键。较早的案例只存了界面占类名（input.ui），S8-A 用到的两类按名补上 */
  const UI_DOMAIN = { 失物: 'lost_item', 行人: 'traveler' };
  const domainOf = (rec) => ((rec && rec.input) || {}).domain || UI_DOMAIN[((rec && rec.input) || {}).ui] || '';

  /** 旧案例：S7、S8-A 照存档重算；N1、N3 只认起盘时存下的 */
  function recShadow(rec) {
    if (rec.shadow2 && rec.shadow2.v === SPEC.id) return rec.shadow2;
    const sz = (rec.chart && rec.chart.siZhu) || {}, lr = rec.liuren || {};
    if (!sz.day || !sz.time || !lr.yueJiang) return null;
    try {
      return liurenPart({ riZhu: sz.day, yueJiang: lr.yueJiang, shiZhi: sz.time[1], yueZhi: sz.month ? sz.month[1] : '',
        taiSui: sz.year ? sz.year[1] : '', domain: domainOf(rec) });
    } catch (e) { return null; }
  }

  /* ---------- 计分 ---------- */
  const DAY = 864e5;
  const ymd = (s) => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; };
  /** 起盘到实际应期相隔几天；缺日期或应期早于起盘返回 null */
  function lagOf(rec) {
    const a = ymd((rec.input || {}).date), b = ymd((rec.feedback || {}).actualDate);
    if (a == null || b == null || b < a) return null;
    return Math.round((b - a) / DAY);
  }
  /** 一致性 C：随手取一题判「速」、一题判「迟」，前者实际来得早的机会（同天算一半）。瞎猜＝0.5 */
  function concord(fast, slow) {
    if (!fast.length || !slow.length) return null;
    let s = 0;
    for (const x of fast) for (const y of slow) s += x < y ? 1 : x === y ? 0.5 : 0;
    return s / (fast.length * slow.length);
  }
  const median = (xs) => { if (!xs.length) return null; const a = xs.slice().sort((p, q) => p - q), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  /** 命中数至少为 k 的机会（各题瞎猜概率不同，用逐题递推） */
  function pAtLeast(ps, k) {
    let dp = [1];
    for (const p of ps) {
      const nx = new Array(dp.length + 1).fill(0);
      dp.forEach((v, i) => { nx[i] += v * (1 - p); nx[i + 1] += v * p; });
      dp = nx;
    }
    return dp.slice(k).reduce((s, v) => s + v, 0);
  }
  /** 应期法命中：rows [{picks, zhi}] */
  function hitStats(rows) {
    const ps = rows.map((r) => r.picks.length / 12);
    const hit = rows.filter((r) => r.picks.includes(r.zhi)).length;
    const expect = ps.reduce((s, v) => s + v, 0);
    return { n: rows.length, hit, expect: +expect.toFixed(2), ratio: expect ? +(hit / expect).toFixed(2) : null, p: rows.length ? +pAtLeast(ps, hit).toFixed(4) : null };
  }

  const EVAL2 = [{ n: 40, each: 10, label: '第一次评估' }, { n: 100, each: 25, label: '第二次（最后一次）评估' }];
  const EVAL_SPEED = [{ each: 10, label: '第一次评估' }, { each: 25, label: '第二次（最后一次）评估' }];
  const EVAL_DAY = [{ n: 40, label: '第一次评估' }, { n: 100, label: '第二次（最后一次）评估' }];
  const EVAL_S8 = [{ fired: 10, rest: 30, label: '第一次评估' }, { fired: 25, rest: 75, label: '第二次（最后一次）评估' }];
  const S8_MARGIN = 0.15;
  const RUYUAN_RULES = [1, 2, 3, 4, 6, 9, 10];

  function twoSided(a, ai) {
    let r = null;
    for (const e of EVAL2) if (a.n >= e.n && a.pos >= e.each && a.neg >= e.each) r = e;
    let v = null;
    if (r && a.balanced != null && ai.balanced != null) {
      if (a.balanced >= ai.balanced + 0.05 && a.balanced >= 0.55) v = '通过';
      else if (a.balanced < ai.balanced) v = '停止';
      else v = r === EVAL2[1] ? '停止' : '继续';
    }
    return { reached: r, verdict: v, next: EVAL2.find((e) => !(a.n >= e.n && a.pos >= e.each && a.neg >= e.each)) || null };
  }
  const countBy = (xs) => xs.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});

  /**
   * @param records 案例本全部记录
   * @param CB      core/casebook.js
   * @param SH1     core/liuren/shadow.js（影子 v1，组合实验要用 S1、S3 的票；可不给）
   */
  function stats(records, CB, SH1) {
    const done = CB.dedupe((records || []).filter((r) => r && r.feedback && r.feedback.archived));
    const isTest = (r) => String(r.createdAt || '') >= SPEC.cutoff;
    const part = (pool) => one(pool, CB, SH1);
    return { spec: SPEC, test: part(done.filter(isTest)), lookback: part(done.filter((r) => !isTest(r))) };
  }

  function one(pool, CB, SH1) {
    const withS = pool.map((r) => ({ r, s: recShadow(r) })).filter((x) => x.s);
    const out = {};

    // N1：对「如愿」；逐项记下各条件单看的成绩（描述，不判定）
    {
      const elig = withS.filter((x) => x.s.N1 && CB.outcome(x.r) !== null);
      const voted = elig.filter((x) => x.s.N1.vote !== 0);
      const s = CB.score(voted.map((x) => ({ pred: x.s.N1.vote > 0, truth: CB.outcome(x.r) })));
      const ai = CB.score(voted.filter((x) => CB.aiPred(x.r) !== null).map((x) => ({ pred: CB.aiPred(x.r), truth: CB.outcome(x.r) })));
      const withP = elig.filter((x) => x.s.N1.parts);
      const fac = (name, f) => {
        const rows = withP.map((x) => ({ p: f(x.s.N1), truth: CB.outcome(x.r) })).filter((x) => x.p != null).map((x) => ({ pred: x.p, truth: x.truth }));
        return Object.assign({ name }, CB.score(rows));
      };
      const factors = [
        fac('干性（乙丙丁记吉，庚辛记凶）', (v) => (v.lr ? v.lr > 0 : null)),
        fac('奇门侧（无四害且吉门记吉，有四害记凶）', (v) => (v.qm ? v.qm > 0 : null)),
        fac('有无四害（无记吉）', (v) => !(v.parts.ruMu || v.parts.jiXing || v.parts.menPo || v.parts.kong)),
        fac('门（吉门记吉，凶门记凶）', (v) => (v.parts.menClass === '吉' ? true : v.parts.menClass === '凶' ? false : null)),
        fac('星（吉星记吉，凶星记凶）', (v) => (v.parts.xingClass === '吉' ? true : v.parts.xingClass === '凶' ? false : null)),
        fac('神（吉神记吉，凶神记凶）', (v) => (v.parts.shenClass === '吉' ? true : v.parts.shenClass === '凶' ? false : null)),
        fac('格（引擎吉格记吉，凶格记凶）', (v) => (v.parts.geJX === '吉' ? true : v.parts.geJX === '凶' ? false : null)),
        fac('宫对干（生、比和记吉，克记凶）', (v) => (v.parts.rel === '宫生干' || v.parts.rel === '比和' ? true : v.parts.rel === '宫克干' ? false : null)),
      ];
      out.N1 = Object.assign({ eligible: elig.length, abstain: countBy(elig.filter((x) => x.s.N1.vote === 0).map((x) => x.s.N1.reason || x.s.N1.verdict)),
        ai, factors }, s, twoSided(s, ai));
    }

    // N3：对「起盘到应期相隔天数」
    {
      const rows = withS.filter((x) => x.s.N3).map((x) => ({ n3: x.s.N3, lag: lagOf(x.r) })).filter((x) => x.lag != null);
      const pred = (k) => {
        const fast = rows.filter((x) => x.n3[k] === '速').map((x) => x.lag), slow = rows.filter((x) => x.n3[k] === '迟').map((x) => x.lag);
        return { fast: fast.length, slow: slow.length, abstain: rows.length - fast.length - slow.length, c: concord(fast, slow), medFast: median(fast), medSlow: median(slow) };
      };
      const lr = pred('lr'), qm = pred('qm'), fused = pred('fused');
      let reached = null;
      for (const e of EVAL_SPEED) if (fused.fast >= e.each && fused.slow >= e.each) reached = e;
      let verdict = null;
      if (reached && fused.c != null) {
        const best = Math.max(lr.c == null ? 0 : lr.c, qm.c == null ? 0 : qm.c);
        if (fused.c >= 0.6 && fused.c >= best + 0.05) verdict = '通过';
        else if (fused.c <= 0.5 || fused.c < best) verdict = '停止';
        else verdict = reached === EVAL_SPEED[1] ? '停止' : '继续';
      }
      out.N3 = { n: rows.length, lr, qm, fused, reached, verdict, relation: countBy(rows.map((x) => x.n3.relation)),
        next: EVAL_SPEED.find((e) => !(fused.fast >= e.each && fused.slow >= e.each)) || null };
    }

    // S7：对「实际应期日支」；与现行规则 7 同批题并列，含组合
    {
      const rows = withS.filter((x) => x.r.feedback.actualDayZhi).map((x) => {
        const v7 = (x.r.votes || []).find((v) => v.rule === 7 && v.method === 'qimen-first' && v.picks && v.picks.length);
        return { x, zhi: x.r.feedback.actualDayZhi, r7: v7 ? v7.picks : null, lag: lagOf(x.r) };
      });
      const st = (f) => hitStats(rows.map((y) => ({ picks: f(y), zhi: y.zhi })).filter((y) => y.picks && y.picks.length));
      const uni = (...arrs) => { if (arrs.some((a) => !a)) return null; return [...new Set([].concat(...arrs))]; };
      const A = st((y) => y.x.s.S7A.picks), B = st((y) => y.x.s.S7B.picks);
      const judge = (h) => {
        let reached = null;
        for (const e of EVAL_DAY) if (h.n >= e.n) reached = e;
        let verdict = null;
        if (reached) {
          if (h.ratio >= 1.5 && h.p < 0.05) verdict = '通过';
          else if (h.hit <= h.expect) verdict = '停止';
          else verdict = reached === EVAL_DAY[1] ? '停止' : '继续';
        }
        return { reached, verdict, next: EVAL_DAY.find((e) => h.n < e.n) || null };
      };
      // S7-F：只记录。可核的几种：本日、当时（当天）、日枝推（第 d 天）、旬首（本旬之内）
      const f = { 日: { n: 0, hit: 0 }, 时: { n: 0, hit: 0 }, 日枝推: { n: 0, hit: 0 }, 旬: { n: 0, hit: 0 }, 其余: 0, 不取: 0 };
      for (const y of rows) {
        const F = y.x.s.S7F;
        if (y.lag == null) continue;
        let any = false;
        for (const k of ['日', '时', '旬']) if (F.kinds.includes(k)) { any = true; f[k].n++; if (k === '旬' ? y.lag <= F.toXunEnd : y.lag === 0) f[k].hit++; }
        if (!F.kinds.length && F.d) { any = true; f.日枝推.n++; if (y.lag === F.d) f.日枝推.hit++; }
        if (!any) { if (F.kinds.length) f.其余++; else f.不取++; }
      }
      out.S7 = {
        A: Object.assign(A, judge(A), {
          cheng: hitStats(rows.map((y) => ({ picks: [y.x.s.S7A.cheng], zhi: y.zhi }))),
          san: hitStats(rows.map((y) => ({ picks: [y.x.s.S7A.san], zhi: y.zhi }))) }),
        B: Object.assign(B, judge(B)),
        F: f,
        // 另列（描述，不判定）：起盘当天就应验的除外——射覆、问今天的事，应期栏常被填成起盘当天
        notSameDay: (() => {
          const R = rows.filter((y) => y.lag != null && y.lag >= 1);
          const g = (fn) => hitStats(R.map((y) => ({ picks: fn(y), zhi: y.zhi })).filter((y) => y.picks && y.picks.length));
          return { A: g((y) => y.x.s.S7A.picks), B: g((y) => y.x.s.S7B.picks), r7: g((y) => y.r7) };
        })(),
        combos: {
          r7: st((y) => y.r7),
          r7A: st((y) => uni(y.r7, y.x.s.S7A.picks)),
          r7B: st((y) => uni(y.r7, y.x.s.S7B.picks)),
          all: st((y) => uni(y.r7, y.x.s.S7A.picks, y.x.s.S7B.picks)),
        },
      };
    }

    // S8-A：失物、行人分开，不合在一起凑题数
    {
      const res = {};
      for (const [dom, key, sec] of [['lost_item', 'wuZai', 'zhaoHui'], ['traveler', 'renGui', 'pingAn']]) {
        const rows = withS.filter((x) => x.s.S8A && x.s.S8A.domain === dom);
        const lab = (x, k) => { const v = ((x.r.feedback || {}).s8 || {})[k]; return v === 'yes' ? true : v === 'no' ? false : null; };
        const L = rows.filter((x) => lab(x, key) !== null);
        const fired = L.filter((x) => x.s.S8A.fired).map((x) => lab(x, key)), rest = L.filter((x) => !x.s.S8A.fired).map((x) => lab(x, key));
        const rate = (a) => (a.length ? a.filter(Boolean).length / a.length : null);
        const rf = rate(fired), rr = rate(rest), diff = rf != null && rr != null ? rf - rr : null;
        let reached = null;
        for (const e of EVAL_S8) if (fired.length >= e.fired && rest.length >= e.rest) reached = e;
        let verdict = null;
        if (reached && diff != null) verdict = diff >= S8_MARGIN ? '通过' : diff <= 0 ? '停止' : reached === EVAL_S8[1] ? '停止' : '继续';
        const S = rows.filter((x) => lab(x, sec) !== null);
        const r8 = rows.map((x) => ({ v: (x.r.votes || []).find((v) => v.rule === 8), h: CB.happened(x.r) }))
          .filter((y) => y.v && y.v.applicable && y.v.vote && y.h !== null);
        res[dom] = { total: rows.length, labeled: L.length, fired: fired.length, rest: rest.length, firedRate: rf, restRate: rr, diff, reached, verdict,
          next: EVAL_S8.find((e) => !(fired.length >= e.fired && rest.length >= e.rest)) || null,
          secondary: { key: sec, firedRate: rate(S.filter((x) => x.s.S8A.fired).map((x) => lab(x, sec))), restRate: rate(S.filter((x) => !x.s.S8A.fired).map((x) => lab(x, sec))), n: S.length },
          rule8: CB.score(r8.map((y) => ({ pred: y.v.vote > 0, truth: y.h }))) };
      }
      out.S8A = res;
    }

    // 组合实验与重复证据（对「如愿」的几路，同一批题）
    {
      const yn = withS.filter((x) => CB.outcome(x.r) !== null);
      const he = (r) => { const s = RUYUAN_RULES.reduce((t, k) => { const v = (r.votes || []).find((x) => x.rule === k); return t + (v && v.applicable ? v.vote || 0 : 0); }, 0); return Math.sign(s); };
      const v1 = (r) => (SH1 ? SH1.recVotes(r) : null);
      const items = {
        合票: (x) => he(x.r),
        N1: (x) => (x.s.N1 ? x.s.N1.vote : 0),
        S1: (x) => { const v = v1(x.r); return v ? v.S1.vote : 0; },
        S3: (x) => { const v = v1(x.r); return v ? v.S3.vote : 0; },
      };
      const sum = (ks) => (x) => Math.sign(ks.reduce((t, k) => t + items[k](x), 0));
      const run = (f) => {
        const rows = yn.map((x) => ({ v: f(x), truth: CB.outcome(x.r) }));
        const voted = rows.filter((y) => y.v !== 0);
        const s = CB.score(voted.map((y) => ({ pred: y.v > 0, truth: y.truth })));
        const right = voted.filter((y) => (y.v > 0) === y.truth).length;
        return Object.assign(s, { all: rows.length, coverage: rows.length ? voted.length / rows.length : null,
          adjusted: rows.length ? (right + 0.5 * (rows.length - voted.length)) / rows.length : null });
      };
      const pair = (a, b) => {
        const both = yn.filter((x) => items[a](x) !== 0 && items[b](x) !== 0);
        return { a, b, both: both.length, same: both.length ? both.filter((x) => items[a](x) === items[b](x)).length / both.length : null };
      };
      // N1 用初传遁干，S2 看初传旬空：初传空则无遁干，两条结构上不会同题出票
      const n1s2 = withS.filter((x) => x.s.N1 && x.s.N1.vote !== 0 && SH1 && (SH1.recVotes(x.r) || { S2: {} }).S2.fired).length;
      out.combo = {
        n: yn.length,
        rows: [['现行合票（规则 1、2、3、4、6、9、10 票数相加取正负）', run(items.合票)],
          ['现行合票 ＋ N1', run(sum(['合票', 'N1']))],
          ['现行合票 ＋ N1 ＋ 影子 v1 的 S1、S3', run(sum(['合票', 'N1', 'S1', 'S3']))],
          ['N1 单独', run(items.N1)]],
        pairs: [pair('合票', 'N1'), pair('N1', 'S1'), pair('N1', 'S3'), pair('S1', 'S3')],
        n1s2,
      };
    }
    return out;
  }

  return { SPEC, GAN_SIDE, MEN_CLASS, XING_CLASS, SHEN_CLASS, PACE, S8_MARGIN, EVAL2, EVAL_SPEED, EVAL_DAY, EVAL_S8, RUYUAN_RULES,
    evaluate, recShadow, liurenPart, domainOf, lagOf, concord, pAtLeast, hitStats, stats };
});
