/**
 * 奇门穿壬 · 复盘心得提示（只显示、不投票、不进规则账本）。纯函数，无副作用。appliesTo: chuanren-exp
 *
 * 起新盘时，从已做过 AI 复盘的旧案例里，找六壬盘象相近的几例，把当时的复盘心得列出来，供对照学习。
 * 只比六壬层与占类（旧案例存了日柱、月将、占时，三传可原样重算；奇门盘这里不重排）。
 *
 * 纪律（照方法登记总表「单例对错只记录，不改状态」）：
 *   · 这里列的是单个案例的事后总结，不是规则，也没有检验过；界面上要这样标明。
 *   · 相近只按下面列出的几项盘象逐项比，命中哪几项就原样列出，不另加权重以外的判断。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sanchuan.js'), require('./tiandipan.js'), require('./xiangyi.js'));
  else root.LiurenXinDe = factory(root.LiurenSanChuan, root.LiurenTianDiPan, root.LiurenXiangYi);
})(typeof self !== 'undefined' ? self : this, function (SC, TDP, XY) {
  'use strict';

  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const ZHI_WX = { 子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土' };
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  // 课体：常见的贼克诸课不单列（太普通，比了等于没比）
  const RARE_KETI = /伏吟|返吟|八专|别责|昴星|遥克|涉害/;

  /** 每项盘象的权重：越少见、复盘里越常被点名的越重 */
  const WEIGHT = { ui: 1, keti: 1.5, c1kong: 2, c3kong: 1.5, c1jiang: 1, c1lq: 1, gan: 1, guiCK: 2 };
  const THRESHOLD = 3;   // 合计不到 3 的不列
  const MAX = 3;         // 最多列 3 例

  /**
   * 一张盘的六壬盘象。
   * @param p { riZhu, yueJiang, shiZhi, xunKong, ui, gui }  gui＝规则 7 的贵人冲空（有则为真）
   * @returns [{ k, w, label }]
   */
  function features(p) {
    const riGan = p.riZhu[0], riZhi = p.riZhu[1];
    const sc = SC.compute({ riGan, riZhi, yueJiang: p.yueJiang, shiZhi: p.shiZhi });
    const ln = sc.liuren;
    const kong = new Set(p.xunKong || []);
    const [c1, , c3] = sc.chuan;
    const out = [];
    const add = (k, label) => out.push({ k, w: WEIGHT[k.split(':')[0]], label });
    if (p.ui) add('ui:' + p.ui, `同占类「${p.ui}」`);
    if (RARE_KETI.test(sc.name)) add('keti:' + sc.name.replace(/（.*）/, ''), `课体同为${sc.name.replace(/（.*）/, '')}`);
    if (kong.has(c1)) add('c1kong', '初传落旬空');
    if (kong.has(c3)) add('c3kong', '末传落旬空');
    const j1 = ln.jiangOf(c1);
    add('c1jiang:' + j1, `初传乘${j1}`);
    const lq = XY.read(j1, c1, riGan).liuQin;
    add('c1lq:' + lq, `初传为${lq}`);
    const me = GAN_WX[riGan], g = ZHI_WX[sc.ke[0].shang];
    const rel = KE[g] === me ? '干上神克干' : SHENG[g] === me ? '干上神生干' : SHENG[me] === g ? '干生上神' : KE[me] === g ? '干克上神' : '';
    if (rel) add('gan:' + rel, rel);
    if (p.gui) add('guiCK', '贵人冲奇门空亡宫');
    return out;
  }

  /** 旧案例的盘象：照存档的日柱、月将、占时重算（与新盘同一算法） */
  function recFeatures(rec) {
    const sz = (rec.chart && rec.chart.siZhu) || {}, lr = rec.liuren || {};
    if (!sz.day || !sz.time || !lr.yueJiang) return null;
    const v7 = (rec.votes || []).find((v) => v.rule === 7);
    try {
      return features({ riZhu: sz.day, yueJiang: lr.yueJiang, shiZhi: sz.time[1], xunKong: lr.xunKong, ui: rec.input && rec.input.ui, gui: !!(v7 && v7.gui) });
    } catch (e) { return null; }
  }

  /** 复盘里点名的六壬条目（规则 7、六壬推理、贵人、旬空、四课三传） */
  const LR_ITEM = /^(tl-|xk$|gui$|sc$|ke$|r7$|r8$|r9$|r10$)/;
  function lrNotes(review) {
    return [...(review.misweighted || []), ...(review.misreads || [])]
      .filter((m) => m && LR_ITEM.test(m.itemId || ''))
      .map((m) => ({ itemId: m.itemId, how: m.how || 'misread', why: m.why || m.what || '' }));
  }

  /**
   * 找相近的旧案例。
   * @param cur     features() 的结果
   * @param records 案例本全部记录
   * @param opts    { excludeId }
   * @returns [{ rec, score, shared: [label], notes: [...] }] 按分数、再按新旧排
   */
  function match(cur, records, opts) {
    const ex = (opts && opts.excludeId) || null;
    const curK = new Map(cur.map((f) => [f.k, f]));
    const out = [];
    for (const rec of records || []) {
      if (!rec || rec.id === ex) continue;
      const rv = rec.review;
      if (!rv || !rv.lesson) continue;
      const f = recFeatures(rec);
      if (!f) continue;
      const shared = f.filter((x) => curK.has(x.k));
      const score = shared.reduce((s, x) => s + x.w, 0);
      // 只同占类、别的都不同，不算相近
      if (score < THRESHOLD || shared.every((x) => x.k.startsWith('ui:'))) continue;
      out.push({ rec, score, shared: shared.map((x) => x.label), notes: lrNotes(rv) });
    }
    out.sort((a, b) => b.score - a.score || String(b.rec.createdAt).localeCompare(String(a.rec.createdAt)));
    return out.slice(0, MAX);
  }

  return { WEIGHT, THRESHOLD, MAX, features, recFeatures, match, lrNotes };
});
