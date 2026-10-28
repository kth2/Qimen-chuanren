const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const CM = require('../core/liuren/casematch.js');
const SC = require('../core/liuren/sanchuan.js');
const GEN = require('../scripts/gen-cases.js');

const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const BOOK = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledge/liuren-cases.json'), 'utf8'));
const byId = (id) => BOOK.cases.find((c) => c.id === id);

test('案例库与手录同步（改了 data/cases 要重跑 npm run gen:cases）', () => {
  assert.deepEqual(GEN.build().out, BOOK.cases);
  assert.equal(BOOK._count, BOOK.cases.length);
});

test('每例：位差合法，本 app 三传由日柱与位差重算可得', () => {
  const ids = new Set();
  for (const c of BOOK.cases) {
    assert.ok(!ids.has(c.id), '重复编号 ' + c.id); ids.add(c.id);
    assert.ok(Number.isInteger(c.diff) && c.diff >= 0 && c.diff < 12, c.id);
    const r = SC.compute({ riGan: c.riZhu[0], riZhi: c.riZhu[1], yueJiang: ZHI[c.diff], shiZhi: '子' });
    assert.equal(r.chuan.join(''), c.chuanEngine, c.id);
    assert.ok(c.q && c.page, c.id + ' 缺问事或页码');
  }
});

test('原书例是金标：书中三传与本 app 不同者必须标出，且有说明', () => {
  for (const c of BOOK.cases) {
    if (!c.chuanBook) continue;
    const differs = c.chuanBook !== c.chuanEngine;
    assert.equal(c.flags.includes('书中三传与本 app 不同'), differs, c.id);
    if (differs) assert.ok(c.bookNote, c.id + ' 三传与书不同却无说明');
  }
});

test('匹配：全同、同课、同三传分级，同一例只归一级', () => {
  // 伍-10：庚午日 丑将丑时 伏吟
  const quan = CM.match(BOOK.cases, { riZhu: '庚午', yueJiang: '丑', shiZhi: '丑', chuan: ['申', '寅', '巳'] });
  assert.ok(quan.quanTong.some((c) => c.id === '伍-10'));
  assert.ok(!quan.tongChuan.some((c) => c.id === '伍-10'));
  // 同日柱、同位差（寅将寅时仍伏吟）→ 同课
  const ke = CM.match(BOOK.cases, { riZhu: '庚午', yueJiang: '寅', shiZhi: '寅', chuan: ['申', '寅', '巳'] });
  assert.ok(ke.tongKe.some((c) => c.id === '伍-10'));
  assert.ok(!ke.quanTong.some((c) => c.id === '伍-10'));
  // 伍-3（甲子日 辰申子）与 伍-32（甲子日 巳将丑时 辰申子）同课；换个日柱、三传仍辰申子 → 同三传
  const ch = CM.match(BOOK.cases, { riZhu: '庚辰', yueJiang: '子', shiZhi: '子', chuan: '辰申子' });
  assert.ok(ch.tongChuan.some((c) => c.id === '伍-3'));
  assert.equal(ch.total, ch.quanTong.length + ch.tongKe.length + ch.tongChuan.length);
});

test('匹配：缺日柱、月将或占时不匹配；位差 = 月将 − 占时', () => {
  assert.equal(CM.match(BOOK.cases, { riZhu: '庚午', shiZhi: '丑' }).total, 0);
  assert.equal(CM.diffOf('丑', '丑'), 0);
  assert.equal(CM.diffOf('子', '亥'), 1);
  assert.equal(CM.diffOf('亥', '子'), 11);
  assert.equal(byId('伍-21').riZhu, '己未');   // 课图日干印误，以六亲反推（见 bookNote）
});
