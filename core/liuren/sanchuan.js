/**
 * 奇门穿壬 · 第二层：四课与三传（九宗门）。纯函数，无副作用。
 *
 * 基准：袁树珊《大六壬探原》卷上推演篇（书页 3–31 九宗门，书页 32–46「六十花甲日三传」720 课表）。
 * 720 课逐课与原书表一致（test/tanyuan.test.js）。伍剑虹《大六壬精义讲解》、王雷之《实占百例》
 * 的书例另作对照（test/sanchuan.test.js）。
 *
 * 要点（均照《探原》原文）：
 *   · 涉害（书页 9–12）：上神从所临地盘位顺行至本家，历数沿途地盘支与寄宫天干。下贼上，数克上神者；
 *     上克下，数上神所克者（「戌加子仅二重克，寅加辰有六重克」）。深者为用；俱深取孟上神（见机），
 *     无孟取仲上神（察微），再等阳日取干两课、阴日取枝两课先见者（缀瑕）。《探原》列出与《经纬》等书
 *     不同的「改正涉害」二十四课，720 课表中标「改正涉害」。
 *     另择之法 opts.sheHai='mengzhong'（伍剑虹自用，只看孟仲季）不是基准。
 *   · 伏吟（书页 26–27）：有克只乙、癸二干，取克发用；癸日中取初刑、末取中刑（不虞）；乙日初辰自刑，
 *     「必须取枝上神为中」。无克阳日取干上（自任）、阴日取枝上（自信）为初，初刑为中、中刑为末；
 *     初自刑则阳日中取枝上、阴日中取干上（杜传）；中又自刑取中冲为末。丁己辛三卯日初卯中子，
 *     子刑复归卯，「亦当取中冲为末传」（书页 27 注）。壬辰、壬午因此得亥辰戌、亥午子。
 *     另择之法 opts.fuYinRen='verse'（伍剑虹书所引口诀「壬辰壬午亥巳申」）不是基准。
 *   · 返吟（书页 23–26）：有克照常法，中末取上神（即冲）；无克驿马发用，中取支上，末取干上（无亲）。
 *   · 昴星（书页 18）：阳日取地盘酉上神为初，枝上为中，干上为末（虎视）；阴日取天盘酉下神为初，
 *     干上为中，枝上为末（冬蛇掩目）。伍剑虹书 p70 一例柔日作中支上末干上，与《探原》相反，不采。
 *   · 别责（书页 20）：刚日取干合寄宫上神，柔日取支前三合之支本身；中末俱干上神。
 *   · 八专（书页 22）：两课有克仍用克，无克「不取遥克」；刚日第一课上神顺数三神，柔日第四课上神
 *     逆数三神；中末俱干上神。
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

  /**
   * 涉害深浅：上神从所临地盘位顺行至本家（不含本家），历数沿途地盘支与寄宫天干。
   * 《探原》书页 9–11：下贼上，数克上神者（例：甲辰日亥将卯时，子加辰「涉辰土为一重害……涉戌土为五重害」）；
   * 上克下，数上神所克者（例：甲午日干上子，「戌加子仅二重克，寅加辰有六重克」——戌所克只子、癸，
   * 寅所克辰、戊、未、己、戌、丑）。
   * @param {'xia'|'shang'} [dir] 'shang'＝上克下；缺省为下贼上（遥克亦按此）
   */
  function sheHaiDepth(c, dir) {
    const X = c.shang;
    const hit = dir === 'shang' ? (y) => ke(X, y) : (y) => ke(y, X);
    let n = 0;
    for (let i = zi(c.xiaPos); at(i) !== X; i++) {
      const pos = at(i);
      if (hit(pos)) n++;
      for (const g of GAN_AT[pos] || []) if (hit(g)) n++;
    }
    return n;
  }

  const mzRank = (pos) => (MENG.includes(pos) ? 0 : ZHONG.includes(pos) ? 1 : 2);

  /** 复等：刚日取日上（课一、二），柔日取辰上（课三、四），同侧取先见 */
  function fuDeng(cands, gang) {
    const side = (c) => (c.n <= 2 ? 0 : 1);
    return cands.slice().sort((a, b) => (gang ? side(a) - side(b) : side(b) - side(a)) || a.n - b.n)[0];
  }

  function sheHai(cands, gang, method, ke4, dir) {
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
    const depths = cands.map((c) => ({ c, d: sheHaiDepth(c, dir) }));
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
  function choose(cands, gang, method, ke4, dir) {
    const uniq = [];
    for (const c of cands) if (!uniq.some((u) => u.shang === c.shang)) uniq.push(c);   // 同一神只算一次
    if (uniq.length === 1) return { pick: uniq[0], step: 'single' };
    const bi = uniq.filter((c) => yangZhi(c.shang) === gang);
    if (bi.length === 1) return { pick: bi[0], step: 'biyong', why: `比用：${gang ? '阳日取阳神' : '阴日取阴神'}` };
    const r = sheHai(bi.length ? bi : uniq, gang, method, ke4, dir);
    return { pick: r.pick, step: 'shehai', why: (bi.length ? '俱比，' : '俱不比，') + r.why };
  }

  /**
   * @param {{riGan, riZhi, yueJiang, shiZhi, zhouYe?}} p
   * @param {{sheHai?: 'shenqian'|'mengzhong', fuYinRen?: 'verse'}} [opts]  缺省即《探原》基准
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

    // 伏吟（《探原》书页 26–27）
    if (offset === 0) {
      const ganShang = JI_GONG[riGan], zhiShang = riZhi;
      // 末传：中刑；中自刑则取中冲。丁己辛三卯日初卯中子，子刑复归卯，「中传虽非自刑，亦当取中冲为末传」（书页 27 注）
      const moOf = (a, b) => (isZiXing(b) || XING[b] === a ? chong(b) : XING[b]);
      let a, b, why;
      const youKe = xiaKe.length || shangKe.length;   // 只有乙、癸二干
      if (youKe) {
        a = (xiaKe[0] || shangKe[0]).shang;
        if (isZiXing(a)) { b = zhiShang; why = '伏吟有克，取克发用；初传自刑，「必须取枝上神为中」，中刑为末'; }
        else { b = XING[a]; why = '伏吟有克，取克发用，中取初刑，末取中刑（不虞）'; }
      } else if (riGan === '壬' && (riZhi === '辰' || riZhi === '午') && opts.fuYinRen === 'verse') {
        a = '亥'; b = '巳'; why = '伏吟壬辰、壬午：依口诀「亥巳申」（非《探原》基准，另择之法）';
        flags.push('壬辰、壬午伏吟：已按口诀「亥巳申」取；《探原》作亥辰戌／亥午子');
        return out([a, b, '申'], '伏吟', why);
      } else {
        a = gang ? ganShang : zhiShang;
        if (isZiXing(a)) { b = gang ? zhiShang : ganShang; why = `伏吟无克，${gang ? '阳日取干上' : '阴日取枝上'}神为初传；初传自刑，中传${gang ? '取枝上' : '取干上'}（杜传）`; }
        else { b = XING[a]; why = `伏吟无克，${gang ? '阳日取干上神为初传（自任）' : '阴日取枝上神为初传（自信）'}，初刑为中，中刑为末`; }
      }
      const c = moOf(a, b);
      if (isZiXing(b)) why += '；中传又自刑，取中冲为末';
      else if (XING[b] === a) why += '；中刑复归初传，取中冲为末（书页 27 注）';
      return out([a, b, c], '伏吟', why);
    }

    // 返吟
    if (offset === 6) {
      const pool = xiaKe.length ? xiaKe : shangKe;
      if (pool.length) {
        const r = choose(pool, gang, method, ke4, xiaKe.length ? 'xia' : 'shang');
        return out(normal(r.pick.shang), '返吟', `返吟有克，${xiaKe.length ? '下贼上' : '上克下'}${r.why ? '，' + r.why : ''}，中末取上神（即冲）`);
      }
      return out([YIMA[riZhi], ke4[2].shang, ke4[0].shang], '返吟', '返吟无克，驿马发用，中取支上，末取干上');
    }

    // 有上下克：先下贼上，后上克下
    if (xiaKe.length || shangKe.length) {
      const pool = xiaKe.length ? xiaKe : shangKe;
      const r = choose(pool, gang, method, ke4, xiaKe.length ? 'xia' : 'shang');
      const kind = xiaKe.length ? '下贼上' : '上克下';
      const name = r.step === 'single' ? (xiaKe.length ? '重审' : '元首') : r.step === 'biyong' ? '知一（比用）' : '涉害';
      return out(normal(r.pick.shang), name, `${kind}${r.why ? '，' + r.why : ''}（第${r.pick.n}课）`);
    }

    const distinct = new Set(ke4.map((k) => k.shang + '/' + k.xiaPos)).size;
    const baZhuan = JI_GONG[riGan] === riZhi;

    // 八专（干支同位）无克
    if (baZhuan) {
      const first = gang ? at(zi(ke4[0].shang) + 2) : at(zi(ke4[3].shang) - 2);
      return out([first, ke4[0].shang, ke4[0].shang], '八专', `八专无克，不取遥克，${gang ? '阳日干上神顺数三' : '阴日第四课上神逆数三'}，中末俱干上神`);
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
    return out([pan.diUnder('酉'), ke4[0].shang, ke4[2].shang], '昴星（冬蛇掩目）', '四课无克无遥，柔日俯取酉下神，中干上，末支上');
  }

  return { compute, siKe, sheHaiDepth, JI_GONG };
});
