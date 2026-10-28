// 第二层：四课三传。用两本书的实例逐例比对。
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../core/liuren/sanchuan.js');
const F = require('./fixtures/sanchuan-cases.json');

const run = (rz, yj, sz, opts) => S.compute({ riGan: rz[0], riZhi: rz[1], yueJiang: yj, shiZhi: sz }, opts);
const KNOWN_CONFLICT = { '例 财产（p70）': '子辰戌' };   // 书中此例与本书口诀相反，见 sanchuan.js 注

test(`王雷之《实占百例》${F.wang.length} 例三传逐例一致`, () => {
  for (const [id, rz, yj, sz, exp] of F.wang) assert.equal(run(rz, yj, sz).chuan.join(''), exp, id + ' ' + rz);
});

test(`伍剑虹《精义讲解》${F.wu.length} 例：除一例书中自相矛盾外逐例一致`, () => {
  for (const [id, rz, yj, sz, exp] of F.wu) {
    const got = run(rz, yj, sz).chuan.join('');
    if (KNOWN_CONFLICT[id]) { assert.equal(got, KNOWN_CONFLICT[id], id); assert.notEqual(got, exp); continue; }
    assert.equal(got, exp, id + ' ' + rz);
  }
  for (const [id, rz, yj, sz, exp] of F.wuPartial) assert.equal(run(rz, yj, sz).chuan[0], exp, id);
});

test('九宗门都有覆盖', () => {
  const seen = new Set();
  for (const set of ['wang', 'wu']) for (const [, rz, yj, sz] of F[set]) seen.add(run(rz, yj, sz).name.replace(/（.*）/, ''));
  for (const n of ['元首', '重审', '知一', '涉害', '遥克', '昴星', '别责', '伏吟', '返吟']) assert.ok(seen.has(n), '缺 ' + n);
});

test('涉害两法：《六壬大全》之例（丁卯日）深浅法取亥，孟仲法取丑', () => {
  assert.equal(run('丁卯', '巳', '未').chuan.join(''), '亥酉未');
  assert.equal(run('丁卯', '巳', '未', { sheHai: 'mengzhong' }).chuan[0], '丑');
  // 王雷之例68、76，伍剑虹课式三：两法同答
  for (const [rz, yj, sz] of [['丁亥', '丑', '巳'], ['甲戌', '未', '酉'], ['戊辰', '子', '巳']]) {
    assert.equal(run(rz, yj, sz).chuan.join(''), run(rz, yj, sz, { sheHai: 'mengzhong' }).chuan.join(''), rz);
  }
});

test('伏吟壬辰、壬午两说', () => {
  assert.equal(run('壬辰', '子', '子').chuan.join(''), '亥巳申');
  assert.equal(run('壬辰', '子', '子', { fuYinRen: 'zhinan' }).chuan.join(''), '亥辰戌');
  assert.equal(run('壬午', '子', '子', { fuYinRen: 'zhinan' }).chuan.join(''), '亥午子');
  assert.equal(run('壬子', '子', '子').chuan.join(''), '亥子卯');   // 其余四壬：日先辰后次末刑
  assert.equal(run('甲子', '子', '子').chuan.join(''), '寅巳申');   // 六甲伏吟寅巳申
  assert.equal(run('庚子', '子', '子').chuan.join(''), '申寅巳');
  assert.equal(run('癸亥', '子', '子').chuan[0], '丑');             // 六癸克发用
});

test('全部 60 日 × 12 将 × 12 时都排得出三传，且三传都是地支', () => {
  const G = '甲乙丙丁戊己庚辛壬癸', Z = '子丑寅卯辰巳午未申酉戌亥';
  let n = 0;
  for (let i = 0; i < 60; i++) for (const yj of Z) for (const sz of Z) {
    const r = run(G[i % 10] + Z[i % 12], yj, sz);
    assert.equal(r.chuan.length, 3);
    for (const c of r.chuan) assert.ok(Z.includes(c) && c.length === 1, JSON.stringify(r.chuan));
    n++;
  }
  assert.equal(n, 8640);
});
