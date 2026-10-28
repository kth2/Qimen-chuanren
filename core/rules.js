/**
 * 奇门穿壬 v2 · 规则 1–10
 *   规则 1–6：照《奇门穿壬 v1 · 冻结规格》「取用」「六条规则」两节，原样不动。
 *   规则 7–10：v2 新增（docs/SPEC-v2.md；2026-10-28 kt 决定不冻结、直接启用），
 *     每条都是「奇门一侧 × 六壬一侧」两边各自定性，两边同向才投票，相反记「混」不投票。
 *     · 规则 7  应期融合·穿壬：奇门应期融合法 v1 的取支 ＋ 六壬末传合、初传合、三传旬空填实，等权计票
 *     · 规则 8  类神入传：六壬类神是否入三传（伍剑虹「三传不出现则事未形成」）× 奇门用神宫空亡／入墓／击刑
 *     · 规则 9  贵人互参：六壬贵人空亡或坐狱（临辰戌）× 奇门值符宫受制
 *     · 规则 10 我彼双读：六壬干上神与支上神的合生／刑冲克 × 奇门我宫与时干宫的生克
 * 纪律：
 *   · 规则 1、2、5、6 不读三传；三传只供规则 3、4（2026-10-28 kt 决定启用，涉害取深浅法）。
 *   · 「我」「事」一律取自 Qimen-pwa 五行推理 v1 的取用（转盘：日干宫／占类用神宫；
 *     飞盘：年命宫／《鸣法》用神宫或时干宫），不在本仓库另立取用。
 *   · 每条规则各出一票，不相加；+1／−1 只是关系分值，不等于吉或成功。
 *   · 计票同时记下原始关系，供五种关系分开盲测。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../vendor/qimen-pwa/core/wuxing.js'), require('./liuren/tiandipan.js'), require('./liuren/yuejiang.js'),
      require('./liuren/sanchuan.js'), require('../vendor/qimen-pwa/core/yingqi.js'), require('./liuren/xiangyi.js'));
  } else {
    root.ChuanRenRules = factory(root.WuXing, root.LiurenTianDiPan, root.LiurenYueJiang, root.LiurenSanChuan, root.YingQi, root.LiurenXiangYi);
  }
})(typeof self !== 'undefined' ? self : this, function (WuXing, TianDiPan, YueJiang, SanChuan, YingQi, XiangYi) {
'use strict';

const VERSION = '2.0.0';
const APPLIES_TO = 'chuanren-exp';

const ZHI_WX = { 子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土' };
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

// ── 以下四个小函数照 Qimen-pwa core/wuxing.js 逐字移植，只为规则 2 能换掉「宫五行」。
//    test/wuxing-parity.test.js 保证：传入宫五行时，与上游 WuXing.score() 结果完全相同。
const GONG_WX = { 1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火' };
const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
const MEN_WX = { 休门: '水', 生门: '土', 伤门: '木', 杜门: '木', 景门: '火', 死门: '土', 惊门: '金', 开门: '金' };
const XING_WX = { 蓬: '水', 芮: '土', 冲: '木', 辅: '木', 禽: '土', 心: '金', 柱: '金', 任: '土', 英: '火' };
const STATE_V = { 旺: 1.0, 相: 0.8, 休: 0.5, 囚: 0.3, 死: 0.15 };
function power(ws, g) {
  const w = (ws && ws.gongs && ws.gongs[g]) || {};
  let p = STATE_V[w.gongState] != null ? STATE_V[w.gongState] : 0.5;
  if (w.menPo) p *= 0.5; if (w.kongWang) p *= 0.5; if (w.jiXing) p *= 0.5; if (w.ruMu) p *= 0.2;
  return p;
}
const lvl = (p) => (p >= 0.8 ? '太过' : p <= 0.3 ? '不及' : '平');
const isFeipan = (ch) => !!(ch && (ch.renPanMen || ch.tianPanYi || ch.diPanShen));
function innerWx(ch, g) {
  const s = {}, fp = isFeipan(ch);
  const m = ((fp ? ch.renPanMen : ch.baMen) || {})[g]; if (MEN_WX[m]) s[MEN_WX[m]] = 1;
  String(((fp ? ch.tianPanXing : ch.jiuXing) || {})[g] || '').split('').forEach((c) => { if (XING_WX[c]) s[XING_WX[c]] = 1; });
  const t = ((fp ? ch.tianPanYi : ch.tianPan) || {})[g], d = (ch.diPan || {})[g];
  if (GAN_WX[t]) s[GAN_WX[t]] = 1; if (GAN_WX[d]) s[GAN_WX[d]] = 1;
  return s;
}
function keOf(x) { for (const k in KE) if (KE[k] === x) return k; return ''; }

/** 五行推理 v1 的 score()，唯一改动：r、y 两个五行由调用方传入。 */
function wuxingScore(ch, ws, R, Y, r, y) {
  const pR = power(ws, R), pY = power(ws, Y), lR = lvl(pR), lY = lvl(pY);
  const o = { rWx: r, yWx: y, pR: +pR.toFixed(3), pY: +pY.toFixed(3), lR, lY };
  const out = (s, rel, why) => { o.score = s; o.relation = rel; o.why = why; return o; };
  if (R === Y || r === y) return out(1, '比和', '同宫或比和，事与我同气');
  if (SHENG[y] === r) {
    if (lY === '太过' && lR === '不及') {
      return innerWx(ch, Y)[keOf(y)]
        ? out(1, '事生我', '生方太过而宫中有承制，化害为生（亢则害，承乃制）')
        : out(0, '事生我', '生方太过、我不及而无承制，生太过反为害（亢害）');
    }
    return out(1, '事生我', '事来生我');
  }
  if (KE[r] === y) {
    if (lR === '不及' && lY === '太过') return out(-1, '我克事', '我不及而事太过，反为所侮');
    if (lR === '不及') return out(0, '我克事', '我欲制事而力不及（克而无力）');
    return out(1, '我克事', '我能制事');
  }
  if (KE[y] === r) {
    const x = SHENG[y];
    if (SHENG[x] === r && (innerWx(ch, Y)[x] || innerWx(ch, R)[x])) return out(1, '事克我', '事克我而宫中有' + x + '通关，克化为生');
    if (lY === '太过' && lR === '不及') return out(-2, '事克我', '事太过、我不及，克之太过（乘）');
    if (lY === '不及' && lR === '太过') return out(1, '事克我', '事不及、我太过，我反制之（侮）');
    return out(-1, '事克我', '事克我');
  }
  if (SHENG[r] === y) {
    if (lR === '不及') return out(-2, '我生事', '我不及而生事，子盗母气');
    if (lR === '太过') return out(1, '我生事', '我太过，有余而生');
    return out(-1, '我生事', '我耗于事');
  }
  return out(0, '', '未归类');
}

/** 生克计票表（规则 6 用；规则 3 日后同用）：生我、比和、我克 +1；克我、我生 −1 */
function relationVote(me, other) {
  if (me === other) return { relation: '比和', vote: 1 };
  if (SHENG[other] === me) return { relation: '事生我', vote: 1 };
  if (KE[me] === other) return { relation: '我克事', vote: 1 };
  if (KE[other] === me) return { relation: '事克我', vote: -1 };
  return { relation: '我生事', vote: -1 };
}

/** 一宫天盘支的五行：两支五行相同才有定值，否则 null（弃权） */
function gongTianWx(ln, gong) {
  const rs = ln.readGong(Number(gong)).readings;
  if (!rs.length) return { wx: null, zhi: [] };
  const wxs = [...new Set(rs.map((r) => ZHI_WX[r.tian]))];
  return { wx: wxs.length === 1 ? wxs[0] : null, zhi: rs.map((r) => r.tian) };
}

// ── v2（规则 7–10）用的小表 ──
const ZHI_ORDER = '子丑寅卯辰巳午未申酉戌亥'.split('');
const LIU_HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const XING_PAIRS = ['寅巳', '巳申', '申寅', '丑戌', '戌未', '未丑', '子卯', '卯子', '辰辰', '午午', '酉酉', '亥亥'];
const isXing = (a, b) => XING_PAIRS.includes(a + b) || XING_PAIRS.includes(b + a);
/** 规则 8 的类神：按占类，取六亲与天将（王雷之、伍剑虹两书各章所用） */
const LEISHEN = {
  wealth: { qin: ['财'], jiang: ['青龙'], note: '财爻、青龙' },
  stock: { qin: ['财'], jiang: ['青龙'], note: '财爻、青龙' },
  career: { qin: ['官', '鬼'], jiang: [], note: '官鬼' },
  study: { qin: ['父母'], jiang: ['朱雀'], note: '印（父母）、朱雀' },
  relationship: { qin: [], jiang: ['六合', '天后', '青龙'], note: '六合、天后、青龙' },
  traveler: { qin: [], jiang: ['六合'], note: '六合' },
  find_person: { qin: [], jiang: ['六合'], note: '六合' },
  pregnancy: { qin: ['子孙'], jiang: ['六合'], note: '子孙、六合' },
};
/** 规则 9 只用于求人办事的占类 */
const GUI_DOMAINS = ['career', 'study', 'lawsuit', 'wealth'];
/** 奇门一宫受制：空亡、入墓、击刑、门迫任一 */
function gongHurt(ws, g) {
  const w = (ws && ws.gongs && ws.gongs[g]) || {};
  const why = [];
  if (w.kongWang) why.push('空亡'); if (w.ruMu) why.push('入墓'); if (w.jiXing) why.push('击刑'); if (w.menPo) why.push('门迫');
  return { hurt: why.length > 0, why, state: w.gongState || '' };
}
function findGong(m, v) { for (const k in (m || {})) if (m[k] === v) return String(k); return ''; }
/** 时干落宫（转盘）：甲时取值符宫，余照天盘、再地盘找——与 Qimen-pwa 五行推理 v1 同一取法 */
function shiGanGongZ(ch) {
  const t = String((ch.siZhu || {}).time || ''), g = t.charAt(0);
  if (g === '甲') return ch.zhiFuGong != null ? String(ch.zhiFuGong) : '';
  return findGong(ch.tianPan, g) || findGong(ch.diPan, g);
}
/** 两边同向才投票：同为 +1 → +1，同为 −1 → −1；一正一负 → 混；有一边为 0 → 弃权 */
function agree(qm, lr) {
  if (qm && lr && qm === lr) return { applicable: true, vote: qm, verdict: qm > 0 ? '两边同吉' : '两边同凶' };
  if (qm && lr) return { applicable: false, vote: 0, verdict: '混', reason: '奇门与六壬相反，记「混」不投票' };
  return { applicable: false, vote: 0, verdict: '', reason: '有一边不定，弃权' };
}

const abstain = (rule, reason, extra) => Object.assign({ rule, applicable: false, vote: 0, reason }, extra || {});

/**
 * @param {object} a
 *   chart       Qimen-pwa 排盘结果（转盘或飞盘）
 *   wangshuai   Qimen-pwa core/wangshuai.js 的 analyze(chart)
 *   domain      五行推理 v1 的占类键（wealth、career……；无则取时干宫）
 *   date        起局时刻（Date），用来定月将
 *   feipan      飞盘取用：{ nianMingGong, shiGanGong, yongGong, yongName }
 *   nianMing    求测人年命干支（如「甲子」）；只有天干或未提供，规则 6 弃权
 *   yueJiang    可选：直接给月将，跳过按时间推算
 */
function evaluate(a) {
  const ch = a.chart || {};
  const sz = ch.siZhu || {};
  const riGan = String(sz.day || '').charAt(0);
  const shiZhi = String(sz.time || '').charAt(1);
  const yj = a.yueJiang ? { yueJiang: a.yueJiang, rule: 'given', status: '调用方给定' } : YueJiang.of(a.date);
  const ln = TianDiPan.build({ riGan, yueJiang: yj.yueJiang, shiZhi });

  // 取用：照五行推理 v1
  const wx = WuXing.analyze({ chart: ch, wangshuai: a.wangshuai, domain: a.domain, feipan: a.feipan });
  const school = isFeipan(ch) ? 'feipan' : 'zhuanpan';
  let R = wx.R || '', Y = wx.Y || '', yName = wx.yName || '';
  if (school === 'feipan' && !Y) {
    const f = a.feipan || {};
    if (f.yongGong) { Y = String(f.yongGong); yName = f.yongName || '用神'; }
    else if (f.shiGanGong) { Y = String(f.shiGanGong); yName = '时干'; }
  }

  const rules = [];

  // 规则 1：用神天将
  if (!Y) rules.push(abstain(1, '事宫未定'));
  else {
    const g = ln.readGong(Number(Y));
    if (!g.verdict) rules.push(abstain(1, '事宫在中五，无支可读', { gong: Y }));
    else rules.push({ rule: 1, applicable: g.verdict !== '混', vote: g.verdict === '吉' ? 1 : g.verdict === '凶' ? -1 : 0,
      verdict: g.verdict, gong: Y, readings: g.readings, reason: g.verdict === '混' ? '一吉一凶，不投票' : '' });
  }

  // 规则 2：五行推理·天盘支变体
  if (!R || !Y) rules.push(abstain(2, (wx.rLabel || '我宫') + '或事宫未定'));
  else {
    const rT = gongTianWx(ln, R), yT = gongTianWx(ln, Y);
    if (!rT.wx || !yT.wx) rules.push(abstain(2, '我宫或事宫天盘支五行不一（或在中五），弃权', { rZhi: rT.zhi, yZhi: yT.zhi }));
    else {
      const s = wuxingScore(ch, a.wangshuai, String(R), String(Y), rT.wx, yT.wx);
      rules.push({ rule: 2, applicable: s.score !== 0, vote: Math.sign(s.score), score: s.score, relation: s.relation, why: s.why,
        R, Y, rZhi: rT.zhi, yZhi: yT.zhi, rWx: s.rWx, yWx: s.yWx, lR: s.lR, lY: s.lY, reason: s.score === 0 ? '得分为 0，弃权' : '' });
    }
  }

  // 第二层：四课三传（规则 3、4 用）
  const sc = SanChuan.compute({ riGan, riZhi: String(sz.day || '').charAt(1), yueJiang: yj.yueJiang, shiZhi });
  const mo = sc.chuan[2];
  const moGong = TianDiPan.ZHI_GONG[ln.diUnder(mo)];

  // 规则 3：末传落宫——末传所加地盘之宫，其宫五行对我宫宫五行查计票表
  if (!R) rules.push(abstain(3, (wx.rLabel || '我宫') + '未定'));
  else {
    const rv = relationVote(GONG_WX[R], GONG_WX[moGong]);
    rules.push({ rule: 3, applicable: true, vote: rv.vote, relation: rv.relation, mo, moDi: ln.diUnder(mo), moGong, R,
      meWx: GONG_WX[R], moWx: GONG_WX[moGong] });
  }

  // 规则 4：空亡互检——事宫奇门空亡时，看末传是否落六壬日旬空
  const xk = TianDiPan.xunKong(sz.day);
  const yKong = !!(Y && a.wangshuai && a.wangshuai.gongs && (a.wangshuai.gongs[Y] || {}).kongWang);
  if (!Y) rules.push(abstain(4, '事宫未定'));
  else if (!yKong) rules.push(abstain(4, '事宫奇门不空，不投票', { Y }));
  else {
    const moKong = xk.includes(mo);
    rules.push({ rule: 4, applicable: true, vote: moKong ? -1 : 1, Y, mo, moKong,
      verdict: moKong ? '末传亦空，不成' : '末传实，迟成', yingQi: moKong ? null : mo + '日（末传支日，应期候选）' });
  }

  // 规则 5：方位第二意见
  if (!Y || !ln.readGong(Number(Y)).readings.length) rules.push(abstain(5, '事宫未定或在中五'));
  else rules.push({ rule: 5, applicable: true, qimenGong: Number(Y), secondGongs: ln.secondDirection(Number(Y)) });

  // 规则 6：命干
  const nm = String(a.nianMing || '');
  const benMingZhi = nm.length === 2 && ZHI_WX[nm[1]] ? nm[1] : '';
  if (!benMingZhi) rules.push(abstain(6, '未提供年命地支'));
  else if (!Y) rules.push(abstain(6, '事宫未定'));
  else {
    const shangShen = ln.tianOver(benMingZhi);
    const yT = gongTianWx(ln, Y);
    if (!yT.wx) rules.push(abstain(6, '事宫天盘支五行不一（或在中五），弃权', { benMingZhi, shangShen, yZhi: yT.zhi }));
    else {
      const rv = relationVote(ZHI_WX[shangShen], yT.wx);
      rules.push({ rule: 6, applicable: true, vote: rv.vote, relation: rv.relation, benMingZhi, shangShen,
        shangShenJiang: ln.jiangOf(shangShen), meWx: ZHI_WX[shangShen], yZhi: yT.zhi, yWx: yT.wx });
    }
  }


  // ════════ v2：规则 7–10 ════════
  const riZhi = String(sz.day || '').charAt(1);
  const ws = a.wangshuai;

  // 规则 7：应期融合·穿壬（不投是非票，出应期日支）
  {
    const parts = {};
    const qf = school === 'zhuanpan' && YingQi && YingQi.fusionV1 ? YingQi.fusionV1(ch, a.domain || '') : null;
    if (qf && qf.picks.length) parts['奇门融合法v1'] = qf.picks.slice();
    parts['末传合'] = [LIU_HE[sc.chuan[2]]];
    parts['初传合'] = [LIU_HE[sc.chuan[0]]];
    const kongIn = [...new Set(sc.chuan.filter((z) => xk.includes(z)))];
    if (kongIn.length) parts['三传旬空填实'] = kongIn;
    const votes = {};
    for (const k in parts) for (const z of new Set(parts[k])) votes[z] = (votes[z] || 0) + 1;
    const max = Math.max(0, ...Object.values(votes));
    const picks = ZHI_ORDER.filter((z) => max > 0 && votes[z] === max);
    const lrSet = new Set([].concat(parts['末传合'], parts['初传合'], parts['三传旬空填实'] || []));
    const overlap = qf ? qf.picks.filter((z) => lrSet.has(z)) : [];
    rules.push({ rule: 7, applicable: true, vote: 0, picks, maxVotes: max, votes, parts, overlap,
      qimenPicks: qf ? qf.picks : null,
      reason: qf ? '' : '飞盘无奇门应期融合法（只在转盘检验过），只用六壬三法' });
  }

  // 规则 8：类神入传（判「事是否成形／发生」，计分对「发生」而非「如愿」）
  {
    const L = LEISHEN[a.domain];
    if (!L) rules.push(abstain(8, '本占类未定类神（只用于求财、股市、事业、学业、婚姻、行人、寻人、怀孕）'));
    else if (!Y) rules.push(abstain(8, '事宫未定'));
    else {
      const isLei = (z) => L.qin.includes(XiangYi.liuQin(riGan, z)) || L.jiang.includes(ln.jiangOf(z));
      const inChuan = sc.chuan.filter(isLei), inKe = sc.ke.map((k) => k.shang).filter(isLei);
      let lr, lrWhy;
      if (inChuan.some((z) => !xk.includes(z))) { lr = 1; lrWhy = '类神入传且不空，事已成形'; }
      else if (inChuan.length) { lr = -1; lrWhy = '类神入传而落旬空，虚而不实'; }
      else if (inKe.length) { lr = 0; lrWhy = '类神只在四课未入传，事在酝酿'; }
      else { lr = -1; lrWhy = '类神不入课传，事未形成'; }
      const h = gongHurt(ws, Y);
      let qm, qmWhy;
      if (h.hurt) { qm = -1; qmWhy = '用神宫' + h.why.join('、'); }
      else if (h.state === '旺' || h.state === '相') { qm = 1; qmWhy = '用神宫' + h.state + '而无空墓刑迫'; }
      else { qm = 0; qmWhy = '用神宫' + (h.state || '旺衰未明') + '，不定'; }
      const ag = agree(qm, lr);
      rules.push(Object.assign({ rule: 8, target: 'happened', leiShen: L.note, inChuan, inKe, lr, lrWhy, qm, qmWhy, Y }, ag));
    }
  }

  // 规则 9：贵人互参
  {
    if (!GUI_DOMAINS.includes(a.domain)) rules.push(abstain(9, '只用于事业、学业、官司、求财'));
    else {
      const guiKong = xk.includes(ln.guiRen), guiYu = ln.guiRenOverDi === '辰' || ln.guiRenOverDi === '戌';
      const lr = guiKong || guiYu ? -1 : 1;
      const lrWhy = guiKong || guiYu ? '贵人' + [guiKong ? '空亡' : '', guiYu ? '坐狱（临' + ln.guiRenOverDi + '）' : ''].filter(Boolean).join('、') : '贵人不空不坐狱';
      const zf = String(ch.zhiFuLuoGong || ch.zhiFuGong || '');
      const h = zf ? gongHurt(ws, zf) : { hurt: false, why: [] };
      const qm = !zf ? 0 : h.hurt ? -1 : 1;
      const qmWhy = !zf ? '值符宫未定' : h.hurt ? '值符宫' + h.why.join('、') : '值符宫无空墓刑迫';
      rules.push(Object.assign({ rule: 9, guiRen: ln.guiRen, guiRenOverDi: ln.guiRenOverDi, lr, lrWhy, qm, qmWhy, zhiFuGong: zf }, agree(qm, lr)));
    }
  }

  // 规则 10：我彼双读
  {
    const gs = sc.ke[0].shang, zs = sc.ke[2].shang;
    const he = LIU_HE[gs] === zs, bi = ZHI_WX[gs] === ZHI_WX[zs];
    const sheng = SHENG[ZHI_WX[gs]] === ZHI_WX[zs] || SHENG[ZHI_WX[zs]] === ZHI_WX[gs];
    const chong = CHONG[gs] === zs, xing = isXing(gs, zs);
    const keR = KE[ZHI_WX[gs]] === ZHI_WX[zs] || KE[ZHI_WX[zs]] === ZHI_WX[gs];
    const good = [he && '六合', sheng && '相生', bi && '比和'].filter(Boolean);
    const bad = [chong && '六冲', xing && '相刑', keR && '相克'].filter(Boolean);
    const lr = good.length && !bad.length ? 1 : bad.length && !good.length ? -1 : 0;
    const lrWhy = `干上${gs}、支上${zs}：${[...good, ...bad].join('、') || '无关'}${lr === 0 && good.length ? '（吉中带凶，不定）' : ''}`;
    const S = school === 'feipan' ? String((a.feipan || {}).shiGanGong || '') : shiGanGongZ(ch);
    let qm = 0, qmWhy = '我宫或时干宫未定';
    if (R && S) {
      const r = GONG_WX[R], t = GONG_WX[S];
      if (R === S || r === t) { qm = 1; qmWhy = '我宫与时干宫同宫或比和'; }
      else if (SHENG[r] === t || SHENG[t] === r) { qm = 1; qmWhy = '我宫与时干宫相生'; }
      else { qm = -1; qmWhy = '我宫与时干宫相克'; }
    }
    rules.push(Object.assign({ rule: 10, ganShang: gs, zhiShang: zs, lr, lrWhy, qm, qmWhy, R, S }, agree(qm, lr)));
  }

  return {
    version: VERSION, appliesTo: APPLIES_TO, school,
    yueJiang: yj,
    liuren: { zhouYe: ln.zhouYe, guiRen: ln.guiRen, guiRenOverDi: ln.guiRenOverDi, shun: ln.shun,
      xunKong: TianDiPan.xunKong(sz.day) },   // 六壬日旬空，与奇门 kongWang 分开存
    quYong: { R, Y, yName, rLabel: wx.rLabel || (school === 'feipan' ? '年命宫' : '日干宫') },
    wuxing: wx,   // 五行推理 v1 原结果（Qimen-pwa 同一实现），AI 提示词照引
    sanChuan: sc, // 第二层四课三传
    rules,
  };
}

return { VERSION, APPLIES_TO, evaluate, wuxingScore, relationVote, ZHI_WX, LEISHEN, GUI_DOMAINS };
});
