// 六壬术语白话卡：每张有《探原》原文与书页；面板句子里认得出术语
const test = require('node:test');
const assert = require('node:assert/strict');
const CD = require('../core/liuren/cidian.js');
const TL = require('../core/liuren/tuili.js');
const SC = require('../core/liuren/sanchuan.js');
const TDP = require('../core/liuren/tiandipan.js');

test('每张卡有标题、白话、原文、《探原》书页；id 不重复', () => {
  const ids = new Set();
  for (const t of CD.TERMS) {
    assert.ok(t.title && t.bai && t.yuan, t.id);
    assert.match(t.src, /^探原 /, t.id);
    assert.ok(!ids.has(t.id), '重复 ' + t.id); ids.add(t.id);
  }
  for (const k in CD.STEP_TERM) assert.ok(CD.BY_ID[CD.STEP_TERM[k]], k);
});

test('认术语：先长后短；单字刑冲破害只在「用刑」「时为日破」之类处认', () => {
  const ids = (s) => CD.find(s).map((h) => h.id);
  assert.deepEqual(ids('干上神克干，大凶。'), ['shangshen']);
  assert.ok(ids('初传丙子乘螣蛇（官），落旬空').includes('liuqin'));
  assert.ok(ids('初传丙子乘螣蛇（官），落旬空').includes('kong'));
  assert.deepEqual(ids('时为日破：主破财走失。'), ['po']);
  assert.deepEqual(ids('事情冲荡不定').filter((x) => x === 'chong'), []);
  assert.ok(ids('末传戌所冲辰为散期').includes('chong'));
});

test('六壬推理每一门、每句都能配上卡；「先看这几条」四条照《探原》书页 61–63、72', () => {
  const sc = SC.compute({ riGan: '丁', riZhi: '丑', yueJiang: '卯', shiZhi: '午' });
  const r = TL.analyze({ sc, riZhu: '丁丑', yueZhi: '戌', xunKong: TDP.xunKong('丁丑'), nianMing: '庚午' });
  assert.deepEqual(r.focus.map((x) => x.src), ['探原 63', '探原 62', '探原 61', '探原 72']);
  assert.match(r.focus[0].text, /^初传 丙子乘螣蛇（官），戌月死。书言发用「能左右四课之祸福/);
  assert.match(r.focus[2].text, /干上神 辰 对日干丁：干生上神，虚耗百出/);
  assert.match(r.focus[3].text, /本旬空亡申、酉/);
  for (const st of r.steps) if (CD.STEP_TERM[st.key]) assert.ok(CD.BY_ID[CD.STEP_TERM[st.key]]);
  const hit = r.steps.flatMap((s) => s.items).filter((it) => CD.find(it.text).length).length;
  assert.ok(hit >= 20, '面板句子大多应有可点的术语：' + hit);
});
