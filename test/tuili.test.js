const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const TL = require('../core/liuren/tuili.js');
const SC = require('../core/liuren/sanchuan.js');
const TDP = require('../core/liuren/tiandipan.js');

const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const BOOK = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledge/liuren-cases.json'), 'utf8'));
/** 照原书例起课：有月将与占时就用；书中缺的（活动时）以位差起，只能核三传的形 */
function fromCase(id) {
  const c = BOOK.cases.find((x) => x.id === id);
  const p = c.yueJiang && c.shiZhi
    ? { riGan: c.riZhu[0], riZhi: c.riZhu[1], yueJiang: c.yueJiang, shiZhi: c.shiZhi, zhouYe: c.zhouYe || undefined }
    : { riGan: c.riZhu[0], riZhi: c.riZhu[1], yueJiang: ZHI[c.diff], shiZhi: '子' };
  const sc = SC.compute(p);
  assert.equal(sc.chuan.join(''), c.chuanBook, id + ' 三传须与书同');
  return TL.analyze({ sc, riZhu: c.riZhu, xunKong: TDP.xunKong(c.riZhu) });
}
const all = (r) => r.steps.flatMap((s) => s.items).concat(r.heKan).map((x) => x.text).join('\n');

test('骨架照书页 13–14 八要素，前置课体；每句有书页或标「本 app 取法」', () => {
  const r = fromCase('王-13');
  assert.deepEqual(r.steps.map((s) => s.title), ['大局·课体', '先锋·占时', '值事·月将', '外事·日干（我）', '内事·日支（事／对方）', '发端·初传', '移易·中传', '归计·末传', '变体·年命']);
  for (const it of r.steps.flatMap((s) => s.items).concat(r.heKan)) {
    if (/^(干阴|支阴)/.test(it.text)) continue;   // 紧接上一句的续行
    assert.ok(it.src || it.own, '无出处：' + it.text);
  }
  assert.equal(r.appliesTo, 'chuanren-exp');
  assert.match(r.caution.text, /更次才是吉神凶神/);
});

test('原书例：王-13 三传退茹、天乙逆治（书页 43）', () => {
  const r = fromCase('王-13');
  assert.equal(r.moves.dir, '退');
  assert.ok(r.moves.lian);
  assert.match(all(r), /退茹（连茹）/);
  assert.match(all(r), /逆行/);
});

test('原书例：王-22、王-53、王-77 进茹；王-33 退茹；王-40 进间；王-94 退间', () => {
  for (const id of ['王-22', '王-53', '王-77']) { const m = fromCase(id).moves; assert.equal(m.dir + (m.lian ? '茹' : ''), '进茹', id); }
  const m33 = fromCase('王-33').moves; assert.equal(m33.dir, '退'); assert.ok(m33.lian);
  const m40 = fromCase('王-40').moves; assert.equal(m40.dir, '进'); assert.ok(m40.jian);
  const m94 = fromCase('王-94').moves; assert.equal(m94.dir, '退'); assert.ok(m94.jian);
  assert.equal(fromCase('王-22').moves.sanHe, false, '亥子丑是三会，不是三合');
});

test('原书例：伍-17 三传戌午寅「退神合局」（书页 75–76）；伍-21 八专亥戌戌「传退」（书页 82）', () => {
  const r = fromCase('伍-17');
  assert.equal(r.moves.dir, '退');
  assert.ok(r.moves.sanHe);
  assert.match(all(r), /寅午戌三合局，更缓/);
  assert.equal(fromCase('伍-21').moves.dir, '退', '中末同支不算步');
});

test('原书例：王-21、王-68 三传不离四课成回环', () => {
  for (const id of ['王-21', '王-68']) assert.match(all(fromCase(id)), /回环/, id);
  assert.ok(fromCase('王-68').moves.sanHe, '王-68 亥卯未木局');
});

test('原书例：王-53 寅财自支阴（第四课）发用；伍-8 伏吟、贵人逆行', () => {
  assert.match(all(fromCase('王-53')), /初传取自第4课，支阴发用/);
  const r = fromCase('伍-8');
  assert.match(all(r), /伏吟：天地盘重合/);
  assert.match(all(r), /逆行/);
});

test('旺相休囚以月建为纲（书页 15）；初传旺相定现在、未来、过去事（书页 22）', () => {
  assert.equal(TL.wangXiang('子', '亥'), '旺');
  assert.equal(TL.wangXiang('寅', '子'), '相');
  assert.equal(TL.wangXiang('申', '子'), '休');
  assert.equal(TL.wangXiang('酉', '卯'), '囚');   // 书例：春木旺，金克不了木反被木所困为囚——克当令者为囚
  assert.equal(TL.wangXiang('辰', '子'), '囚');
  assert.equal(TL.wangXiang('午', '子'), '死');   // 当令所克者死
  assert.equal(TL.wangXiang('戌', '辰'), '旺');
  // 2026-10-30 午时：丁丑日 卯将，昴星（冬蛇掩目），三传子辰戌；戌月
  const sc = SC.compute({ riGan: '丁', riZhi: '丑', yueJiang: '卯', shiZhi: '午' });
  assert.equal(sc.chuan.join(''), '子辰戌');
  const r = TL.analyze({ sc, riZhu: '丁丑', yueZhi: '戌', xunKong: TDP.xunKong('丁丑'), nianMing: '庚午' });
  const t = all(r);
  assert.match(t, /初传子水，戌月死：.*过去事/);
  assert.match(t, /昴星（冬蛇掩目）：有人虎视眈眈/);
  assert.match(t, /气数居中/);
  assert.match(t, /初传丙子乘螣蛇（官）.*临地盘卯（奇门3宫）/);
  assert.match(t, /年命庚午，上神/);
  assert.match(t, /子→辰进四位，辰→戌对冲/);
  assert.match(t, /传见对冲/);
  assert.match(t, /三传六亲 官、子孙、子孙/);
  // 没给年支：变体不看
  assert.match(all(TL.analyze({ sc, riZhu: '丁丑', xunKong: [], nianMing: '庚' })), /未给年命地支/);
});
