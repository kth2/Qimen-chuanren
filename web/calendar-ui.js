/* 奇门穿壬 · 万年历界面
 * 月历：公历、农历（初一显示月名）、节气、节日、日干支；点一天看年月日柱与十二时辰（含夜子时算次日）。
 * 「用此日排盘」把日期填回排盘栏；「设为年命」把那天的年柱填进年命（查出生那天即得年命，立春换年已算好）。
 * 四柱反查：输入年月日（时）干支，列出 1800–2200 年间对得上的日子与时辰，可直接排盘。
 * 历法：core/calendar.js（tyme4ts，与排盘同一套）。 */
(function () {
  const CAL = window.ChuanRenCalendar, T = window.tyme4ts;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  if (!CAL || !T || !$('calBtn')) return;

  const now = new Date(), pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  let y, m, sel = '', findQ = '', findHtml = '';

  function openAt(dateStr) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr || '') ? dateStr : todayStr;
    y = +d.slice(0, 4); m = +d.slice(5, 7); sel = d;
    $('calPanel').style.display = 'block';
    draw();
  }
  function shift(k) { m += k; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } draw(); }

  function draw() {
    const mo = CAL.month(T, y, m);
    const ys = []; for (let i = 1900; i <= 2100; i++) ys.push(`<option${i === y ? ' selected' : ''}>${i}</option>`);
    const ms = []; for (let i = 1; i <= 12; i++) ms.push(`<option value="${i}"${i === m ? ' selected' : ''}>${i} 月</option>`);
    const cells = mo.cells.map((c) => {
      const sub = c.term ? `<div class="l t">${esc(c.term)}</div>` : c.festival ? `<div class="l f">${esc(c.festival)}</div>` : `<div class="l">${esc(c.lunar)}</div>`;
      const cls = ['cal-c', c.inMonth ? '' : 'out', c.date === todayStr ? 'today' : '', c.date === sel ? 'sel' : '', (c.week === 0 || c.week === 6) ? 'we' : ''].join(' ');
      return `<div class="${cls}" data-date="${c.date}"><div class="n">${c.d}</div>${sub}<div class="g">${esc(c.dayGZ)}</div></div>`;
    }).join('');
    $('calPanel').innerHTML = `
      <div class="cal-nav">
        <b>万年历</b>
        <button class="btn" type="button" data-cal="prev" style="padding:2px 8px;">◀</button>
        <select data-cal="y">${ys.join('')}</select><select data-cal="m">${ms.join('')}</select>
        <button class="btn" type="button" data-cal="next" style="padding:2px 8px;">▶</button>
        <button class="btn" type="button" data-cal="today" style="padding:2px 8px;background:#666;">今天</button>
        <button class="btn" type="button" data-cal="close" style="padding:2px 8px;background:#999;margin-left:auto;">✕ 收起</button>
      </div>
      <div class="cal-find">
        <input data-cal="q" value="${esc(findQ)}" placeholder="四柱反查：丙午 戊戌 丁丑 乙巳（时柱可省）">
        <button class="btn" type="button" data-cal="find" style="padding:2px 10px;">查找</button>
      </div>
      <div id="calFind">${findHtml}</div>
      <div class="muted" style="margin-top:4px;">年柱 ${mo.yearGZs.map(esc).join(' → ')}${mo.terms.length ? '　本月交节：' + mo.terms.map((t) => `${esc(t.name)} ${+t.date.slice(8)} 日`).join('、') : ''}
        <span style="font-size:11px;">（年柱以立春换，月柱以节换）</span></div>
      <div class="cal-grid">${mo.weekHead.map((w) => `<div class="cal-wh">${w}</div>`).join('')}${cells}</div>
      <div class="cal-d" id="calDay">${sel ? dayHtml(sel) : '<span class="muted">点一天看四柱与十二时辰。</span>'}</div>`;
  }

  function dayHtml(dateStr) {
    const [yy, mm, dd] = dateStr.split('-').map(Number);
    const x = CAL.day(T, yy, mm, dd);
    const hours = x.hours.map((h) => `<div>${esc(h.label)}时 <span class="muted">${esc(h.range)}</span> <b>${esc(h.gz)}</b>${h.nextDay ? `<span class="muted">（算次日 ${esc(h.nextDay)}）</span>` : ''}${h.jieInside ? `<span style="color:#8a6d3b;">（${esc(x.jie.time)} 交节，此时辰前后不同）</span>` : ''}</div>`).join('');
    const j = x.jie;
    const nmBtns = j && j.before.yearGZ !== j.after.yearGZ
      ? `<button class="btn" type="button" data-cal="nm" data-gz="${esc(j.before.yearGZ)}" style="background:#8a6d3b;">设为年命：${esc(j.time)} 前出生（${esc(j.before.yearGZ)}）</button>
         <button class="btn" type="button" data-cal="nm" data-gz="${esc(j.after.yearGZ)}" style="background:#8a6d3b;">${esc(j.time)} 后出生（${esc(j.after.yearGZ)}）</button>`
      : `<button class="btn" type="button" data-cal="nm" data-gz="${esc(x.yearGZ)}" style="background:#8a6d3b;">设为年命（年柱 ${esc(x.yearGZ)}）</button>`;
    return `<div><b>${esc(x.date)}</b> ${esc(x.week)}　${esc(x.lunarFull)}　<span class="muted">${esc(x.termNow)}</span>${x.festival ? '　' + esc(x.festival) : ''}</div>
      <div>年柱 <b>${esc(x.yearGZ)}</b>　月柱 <b>${esc(x.monthGZ)}</b>　日柱 <b>${esc(x.dayGZ)}</b></div>
      ${j ? `<div style="color:#8a6d3b;">今天 ${esc(j.time)} 交${esc(j.name)}：之前为 ${esc(j.before.yearGZ)}年 ${esc(j.before.monthGZ)}月，之后为 ${esc(j.after.yearGZ)}年 ${esc(j.after.monthGZ)}月。</div>` : ''}
      <div class="cal-h">${hours}</div>
      <div style="margin-top:6px;">
        <button class="btn" type="button" data-cal="use" data-date="${esc(x.date)}">用此日排盘</button>
        ${nmBtns}
        <div class="muted" style="font-size:11px;">排盘时间沿用排盘栏现有的时间。查年命：翻到出生那天按「设为年命」，立春前后已按立春换年算好。</div>
      </div>`;
  }

  /** 四柱反查：1800–2200 年间对得上的日子（给了时柱就到时辰） */
  function runFind() {
    const inp = $('calPanel').querySelector('input[data-cal="q"]');
    findQ = inp ? inp.value.trim() : findQ;
    const p = CAL.parsePillars(findQ);
    if (p.bad.length) { findHtml = `<div class="muted" style="color:#a94442;">${p.bad.map(esc).join('、')} 不是六十甲子（干支须同阴阳），请核对。</div>`; draw(); return; }
    if (p.pillars.length < 3 || p.pillars.length > 4) { findHtml = '<div class="muted">请照年、月、日（、时）的顺序给三柱或四柱，例：丙午 戊戌 丁丑 乙巳。</div>'; draw(); return; }
    const r = CAL.findByPillars(T, p.pillars, 1800, 2200);
    const head = `<b>${p.pillars.map(esc).join(' ')}</b>：`;
    if (!r.results.length) {
      findHtml = `<div class="muted">${head}1800–2200 年间找不到。月柱须与年干相配（五虎遁），${p.pillars[3] ? '时柱须与日干相配（五鼠遁，此日可用：' + CAL.hourPillars(p.pillars[2]).join(' ') + '），' : ''}请核对。</div>`;
    } else {
      const wk = (d) => '日一二三四五六'[T.SolarDay.fromYmd(+d.slice(0, 4), +d.slice(5, 7), +d.slice(8, 10)).getWeek().getIndex()];
      findHtml = `<div class="muted">${head}1800–2200 年间共 ${r.results.length} 处（六十年一轮）</div>` + r.results.map((x) =>
        `<div class="cal-hit"><b>${esc(x.date)}</b> 周${wk(x.date)}${x.label ? ` ${esc(x.label)} <span class="muted">${esc(x.range)}</span>` : ''}
          <button class="btn" type="button" data-cal="use" data-date="${esc(x.date)}"${x.time ? ` data-time="${esc(x.time)}"` : ''} style="padding:1px 8px;font-size:12px;">用此${x.time ? '时' : '日'}排盘</button>
          <button class="btn" type="button" data-cal="goto" data-date="${esc(x.date)}" style="padding:1px 8px;font-size:12px;background:#666;">看这天</button></div>`).join('');
    }
    draw();
  }

  $('calBtn').addEventListener('click', () => {
    if ($('calPanel').style.display === 'block') { $('calPanel').style.display = 'none'; return; }
    openAt($('inDate').value);
  });
  $('calPanel').addEventListener('change', (e) => {
    const k = e.target.dataset.cal;
    if (k === 'y') { y = +e.target.value; draw(); }
    if (k === 'm') { m = +e.target.value; draw(); }
  });
  $('calPanel').addEventListener('click', (e) => {
    const c = e.target.closest('.cal-c');
    if (c) {
      sel = c.dataset.date;
      const cy = +sel.slice(0, 4), cm = +sel.slice(5, 7);
      if (cy !== y || cm !== m) { y = cy; m = cm; }
      draw();
      return;
    }
    const b = e.target.closest('[data-cal]'); if (!b || b.tagName === 'SELECT') return;
    const k = b.dataset.cal;
    if (k === 'prev') shift(-1);
    else if (k === 'next') shift(1);
    else if (k === 'today') openAt(todayStr);
    else if (k === 'close') $('calPanel').style.display = 'none';
    else if (k === 'find') runFind();
    else if (k === 'goto') { sel = b.dataset.date; y = +sel.slice(0, 4); m = +sel.slice(5, 7); draw(); }
    else if (k === 'use') {
      $('inDate').value = b.dataset.date;
      if (b.dataset.time) $('inTime').value = b.dataset.time;
      $('calPanel').style.display = 'none';
      if (window.ChuanRenApp) window.ChuanRenApp.cast();
      const top = $('basicInfo'); if (top && top.scrollIntoView) top.scrollIntoView({ behavior: 'smooth' });
    } else if (k === 'nm') {
      if (window.ChuanRenApp) window.ChuanRenApp.setNianMing(b.dataset.gz);
      b.textContent = '已设为年命 ✓';
    }
  });
  $('calPanel').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.cal === 'q') { e.preventDefault(); runFind(); } });
  window.ChuanRenCalendarUI = { openAt, runFind };
})();
