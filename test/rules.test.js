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

test('规则 1–6 在真实转盘上都给出合法输出', () => {
  const iso = '2026-10-28T15:30:00+08:00';
  const ch = zhuan(iso);
  const r = Rules.evaluate({ chart: ch, wangshuai: WangShuai.analyze(ch), domain: 'wealth', date: new Date(iso), nianMing: '戊辰' });
  assert.equal(r.appliesTo, 'chuanren-exp');
  assert.equal(r.yueJiang.yueJiang, '卯');         // 霜降后卯将
  assert.equal(r.yueJiang.status, '待核');
  assert.deepEqual(r.rules.map((x) => x.rule), [1, 2, 3, 4, 5, 6]);
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
  const tally = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
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

test('规则 1、2、5、6 不读三传：结果与三传无关', () => {
  const src = fs.readFileSync(path.join(__dirname, '../core/rules.js'), 'utf8');
  const i1 = src.indexOf('// 规则 1：'), i3 = src.indexOf('// 第二层：四课三传'), i5 = src.indexOf('// 规则 5：'), iEnd = src.indexOf('  return {\n    version');
  for (const seg of [src.slice(i1, i3), src.slice(i5, iEnd)]) assert.doesNotMatch(seg, /\bsc\b|sanChuan|SanChuan|\bmo\b|moGong/);
});

test('规则 3：末传所临之宫对我宫查计票表；规则 4：事宫奇门空亡才投票', () => {
  let n3 = 0, n4 = 0, n4kong = 0;
  for (const iso of sampleDates(300)) {
    const ch = zhuan(iso), ws = WangShuai.analyze(ch);
    const r = Rules.evaluate({ chart: ch, wangshuai: ws, domain: 'wealth', date: new Date(iso) });
    const by = Object.fromEntries(r.rules.map((x) => [x.rule, x]));
    const T = require('../core/liuren/tiandipan.js');
    if (by[3].applicable) {
      n3++;
      const ln = T.build({ riGan: ch.siZhu.day[0], yueJiang: r.yueJiang.yueJiang, shiZhi: ch.siZhu.time[1] });
      assert.equal(by[3].mo, r.sanChuan.chuan[2]);
      assert.equal(by[3].moGong, T.ZHI_GONG[ln.diUnder(by[3].mo)]);
      assert.deepEqual({ relation: by[3].relation, vote: by[3].vote }, Rules.relationVote(GONG_WX[by[3].R], GONG_WX[by[3].moGong]));
    }
    const yKong = !!(ws.gongs[r.quYong.Y] || {}).kongWang;
    assert.equal(by[4].applicable, yKong);
    if (yKong) { n4++; if (by[4].moKong) { n4kong++; assert.equal(by[4].vote, -1); } else { assert.equal(by[4].vote, 1); assert.ok(by[4].yingQi); } }
  }
  assert.ok(n3 > 250 && n4 > 20 && n4kong > 0, `规则3 ${n3}、规则4 ${n4}（末传亦空 ${n4kong}）`);
});

test('月将：中气前后各一分钟', () => {
  assert.equal(YueJiang.of(new Date('2026-10-23T17:37:00+08:00')).yueJiang, '辰');
  assert.equal(YueJiang.of(new Date('2026-10-23T17:38:30+08:00')).yueJiang, '卯');
  assert.equal(YueJiang.of(new Date('2026-02-19T00:00:00+08:00')).yueJiang, '亥');
  assert.equal(YueJiang.of(new Date('2026-01-05T10:00:00+08:00')).yueJiang, '丑');
});

test('月将：王雷之百例 19 个有日期的例子全部按中气切换（其中例42、57、62 离中气不足 4 天）', () => {
  const D = [['例39', '2003-01-05T13:00', '丑'], ['例40', '2003-05-03T14:00', '酉'], ['例41', '2003-08-12T09:00', '午'], ['例42', '2003-06-18T10:00', '申'],
    ['例44', '2002-04-23T12:00', '酉'], ['例46', '2003-05-14T10:00', '酉'], ['例47', '2002-01-10T15:00', '丑'], ['例49', '2004-03-02T10:00', '亥'],
    ['例50', '2004-03-15T17:00', '亥'], ['例51', '2004-06-07T10:00', '申'], ['例52', '2003-07-16T10:00', '未'], ['例56', '2002-12-08T12:00', '寅'],
    ['例57', '2003-03-22T08:00', '戌'], ['例59', '2000-09-10T22:30', '巳'], ['例60', '2001-11-18T14:00', '卯'], ['例61', '2002-10-02T11:00', '辰'],
    ['例62', '2002-11-20T14:00', '卯'], ['例63', '2004-01-09T12:55', '丑'], ['例66', '2002-11-26T12:00', '寅']];
  for (const [id, t, j] of D) assert.equal(YueJiang.of(new Date(t + ':00+08:00')).yueJiang, j, id);
});
