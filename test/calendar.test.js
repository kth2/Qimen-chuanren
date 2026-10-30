const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('tyme4ts');
const C = require('../vendor/qimen-pwa/core/calendar.js')   // 与奇门 app 共用一份;

global.window = global.window || {};
require('../vendor/qimen-pwa/engine.bundle.js');
const QM = global.window.QM;
const zhuan = (dt) => QM.qimen.calculate(dt, { type: '四柱', method: '时家', purpose: '综合', location: '默认位置' }).siZhu;

test('月历：周一起排、补满整周；节气、农历初一显示月名', () => {
  const mo = C.month(T, 2026, 10);
  assert.equal(mo.cells.length % 7, 0);
  assert.equal(mo.cells[0].date, '2026-09-28');            // 10 月 1 日周四，前补周一到周三
  assert.equal(mo.cells.filter((c) => c.inMonth).length, 31);
  assert.deepEqual(mo.terms, [{ name: '寒露', date: '2026-10-08' }, { name: '霜降', date: '2026-10-23' }]);
  assert.equal(mo.cells.find((c) => c.date === '2026-10-10').lunar, '九月');
  assert.equal(mo.cells.find((c) => c.date === '2026-10-01').festival, '国庆节');
});

test('年柱立春换、月柱节换', () => {
  assert.equal(C.day(T, 2024, 2, 3).yearGZ, '癸卯');
  assert.equal(C.day(T, 2024, 2, 4).yearGZ, '甲辰');
  assert.equal(C.day(T, 2026, 10, 7).monthGZ, '丁酉');      // 寒露前
  assert.equal(C.day(T, 2026, 10, 8).monthGZ, '戊戌');      // 寒露当天换月
});

test('四柱与时辰：与奇门引擎排出的四柱逐时一致（含夜子时算次日）', () => {
  for (const [y, m, d] of [[2026, 10, 30], [2024, 2, 4], [2001, 1, 1], [1999, 12, 31]]) {
    const x = C.day(T, y, m, d);
    for (const h of x.hours) {
      const sz = zhuan(new Date(y, m - 1, d, h.h, 30));
      assert.equal(h.gz, sz.time, `${y}-${m}-${d} ${h.label}`);
      if (!h.nextDay) assert.equal(x.dayGZ, sz.day, `${y}-${m}-${d} ${h.label} 日柱`);
      else assert.equal(h.nextDay, sz.day, '夜子时算次日');
    }
    for (const h of x.hours) {
      const sz = zhuan(new Date(y, m - 1, d, h.h, 0));   // 与万年历同一取样时刻（交节所在时辰前后半截不同）
      assert.equal(h.yearGZ, sz.year, `${y}-${m}-${d} ${h.label} 年柱`);
      assert.equal(h.monthGZ, sz.month, `${y}-${m}-${d} ${h.label} 月柱`);
    }
  }
});

test('交节当天：给出交节时刻与前后年月柱（立春 2024-02-04 16:27）', () => {
  const x = C.day(T, 2024, 2, 4);
  assert.deepEqual(x.jie, { name: '立春', time: '16:27', before: { yearGZ: '癸卯', monthGZ: '乙丑' }, after: { yearGZ: '甲辰', monthGZ: '丙寅' } });
  assert.deepEqual(x.hours.filter((h) => h.jieInside).map((h) => h.label), ['申']);
  assert.equal(C.day(T, 2024, 2, 19).jie, null);   // 雨水是中气，不换月
  assert.equal(C.day(T, 2024, 2, 5).jie, null);
});

test('四柱反查：四柱到时辰；子时含前一天夜子；三柱只列日子；不相配的四柱查无', () => {
  assert.deepEqual(C.parsePillars('丙午年 戊戌月，丁丑 乙巳 甲丑'), { pillars: ['丙午', '戊戌', '丁丑', '乙巳'], bad: ['甲丑'] });
  assert.deepEqual(C.hourPillars('丁丑'), ['庚子', '辛丑', '壬寅', '癸卯', '甲辰', '乙巳', '丙午', '丁未', '戊申', '己酉', '庚戌', '辛亥']);
  const r = C.findByPillars(T, ['丙午', '戊戌', '丁丑', '乙巳'], 1800, 2200);
  assert.deepEqual(r.results.map((x) => x.date + ' ' + x.time), ['1846-10-14 10:00', '2026-10-30 10:00', '2086-10-15 10:00']);
  const zi = C.findByPillars(T, ['丙午', '戊戌', '戊寅', '壬子'], 2000, 2100).results.map((x) => x.date + ' ' + x.time);
  assert.deepEqual(zi, ['2026-10-30 23:00', '2026-10-31 00:00', '2086-10-15 23:00', '2086-10-16 00:00']);
  for (const s of zi) {   // 逐一用奇门引擎排一次，四柱须完全对上
    const sz = zhuan(new Date(s.replace(' ', 'T') + ':00'));
    assert.equal([sz.year, sz.month, sz.day, sz.time].join(' '), '丙午 戊戌 戊寅 壬子', s);
  }
  assert.deepEqual(C.findByPillars(T, ['丙午', '戊戌', '丁丑'], 2000, 2100).results.map((x) => x.date), ['2026-10-30', '2086-10-15']);
  assert.equal(C.findByPillars(T, ['丙午', '甲子', '丁丑', '乙巳']).results.length, 0);   // 丙年无甲子月
  assert.equal(C.findByPillars(T, ['丙午', '戊戌']).ok, false);
});

test('下拉选项：六十甲子；五虎遁定月柱；五鼠遁定时柱；所列组合都查得到', () => {
  assert.equal(C.JIAZI.length, 60);
  assert.equal(C.JIAZI[59], '癸亥');
  assert.deepEqual(C.monthPillars('丙午'), ['庚寅', '辛卯', '壬辰', '癸巳', '甲午', '乙未', '丙申', '丁酉', '戊戌', '己亥', '庚子', '辛丑']);
  assert.equal(C.monthPillars('甲子')[0], '丙寅');
  assert.equal(C.monthPillars('戊辰')[0], '甲寅');
  // 每个年干的 12 个月柱，都至少在 1800–2200 年间某年出现（证明下拉不会给出不存在的组合）
  for (const yg of ['甲子', '乙丑', '丙寅', '丁卯', '戊辰']) {
    for (const mg of C.monthPillars(yg)) {
      const r = C.findByPillars(T, [yg, mg, C.JIAZI.find((d) => C.findByPillars(T, [yg, mg, d], 1800, 2200).results.length)], 1800, 2200);
      assert.ok(r.results.length > 0, yg + mg);
    }
  }
});
