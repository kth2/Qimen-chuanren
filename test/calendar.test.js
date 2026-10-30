const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('tyme4ts');
const C = require('../core/calendar.js');

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
