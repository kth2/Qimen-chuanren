const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../core/liuren/xiangyi.js');

test('六亲：以日干为我，克我者阴阳异为官、同为鬼', () => {
  assert.equal(X.liuQin('甲', '子'), '父母');
  assert.equal(X.liuQin('甲', '午'), '子孙');
  assert.equal(X.liuQin('甲', '辰'), '财');
  assert.equal(X.liuQin('甲', '卯'), '兄弟');
  assert.equal(X.liuQin('甲', '酉'), '官');   // 阴金克阳木
  assert.equal(X.liuQin('甲', '申'), '鬼');   // 阳金克阳木
  assert.equal(X.liuQin('乙', '申'), '官');
  assert.equal(X.liuQin('乙', '酉'), '鬼');
});

test('十二天将 × 六亲：书中有载者取组合义，未载者回落基本义', () => {
  assert.equal(Object.keys(X.TABLE).length, 12);
  assert.deepEqual(X.read('六合', '辰', '甲'), { liuQin: '财', text: '可以合作，合作成功', fromBase: false });
  assert.equal(X.read('贵人', '午', '甲').fromBase, true);   // 书中贵人条未说子孙
  for (const j in X.TABLE) for (const g of '甲乙丙丁戊己庚辛壬癸') for (const z of '子丑寅卯辰巳午未申酉戌亥') assert.ok(X.read(j, z, g).text);
});
