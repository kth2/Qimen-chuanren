/**
 * 奇门穿壬 · 第二层：四课与三传（九宗门）。纯函数，无副作用。
 *
 * 出处：伍剑虹《大六壬精义讲解》第一章第三至五节（四课、三传、九大格局）及第二章问答
 *   （比用与涉害、伏吟两说）。《大六壬探原》推演篇原文仍未取得。
 *
 * 两处须选法（见 opts）：
 *   · 涉害：'shenqian'（默认）＝涉害深浅：被克之神从所临地盘位顺行回本家，数沿途受几重克
 *     （地盘支与寄宫天干都算），深者为用；同深则临孟（见机）、再临仲（察微），再同则刚日取日上、
 *     柔日取辰上。伍剑虹书中引《六壬大全》此法并举例（丁卯日亥、丑同下贼上，取克深之亥）；
 *     《探原》凡例亦主深浅、批评只论孟仲之法。
 *     'mengzhong'＝伍剑虹自用之法：只看所临孟仲季，孟先于仲，季不取，复等刚日取干上、柔日取支上。
 *   · 伏吟壬辰、壬午两日：'verse'（默认）＝书中口诀「壬辰壬午亥巳申」；'zhinan'＝书中所引
 *     《大六壬指南》通则（初自刑则中用支，中自刑则末取冲），得亥辰戌／亥午子。
 * 其余照书：
 *   · 返吟有克：照常法取克为初，中末取上神（返吟时即冲神）。王雷之《实占百例》例70、75、83、
 *     95、98–100 均如此；书中「中刑为末」一句与这些实例不合，不采。
 *   · 返吟无克：驿马发用，中取支上神，末取干上神。
 *   · 昴星：刚日仰取酉上神，中支上末干上；柔日俯取酉下神，中干上末支上（依口诀）。
 *     书中 p70 一例柔日昴星作中支上末干上，与口诀相反，未采，结果里另加提示。
 *   · 八专（干支同位）无上下克：阳日干上神顺数三位，阴日第四课上神逆数三位；中末俱干上神。
 *     书中只说「两课无克」，未说遥克是否先行；此处不先取遥克【待核】。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./tiandipan.js'));
  else root.LiurenSanChuan = factory(root.LiurenTianDiPan);
})(typeof self !== 'undefined' ? self : this, function (TDP) {
  'use strict';

  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const GAN = '甲乙丙丁戊己庚辛壬癸';
  const zi = (z) => ZHI.indexOf(z);
  const at = (i) => ZHI[((i % 12) + 12) % 12];

  const JI_GONG = { 甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳', 己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑' };
  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const ZHI_WX = { 子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const wx = (c) => GAN_WX[c] || ZHI_WX[c];
  const ke = (a, b) => KE[wx(a)] === wx(b);                       // a 克 b
  const yangGan = (g) => GAN.indexOf(g) % 2 === 0;
  const yangZhi = (z) => zi(z) % 2 === 0;
  // 地盘各位所寄天干（涉害数克用）
  const GAN_AT = {};
  for (const g in JI_GONG) (GAN_AT[JI_GONG[g]] = GAN_AT[JI_GONG[g]] || []).push(g);
  const MENG = '寅申巳亥', ZHONG = '子午卯酉';
  const XING = { 寅: '巳', 巳: '申', 申: '寅', 丑: '戌', 戌: '未', 未: '丑', 子: '卯', 卯: '子' };   // 辰午酉亥自刑
  const isZiXing = (z) => !XING[z];
  const chong = (z) => at(zi(z) + 6);
  const YIMA = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
  const SAN_HE = ['申子辰', '亥卯未', '寅午戌', '巳酉丑'];
  const GAN_HE = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };

  /**
   * 四课。课一下为日干本身（论克用日干五行），定位用寄宫。
   * @returns [{n, shang, xia, xiaPos}]  xiaPos＝下神在地盘的位置（课一为寄宫支）
   */
  function siKe(p, riGan, riZhi) {
    const k1 = p.tianOver(JI_GONG[riGan]);
    const k2 = p.tianOver(k1);
    const k3 = p.tianOver(riZhi);
    const k4 = p.tianOver(k3);
    return [
      { n: 1, shang: k1, xia: riGan, xiaPos: JI_GONG[riGan] },
      { n: 2, shang: k2, xia: k1, xiaPos: k1 },
      { n: 3, shang: k3, xia: riZhi, xiaPos: riZhi },
      { n: 4, shang: k4, xia: k3, xiaPos: k3 },
    ];
  }

  /** 涉害深浅：被克之神（上神 X）从所临地盘位顺行至本家（不含本家），数沿途克 X 者（支与寄干） */
  function sheHaiDepth(c) {
    const X = c.shang;
    let n = 0;
    for (let i = zi(c.xiaPos); at(i) !== X; i++) {
      const pos = at(i);
      if (ke(pos, X)) n++;
      for (const g of GAN_AT[pos] || []) if (ke(g, X)) n++;
    }
    return n;
  }

  const mzRank = (pos) => (MENG.includes(pos) ? 0 : ZHONG.includes(pos) ? 1 : 2);

  /** 复等：刚日取日上（课一、二），柔日取辰上（课三、四），同侧取先见 */
  function fuDeng(cands, gang) {
    const side = (c) => (c.n <= 2 ? 0 : 1);
    return cands.slice().sort((a, b) => (gang ? side(a) - side(b) : side(b) - side(a)) || a.n - b.n)[0];
  }

  function sheHai(cands, gang, method, ke4) {
    if (method === 'mengzhong') {
      const best = Math.min(...cands.map((c) => mzRank(c.xiaPos)));
      if (best === 2) {   // 俱临季：「季阳取干上阴取支上」
        const k = gang ? ke4[0] : ke4[2];
        return { pick: k, why: `俱临季，${gang ? '刚日取干上' : '柔日取支上'}` };
      }
      const pool = cands.filter((c) => mzRank(c.xiaPos) === best);
      const pick = pool.length === 1 ? pool[0] : fuDeng(pool, gang);
      return { pick, why: `涉害（孟仲法）：${pool.length > 1 ? '同临' : '临'}${best === 0 ? '孟' : '仲'}${pool.length > 1 ? '，复等' : ''}` };
    }
    const depths = cands.map((c) => ({ c, d: sheHaiDepth(c) }));
    const max = Math.max(...depths.map((x) => x.d));
    let pool = depths.filter((x) => x.d === max).map((x) => x.c);
    let why = `涉害深浅：${depths.map((x) => `${x.c.shang}${x.d}重`).join('、')}`;
    if (pool.length > 1) {
      const best = Math.min(...pool.map((c) => mzRank(c.xiaPos)));
      if (best < 2) {
        const p2 = pool.filter((c) => mzRank(c.xiaPos) === best);
        if (p2.length < pool.length) why += `，同深取临${best === 0 ? '孟（见机）' : '仲（察微）'}`;
        pool = p2;
      }
      if (pool.length > 1) why += `，复等${gang ? '刚日取日上' : '柔日取辰上'}`;
    }
    return { pick: pool.length === 1 ? pool[0] : fuDeng(pool, gang), why };
  }

  /** 从一组候选里定初传：一个即用；多个先比（阳日用阳、阴日用阴），再涉害 */
  function choose(cands, gang, method, ke4) {
    const uniq = [];
    for (const c of cands) if (!uniq.some((u) => u.shang === c.shang)) uniq.push(c);   // 同一神只算一次
    if (uniq.length === 1) return { pick: uniq[0], step: 'single' };
    const bi = uniq.filter((c) => yangZhi(c.shang) === gang);
    if (bi.length === 1) return { pick: bi[0], step: 'biyong', why: `比用：${gang ? '阳日取阳神' : '阴日取阴神'}` };
    const r = sheHai(bi.length ? bi : uniq, gang, method, ke4);
    return { pick: r.pick, step: 'shehai', why: (bi.length ? '俱比，' : '俱不比，') + r.why };
  }

  /**
   * @param {{riGan, riZhi, yueJiang, shiZhi, zhouYe?}} p
   * @param {{sheHai?: 'shenqian'|'mengzhong', fuYinRen?: 'verse'|'zhinan'}} [opts]
   * @returns {{ke, chuan:[初,中,末], name, method, why, flags:[] }}
   */
  function compute(p, opts) {
    opts = opts || {};
    const method = opts.sheHai || 'shenqian';
    const pan = TDP.build({ riGan: p.riGan, yueJiang: p.yueJiang, shiZhi: p.shiZhi, zhouYe: p.zhouYe });
    const { riGan, riZhi } = p;
    const ke4 = siKe(pan, riGan, riZhi);
    const gang = yangGan(riGan);
    const up = (z) => pan.tianOver(z);
    const flags = [];
    const out = (chuan, name, why) => ({ ke: ke4, chuan, name, method: opts.sheHai ? method : 'shenqian', why, flags, liuren: pan });
    const normal = (first) => [first, up(first), up(up(first))];

    const xiaKe = ke4.filter((k) => ke(k.xia, k.shang));      // 下贼上
    const shangKe = ke4.filter((k) => ke(k.shang, k.xia));    // 上克下
    const offset = pan.offset;

    // 伏吟
    if (offset === 0) {
      const ganShang = JI_GONG[riGan], zhiShang = riZhi;
      let a, b, c, why;
      if (xiaKe.length || shangKe.length) {          // 只有乙、癸二干
        a = (xiaKe[0] || shangKe[0]).shang; b = zhiShang;
        c = isZiXing(b) ? chong(b) : XING[b];
        why = '伏吟有克，取克发用，中传支上，末传取刑（中自刑则取冲）';
        if (b === a) flags.push('伏吟中传与初传同支，书中未载此情形');
      } else if (riGan === '壬' && (riZhi === '辰' || riZhi === '午')) {
        if ((opts.fuYinRen || 'verse') === 'verse') { a = '亥'; b = '巳'; c = '申'; why = '伏吟壬辰、壬午：依口诀「亥巳申」'; }
        else { a = '亥'; b = riZhi; c = chong(riZhi); why = '伏吟壬辰、壬午：依《指南》通则，初自刑中用支，中自刑末取冲'; }
        flags.push('壬辰、壬午伏吟两说并存（口诀与《指南》），已按 ' + (opts.fuYinRen || 'verse') + ' 取');
      } else {
        a = gang ? ganShang : zhiShang;
        if (isZiXing(a)) { b = gang ? zhiShang : ganShang; why = `伏吟无克，${gang ? '阳日自干上' : '阴日自支上'}发用；初传自刑，中传${gang ? '用支' : '用干'}`; }
        else { b = XING[a]; why = `伏吟无克，${gang ? '阳日自干上' : '阴日自支上'}发用，中末取刑`; }
        c = isZiXing(b) ? chong(b) : XING[b];
        if (isZiXing(b)) why += '；中传自刑，末取冲';
      }
      return out([a, b, c], '伏吟', why);
    }

    // 返吟
    if (offset === 6) {
      const pool = xiaKe.length ? xiaKe : shangKe;
      if (pool.length) {
        const r = choose(pool, gang, method, ke4);
        return out(normal(r.pick.shang), '返吟', `返吟有克，${xiaKe.length ? '下贼上' : '上克下'}${r.why ? '，' + r.why : ''}，中末取上神（即冲）`);
      }
      return out([YIMA[riZhi], ke4[2].shang, ke4[0].shang], '返吟', '返吟无克，驿马发用，中取支上，末取干上');
    }

    // 有上下克：先下贼上，后上克下
    if (xiaKe.length || shangKe.length) {
      const pool = xiaKe.length ? xiaKe : shangKe;
      const r = choose(pool, gang, method, ke4);
      const kind = xiaKe.length ? '下贼上' : '上克下';
      const name = r.step === 'single' ? (xiaKe.length ? '重审' : '元首') : r.step === 'biyong' ? '知一（比用）' : '涉害';
      return out(normal(r.pick.shang), name, `${kind}${r.why ? '，' + r.why : ''}（第${r.pick.n}课）`);
    }

    const distinct = new Set(ke4.map((k) => k.shang + '/' + k.xiaPos)).size;
    const baZhuan = JI_GONG[riGan] === riZhi;

    // 八专（干支同位）无克
    if (baZhuan) {
      flags.push('八专无克：未先取遥克【待核】');
      const first = gang ? at(zi(ke4[0].shang) + 2) : at(zi(ke4[3].shang) - 2);
      return out([first, ke4[0].shang, ke4[0].shang], '八专', `八专无克，${gang ? '阳日干上神顺数三' : '阴日第四课上神逆数三'}，中末俱干上神`);
    }

    // 遥克：先神遥克日（蒿矢），无则日遥克神（弹射）
    const others = ke4.slice(1);
    const shenKeRi = others.filter((k) => ke(k.shang, riGan));
    const riKeShen = others.filter((k) => ke(riGan, k.shang));
    if (shenKeRi.length || riKeShen.length) {
      const pool = shenKeRi.length ? shenKeRi : riKeShen;
      const r = choose(pool, gang, method, ke4);
      return out(normal(r.pick.shang), shenKeRi.length ? '遥克（蒿矢）' : '遥克（弹射）',
        `四课无克，${shenKeRi.length ? '神遥克日' : '日遥克神'}${r.why ? '，' + r.why : ''}（第${r.pick.n}课）`);
    }

    // 别责（四课不备，只三课）
    if (distinct === 3) {
      let first;
      if (gang) { first = up(JI_GONG[GAN_HE[riGan]]); }
      else { const g = SAN_HE.find((s) => s.includes(riZhi)); first = g[(g.indexOf(riZhi) + 1) % 3]; }
      return out([first, ke4[0].shang, ke4[0].shang], '别责',
        gang ? `别责，刚日取干合（${GAN_HE[riGan]}寄${JI_GONG[GAN_HE[riGan]]}）上神，中末俱干上神` : '别责，柔日取支三合前一位，中末俱干上神');
    }
    if (distinct < 3) flags.push('四课只两课却非八专日，书中未载');

    // 昴星
    if (gang) return out([up('酉'), ke4[2].shang, ke4[0].shang], '昴星（虎视）', '四课无克无遥，刚日仰取酉上神，中支上，末干上');
    flags.push('昴星柔日：依口诀「柔日先干而后辰」中干上末支上；伍剑虹书 p70 之例（子将卯时丁丑日）却作中支上末干上【待核】');
    return out([pan.diUnder('酉'), ke4[0].shang, ke4[2].shang], '昴星（冬蛇掩目）', '四课无克无遥，柔日俯取酉下神，中干上，末支上');
  }

  return { compute, siKe, sheHaiDepth, JI_GONG };
});
