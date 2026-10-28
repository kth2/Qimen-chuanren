const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

global.window = global.window || {};
require('../vendor/qimen-pwa/engine.bundle.js');
const QM = global.window.QM;
const WuXing = require('../vendor/qimen-pwa/core/wuxing.js');
const WangShuai = require('../vendor/qimen-pwa/core/wangshuai.js');
const Rules = require('../core/rules.js');
const YueJiang = require('../core/liuren/yuejiang.js');

const GONG_WX = { 1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火' };
const zhuan = (iso) => QM.qimen.calculate(new Date(iso), { type: '四柱', method: '时家', purpose: '综合', location: '默认位置' });
const fei = (iso) => QM.feipanQimen.calculate(new Date(iso), { method: '时家', purpose: '综合' });

function sampleDates(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(new Date(Date.UTC(2024, 0, 1) + i * 37 * 3600 * 1000 + (i % 7) * 600 * 1000).toISOString());
  return out;
}

test('移植的五行打分与上游 WuXing.score() 逐盘逐宫一致（宫五行输入时）', () => {
  let n = 0;
  for (const iso of sampleDates(120)) {
    for (const ch of [zhuan(iso), fei(iso)]) {
      if (ch.error) continue;
      const ws = WangShuai.analyze(ch);
      for (let R = 1; R <= 9; R++) for (let Y = 1; Y <= 9; Y++) {
        const up = WuXing.score(ch, ws, String(R), String(Y));
        const mine = Rules.wuxingScore(ch, ws, String(R), String(Y), GONG_WX[R], GONG_WX[Y]);
        assert.equal(mine.score, up.score, `${iso} R${R} Y${Y}`);
        assert.equal(mine.relation, up.relation);
        n++;
      }
    }
  }
  assert.ok(n > 10000, '比对数量 ' + n);
});

test('规则 1、2、5、6 在真实转盘上都给出合法输出', () => {
  const iso = '2026-10-28T15:30:00+08:00';
  const ch = zhuan(iso);
  const r = Rules.evaluate({ chart: ch, wangshuai: WangShuai.analyze(ch), domain: 'wealth', date: new Date(iso), nianMing: '戊辰' });
  assert.equal(r.appliesTo, 'chuanren-exp');
  assert.equal(r.yueJiang.yueJiang, '卯');         // 霜降后卯将
  assert.equal(r.yueJiang.status, '待核');
  assert.deepEqual(r.rules.map((x) => x.rule), [1, 2, 5, 6]);
  for (const x of r.rules.filter((x) => x.rule !== 5)) assert.ok([-1, 0, 1].includes(x.vote), JSON.stringify(x));
  const r5 = r.rules.find((x) => x.rule === 5);           // 规则 5 只出方位，不投票
  assert.ok(r5.secondGongs.length >= 1 && r5.secondGongs.length <= 2);
  assert.equal(r.quYong.Y, String(Object.keys(ch.baMen).find((g) => ch.baMen[g] === '生门'))); // 求财取生门宫
  assert.deepEqual(r.liuren.xunKong, ['申', '酉']);  // 乙亥日，甲戌旬
});

test('飞盘未给年命：依赖「我」的规则 2 弃权，规则 1、5 照用事宫', () => {
  const iso = '2026-10-28T15:30:00+08:00';
  const ch = fei(iso);
  const r = Rules.evaluate({ chart: ch, wangshuai: WangShuai.analyze(ch), date: new Date(iso), feipan: { shiGanGong: 4 } });
  assert.equal(r.school, 'feipan');
  const by = Object.fromEntries(r.rules.map((x) => [x.rule, x]));
  assert.equal(by[2].applicable, false);
  assert.equal(by[6].applicable, false);
  assert.equal(by[5].qimenGong, 4);
});

test('规则 6：本命上神对事宫天盘支查生克计票表，并记原始关系', () => {
  assert.deepEqual(Rules.relationVote('木', '水'), { relation: '事生我', vote: 1 });
  assert.deepEqual(Rules.relationVote('木', '土'), { relation: '我克事', vote: 1 });
  assert.deepEqual(Rules.relationVote('木', '金'), { relation: '事克我', vote: -1 });
  assert.deepEqual(Rules.relationVote('木', '火'), { relation: '我生事', vote: -1 });
  assert.deepEqual(Rules.relationVote('木', '木'), { relation: '比和', vote: 1 });
});

test('批量：各规则票值只取 −1/0/+1，弃权必附理由', () => {
  const tally = { 1: 0, 2: 0, 5: 0, 6: 0 };
  for (const iso of sampleDates(200)) {
    const ch = zhuan(iso);
    const r = Rules.evaluate({ chart: ch, wangshuai: WangShuai.analyze(ch), domain: 'career', date: new Date(iso), nianMing: '庚午' });
    for (const x of r.rules) {
      if (x.applicable) tally[x.rule]++;
      else assert.ok(x.reason, JSON.stringify(x));
    }
  }
  for (const k in tally) assert.ok(tally[k] > 0, '规则 ' + k + ' 从未适用');
});

test('第一层规则不调用四课三传', () => {
  const src = fs.readFileSync(path.join(__dirname, '../core/rules.js'), 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
  assert.doesNotMatch(src, /sanChuan|siKe|sike|sanchuan|三传|四课/);
});

test('月将：中气前后各一分钟', () => {
  assert.equal(YueJiang.of(new Date('2026-10-23T17:37:00+08:00')).yueJiang, '辰');
  assert.equal(YueJiang.of(new Date('2026-10-23T17:38:30+08:00')).yueJiang, '卯');
  assert.equal(YueJiang.of(new Date('2026-02-19T00:00:00+08:00')).yueJiang, '亥');
  assert.equal(YueJiang.of(new Date('2026-01-05T10:00:00+08:00')).yueJiang, '丑');
});
