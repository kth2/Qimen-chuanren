// 第一层 golden fixtures：取自《大六壬探原》卷上推演篇的原书例。
// 原书写明了昼夜、贵人、贵人所加地盘支与顺逆；例一另写明部分天将位置。
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../core/liuren/tiandipan.js');

const CASES = [
  // [日柱, 月将, 占时, 昼夜, 贵人, 贵人所加地盘, 顺逆]
  ['甲辰', '亥', '卯', '昼', '未', '亥', true],
  ['丙子', '午', '亥', '夜', '亥', '辰', true],
  ['庚午', '申', '辰', '昼', '丑', '酉', false],
  ['辛酉', '亥', '子', '夜', '午', '未', false],
];

for (const [riZhu, jiang, shi, zy, gui, over, shun] of CASES) {
  test(`《探原》例 ${riZhu}日${jiang}将${shi}时`, () => {
    const p = L.build({ riGan: riZhu[0], yueJiang: jiang, shiZhi: shi });
    assert.equal(p.zhouYe, zy);
    assert.equal(p.guiRen, gui);
    assert.equal(p.guiRenOverDi, over);
    assert.equal(p.shun, shun);
    assert.equal(p.jiangOf(gui), '贵人');
  });
}

test('《探原》例一天将位置：申蛇、未贵、酉雀、戌合、巳阴、午后', () => {
  const p = L.build({ riGan: '甲', yueJiang: '亥', shiZhi: '卯' });
  const want = { 申: '螣蛇', 未: '贵人', 酉: '朱雀', 戌: '六合', 巳: '太阴', 午: '天后' };
  for (const z in want) assert.equal(p.jiangOf(z), want[z], z);
});

test('九宫读数：四维宫两支都读，一吉一凶记「混」', () => {
  const p = L.build({ riGan: '甲', yueJiang: '亥', shiZhi: '卯' });
  const kun = p.readGong(2); // 未上卯·太常；申上辰·玄武
  assert.deepEqual(kun.readings.map((r) => [r.di, r.tian, r.jiang]), [['未', '卯', '太常'], ['申', '辰', '玄武']]);
  assert.equal(kun.verdict, '混');
  assert.equal(p.readGong(6).verdict, '吉'); // 戌上午·天后；亥上未·贵人
  assert.equal(p.readGong(1).verdict, '凶'); // 子上申·螣蛇
  assert.equal(p.readGong(5).verdict, null); // 中五无支
});

test('天将十二位各不相同，覆盖全部天盘支', () => {
  for (const [riZhu, jiang, shi] of CASES) {
    const p = L.build({ riGan: riZhu[0], yueJiang: jiang, shiZhi: shi });
    const seen = new Set([...L.ZHI].map((z) => p.jiangOf(z)));
    assert.equal(seen.size, 12);
  }
});

test('天盘与地盘互逆', () => {
  const p = L.build({ riGan: '庚', yueJiang: '申', shiZhi: '辰' });
  for (const z of L.ZHI) assert.equal(p.diUnder(p.tianOver(z)), z);
  assert.equal(p.tianOver('辰'), '申'); // 月将加占时
});

test('规则 5 第二方位', () => {
  const p = L.build({ riGan: '甲', yueJiang: '亥', shiZhi: '卯' });
  // 坎一地盘子：天盘子加于地盘辰 → 巽四
  assert.deepEqual(p.secondDirection(1), [4]);
});

test('日旬空', () => {
  assert.deepEqual(L.xunKong('甲子'), ['戌', '亥']);
  assert.deepEqual(L.xunKong('甲辰'), ['寅', '卯']);
  assert.deepEqual(L.xunKong('丙子'), ['申', '酉']); // 甲戌旬
  assert.deepEqual(L.xunKong('癸亥'), ['子', '丑']); // 甲寅旬
  assert.throws(() => L.xunKong('甲丑'));
});

test('与热卜「奇门穿壬」同盘交叉核对：乙亥日卯将酉时，十二天将逐支一致', () => {
  // kt 2026-10-28 提供的热卜截图（丙午 戊戌 乙亥 乙酉）。热卜外圈所示，逐支照录。
  const p = L.build({ riGan: '乙', yueJiang: '卯', shiZhi: '酉' });
  const reBu = { 子: '贵人', 亥: '螣蛇', 戌: '朱雀', 酉: '六合', 申: '勾陈', 未: '青龙', 午: '天空', 巳: '白虎', 辰: '太常', 卯: '玄武', 寅: '太阴', 丑: '天后' };
  for (const z in reBu) assert.equal(p.jiangOf(z), reBu[z], z);
  assert.equal(p.tianOver('巳'), '亥'); // 热卜左上角：巳位上亥
  assert.equal(p.tianOver('申'), '寅'); // 右上：申位上寅
});

test('遁干：按日旬配十支，旬空两支为 null', () => {
  const d = L.dunGan('乙亥'); // 甲戌旬，空申酉
  assert.deepEqual([d.戌, d.亥, d.子, d.丑, d.寅, d.卯, d.辰, d.巳, d.午, d.未], [...'甲乙丙丁戊己庚辛壬癸']);
  assert.equal(d.申, null); assert.equal(d.酉, null);
  assert.deepEqual(Object.entries(L.dunGan('甲子')).filter(([, v]) => v === null).map(([k]) => k), ['戌', '亥']);
});
