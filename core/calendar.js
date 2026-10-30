/**
 * 奇门穿壬 · 万年历（纯函数）。历法全用 tyme4ts（6tail），与排盘同一套：
 *   · 年柱以立春换年，月柱以节换月（都在交节那一刻换，交节当天前后不同），日柱以零点换日；
 *     23:00 后的夜子时算次日（与奇门引擎一致）。
 * 调用方把 tyme4ts 传进来（浏览器是全局 tyme4ts，Node 是 require('tyme4ts')），本文件不自己载入。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChuanRenCalendar = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WEEK = '日一二三四五六';
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  /** 一天的格子：公历、农历（初一显示月名）、日干支、节气、节日 */
  function cell(T, y, m, d) {
    const sd = T.SolarDay.fromYmd(y, m, d);
    const ld = sd.getLunarDay();
    const lm = ld.getLunarMonth();
    const td = sd.getTermDay();
    const term = td.getDayIndex() === 0 ? td.getSolarTerm().getName() : '';
    const fs = sd.getFestival(), fl = ld.getFestival();
    return {
      date: ymd(y, m, d), y, m, d,
      lunar: ld.getName() === '初一' ? lm.getName() : ld.getName(),
      lunarFull: ld.toString(),
      dayGZ: sd.getSixtyCycleDay().getSixtyCycle().getName(),
      term,
      festival: [fl && fl.getName(), fs && fs.getName()].filter(Boolean).join('·'),
      week: sd.getWeek().getIndex(),   // 0＝周日
    };
  }

  /**
   * 一个月的月历：一周从周一排起，前后用上下月补满整周。
   * @returns { y, m, title, cells: [cell & { inMonth }], terms: [{ name, date }], yearGZs }
   */
  function month(T, y, m) {
    const first = T.SolarDay.fromYmd(y, m, 1);
    const days = T.SolarMonth.fromYm(y, m).getDayCount();
    const lead = (first.getWeek().getIndex() + 6) % 7;   // 周一为 0
    const cells = [];
    for (let i = lead; i > 0; i--) {
      const sd = first.next(-i);
      cells.push(Object.assign(cell(T, sd.getYear(), sd.getMonth(), sd.getDay()), { inMonth: false }));
    }
    for (let d = 1; d <= days; d++) cells.push(Object.assign(cell(T, y, m, d), { inMonth: true }));
    let last = T.SolarDay.fromYmd(y, m, days);
    while (cells.length % 7) { last = last.next(1); cells.push(Object.assign(cell(T, last.getYear(), last.getMonth(), last.getDay()), { inMonth: false })); }
    const terms = cells.filter((c) => c.inMonth && c.term).map((c) => ({ name: c.term, date: c.date }));
    const yearGZs = [...new Set(cells.filter((c) => c.inMonth).map((c) => T.SolarDay.fromYmd(c.y, c.m, c.d).getSixtyCycleDay().getYear().getName()))];
    return { y, m, title: `${y} 年 ${m} 月`, cells, terms, yearGZs, weekHead: '一二三四五六日'.split('') };
  }

  /** 一天的详情：年月日柱、农历、节气、十二时辰的时柱（含 23 点后的夜子时，算次日） */
  function day(T, y, m, d) {
    const c = cell(T, y, m, d);
    const sd = T.SolarDay.fromYmd(y, m, d);
    const scd = sd.getSixtyCycleDay();
    const term = sd.getTermDay();
    const hourGZ = (h) => T.SolarTime.fromYmdHms(y, m, d, h, 0, 0).getSixtyCycleHour();
    const H = (h, o) => { const x = hourGZ(h); return Object.assign({ gz: x.getSixtyCycle().getName(), yearGZ: x.getYear().getName(), monthGZ: x.getMonth().getName(), h }, o); };
    const hours = [H(0, { zhi: '子', label: '早子', range: '00:00–00:59' })];
    for (let i = 1; i < 12; i++) {
      const h = i * 2;   // 丑 1–3 点取 2 点，……亥 21–23 点取 22 点
      hours.push(H(h, { zhi: ZHI[i], label: ZHI[i], range: `${pad(h - 1)}:00–${pad(h)}:59` }));
    }
    const late = hourGZ(23);
    hours.push(H(23, { zhi: '子', label: '夜子', range: '23:00–23:59', nextDay: late.getDay().getName() }));
    // 交「节」当天：年柱（立春）、月柱在交节那一刻换，前后不同，要按出生时刻分
    let jie = null;
    if (term.getDayIndex() === 0 && term.getSolarTerm().isJie()) {
      // 交节落在哪个时辰里：那个时辰前后半截的年月柱不同
      const st0 = term.getSolarTerm().getJulianDay().getSolarTime(), mins = st0.getHour() * 60 + st0.getMinute();
      for (const h of hours) {
        const [a, b] = h.range.split('–').map((t) => +t.slice(0, 2) * 60 + +t.slice(3, 5));
        if (mins >= a && mins <= b) h.jieInside = true;
      }
      const st = term.getSolarTerm().getJulianDay().getSolarTime();
      const before = T.SolarTime.fromYmdHms(y, m, d, 0, 0, 0).getSixtyCycleHour(), after = T.SolarTime.fromYmdHms(y, m, d, 23, 59, 0).getSixtyCycleHour();
      jie = { name: term.getSolarTerm().getName(), time: `${pad(st.getHour())}:${pad(st.getMinute())}`,
        before: { yearGZ: before.getYear().getName(), monthGZ: before.getMonth().getName() },
        after: { yearGZ: after.getYear().getName(), monthGZ: after.getMonth().getName() } };
    }
    return Object.assign(c, {
      week: '星期' + WEEK[c.week],
      yearGZ: scd.getYear().getName(), monthGZ: scd.getMonth().getName(),
      termNow: term.getSolarTerm().getName() + (term.getDayIndex() ? ` 第 ${term.getDayIndex() + 1} 天` : ' 当天'),
      jie, hours,
    });
  }

  return { month, day, cell, ymd };
});
