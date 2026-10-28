/**
 * 奇门穿壬 v1 · 规则 1、2、5、6（只用第一层：天地盘与天将）
 *
 * 规格：《奇门穿壬 v1 · 冻结规格》「取用」「六条规则」两节。
 * 纪律：
 *   · 本文件不得调用任何四课三传的函数（规则 3、4 等第二层原文）。
 *   · 「我」「事」一律取自 Qimen-pwa 五行推理 v1 的取用（转盘：日干宫／占类用神宫；
 *     飞盘：年命宫／《鸣法》用神宫或时干宫），不在本仓库另立取用。
 *   · 每条规则各出一票，不相加；+1／−1 只是关系分值，不等于吉或成功。
 *   · 计票同时记下原始关系，供五种关系分开盲测。
 */
'use strict';

const WuXing = require('../vendor/qimen-pwa/core/wuxing.js');
const TianDiPan = require('./liuren/tiandipan.js');
const YueJiang = require('./liuren/yuejiang.js');

const VERSION = '1.0.0-dev';
const APPLIES_TO = 'chuanren-exp';

const ZHI_WX = { 子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土' };
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

// ── 以下四个小函数照 Qimen-pwa core/wuxing.js 逐字移植，只为规则 2 能换掉「宫五行」。
//    test/wuxing-parity.test.js 保证：传入宫五行时，与上游 WuXing.score() 结果完全相同。
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

  return {
    version: VERSION, appliesTo: APPLIES_TO, school,
    yueJiang: yj,
    liuren: { zhouYe: ln.zhouYe, guiRen: ln.guiRen, guiRenOverDi: ln.guiRenOverDi, shun: ln.shun,
      xunKong: TianDiPan.xunKong(sz.day) },   // 六壬日旬空，与奇门 kongWang 分开存
    quYong: { R, Y, yName, rLabel: wx.rLabel || (school === 'feipan' ? '年命宫' : '日干宫') },
    rules,
  };
}

module.exports = { VERSION, APPLIES_TO, evaluate, wuxingScore, relationVote, ZHI_WX };
