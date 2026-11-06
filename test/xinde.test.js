// 复盘心得提示：只比六壬盘象与占类，逐项列出相同之处；单案，不是规则
const test = require('node:test');
const assert = require('node:assert/strict');
const XD = require('../core/liuren/xinde.js');

// 2026-10-30 午时丁丑日卯将：冬蛇掩目，子辰戌；旬空申酉
const base = { riZhu: '丁丑', yueJiang: '卯', shiZhi: '午', xunKong: ['申', '酉'], ui: '健康' };
const rec = (id, o) => ({ id, createdAt: o.at || '2026-11-01T00:00:00Z', input: { ui: o.ui || '健康' },
  chart: { siZhu: { day: o.day || '丁丑', time: '丙' + (o.shi || '午') } },
  liuren: { yueJiang: o.yj || '卯', xunKong: o.kong || ['申', '酉'] },
  votes: [{ rule: 7, gui: o.gui ? { zhi: '亥' } : null }],
  review: o.lesson === null ? null : { lesson: o.lesson || '心得', misweighted: o.mw || [], misreads: [] } });

test('盘象逐项：占类、少见课体、初传末传落空、初传天将六亲、干上神对日干、贵人冲空', () => {
  const f = XD.features(base).map((x) => x.label);
  assert.ok(f.includes('同占类「健康」'));
  assert.ok(f.includes('课体同为昴星'));
  assert.ok(f.includes('初传乘螣蛇'));
  assert.ok(f.includes('初传为官'));
  assert.ok(f.includes('干生上神'));
  assert.ok(!f.includes('初传落旬空'));
  const g = XD.features(Object.assign({}, base, { xunKong: ['子', '丑'], gui: true })).map((x) => x.label);
  assert.ok(g.includes('初传落旬空') && g.includes('贵人冲奇门空亡宫'));
});

test('找相近：未复盘的不列；只同占类不列；分数不到门槛不列；最多三例，分高者先', () => {
  const cur = XD.features(base);
  const recs = [
    rec('same', { lesson: '同盘心得' }),
    rec('noreview', { lesson: null }),
    rec('uionly', { day: '甲子', yj: '亥', shi: '寅', lesson: '只同占类' }),
    rec('other-ui', { ui: '财运', lesson: '别的占类同盘' }),
  ];
  const m = XD.match(cur, recs);
  const ids = m.map((x) => x.rec.id);
  assert.deepEqual(ids, ['same', 'other-ui']);
  assert.ok(m[0].score > m[1].score);
  assert.ok(m[0].shared.includes('同占类「健康」') && !m[1].shared.includes('同占类「健康」'));
  assert.deepEqual(XD.match(cur, recs, { excludeId: 'same' }).map((x) => x.rec.id), ['other-ui']);
  const many = Array.from({ length: 6 }, (_, i) => rec('r' + i, {}));
  assert.equal(XD.match(cur, many).length, XD.MAX);
});

test('复盘里点名的六壬条目随心得列出（旬空、贵人、六壬推理、规则 7）；奇门条目不列', () => {
  const r = rec('x', { mw: [{ itemId: 'xk', how: 'missed', why: '旬空辰巳' }, { itemId: 'g2', how: 'overrated', why: '坤宫' }, { itemId: 'tl-fadian', how: 'underrated', why: '初传乘蛇' }] });
  const m = XD.match(XD.features(base), [r]);
  assert.deepEqual(m[0].notes.map((n) => n.itemId), ['xk', 'tl-fadian']);
});
