/* 奇门穿壬 · 案例本界面
 *
 * 存取：Qimen-pwa 的 CaseStore（导入合并、同 id 取较新者、写满时报错），后端另开一个
 * IndexedDB 库「qimen-chuanren-casebook」，与奇门 app 的案例本分开，互不混入。
 * 只存在本机，不上传；要带走只能自己点导出。
 * 记录怎样组、准确率怎样算：core/casebook.js。
 */
(function () {
  const CB = window.ChuanRenCasebook, CS = window.CaseStore, QM = window.QM;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GONG = { 1: '坎一', 2: '坤二', 3: '震三', 4: '巽四', 5: '中五', 6: '乾六', 7: '兑七', 8: '艮八', 9: '离九' };
  const RULE_NAME = { 1: '用神天将', 2: '五行推理·天盘支', 3: '末传落宫', 4: '空亡互检', 6: '命干', 8: '类神入传（对实况发生）', 9: '贵人互参', 10: '我彼双读' };
  const pct = (x) => (x == null ? '—' : (x * 100).toFixed(1) + '%');

  /** 独立的 IndexedDB 后端（照 CaseStore 的 KV 契约），库名与奇门 app 不同 */
  function idbBackend(name) {
    const idb = window.indexedDB;
    if (!idb) return null;
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = idb.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('IndexedDB 打开失败'));
    }));
    const tx = (mode, fn) => open().then((db) => new Promise((res, rej) => {
      const t = db.transaction('kv', mode), out = fn(t.objectStore('kv'));
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : true);
      t.onerror = () => rej(t.error || new Error('IndexedDB 事务失败'));
      t.onabort = () => rej(t.error || new Error('IndexedDB 事务中止（可能是存储已满）'));
    }));
    return {
      name: 'indexeddb',
      get: (k) => tx('readonly', (s) => s.get(k)).then((v) => (v === undefined ? null : v)),
      set: (k, v) => tx('readwrite', (s) => { s.put(v, k); return null; }),
      del: (k) => tx('readwrite', (s) => { s.delete(k); return null; }),
      keys: () => tx('readonly', (s) => s.getAllKeys()),
      clear: () => tx('readwrite', (s) => { s.clear(); return null; }),
    };
  }
  let store;
  try { store = CS.create(idbBackend('qimen-chuanren-casebook') || CS.memoryBackend()); }
  catch (e) { store = CS.create(CS.memoryBackend()); }

  let tab = 'open', cache = [];

  async function refresh() {
    cache = await store.list();
    const open = cache.filter((c) => !(c.feedback && c.feedback.archived)).length;
    $('caseCountTag').textContent = `共 ${cache.length} 条，待回填 ${open}` + (store.persistent ? '' : '　⚠ 本机不能持久保存（隐私模式？），关掉就没了');
    render();
  }

  /* ---------- 存 ---------- */
  async function saveCurrent() {
    const ctx = window._chuanrenCtx;
    const q = $('aiQuestion').value.trim();
    if (!ctx || !ctx.res) { $('caseSaveTag').textContent = '请先排盘'; return; }
    if (!q) { $('caseSaveTag').textContent = '请先在上面填写占问'; return; }
    const now = new Date().toISOString();
    const ai = window._lastAI && window._lastAI.ctx === ctx ? window._lastAI : null;   // 只收这一盘的 AI 解读
    const rec = CB.makeRecord({ id: store.newId(now), now, ctx, question: q, ai });
    try { await store.save(rec); $('caseSaveTag').textContent = '已存 ✓' + (ai ? '（含 AI 解读）' : '（未含 AI 解读）'); tab = 'open'; await refresh(); }
    catch (e) { $('caseSaveTag').textContent = e.message; }
  }

  /* ---------- 回填 ---------- */
  function dayZhiOf(dateStr) {
    if (!dateStr) return '';
    try { return QM.qimen.calculate(new Date(dateStr + 'T12:00'), { type: '四柱', method: '时家', purpose: '综合', location: '默认位置' }).siZhu.day.charAt(1); }
    catch (e) { return ''; }
  }
  function feedbackForm(c) {
    const f = c.feedback || {};
    const opt = (name, val, label, cur) => `<label><input type="radio" name="${name}-${c.id}" value="${val}" ${cur === val ? 'checked' : ''}> ${label}</label>`;
    return `<div class="fb" data-id="${c.id}">
      <div>题型 ${opt('type', 'yesno', '是非题', f.type || 'yesno')} ${opt('type', 'other', '非是非题', f.type)}</div>
      <div>所盼 ${opt('want', 'hope', '盼它发生', f.want)} ${opt('want', 'fear', '怕它发生', f.want)}</div>
      <div>实况 ${opt('hap', 'yes', '发生了', f.happened)} ${opt('hap', 'no', '没发生', f.happened)} ${opt('hap', 'partial', '部分', f.happened)} ${opt('hap', '?', '不清楚', f.happened)}</div>
      <div>AI 结论 ${opt('ai', 'wish', '如愿', f.aiVerdict)} ${opt('ai', 'unwish', '不如愿', f.aiVerdict)} ${opt('ai', 'none', '未断／无 AI', f.aiVerdict)}</div>
      <div>实际方位 <select data-k="gong"><option value="">不适用</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => `<option value="${g}" ${String(f.actualGong) === String(g) ? 'selected' : ''}>${GONG[g]}</option>`).join('')}</select>
        实际应期 <input type="date" data-k="date" value="${esc(f.actualDate || '')}"></div>
      <textarea data-k="note" rows="2" style="width:100%;box-sizing:border-box;" placeholder="实况描述（同题重录以「问题＋实况」去重）">${esc(f.note || '')}</textarea>
      <button class="btn" data-act="archive" style="padding:4px 12px;font-size:13px;">${f.archived ? '更新' : '回填并归档'}</button>
      <button class="btn" data-act="del" style="padding:4px 12px;font-size:13px;background:#a94442;">删除</button>
    </div>`;
  }
  function readForm(box) {
    const id = box.dataset.id, pick = (n) => { const e = box.querySelector(`input[name="${n}-${id}"]:checked`); return e ? e.value : ''; };
    const date = box.querySelector('[data-k="date"]').value;
    return { type: pick('type') || 'yesno', want: pick('want'), happened: pick('hap'), aiVerdict: pick('ai'),
      actualGong: box.querySelector('[data-k="gong"]').value, actualDate: date, actualDayZhi: dayZhiOf(date),
      note: box.querySelector('[data-k="note"]').value.trim(), archived: true };
  }

  /* ---------- 列表 ---------- */
  function voteLine(c) {
    return (c.votes || []).map((v) => `${v.rule}:${v.rule === 5 ? (v.applicable ? '向' + (v.secondGongs || []).join('') : '—')
      : v.rule === 7 ? (v.picks && v.picks.length ? '期' + v.picks.join('') : '—')
      : v.verdict === '混' ? '混' : !v.applicable ? '弃' : v.vote > 0 ? '+' : '−'}`).join(' ');
  }
  function caseCard(c) {
    const f = c.feedback, o = CB.outcome(c);
    return `<details class="case-card"><summary><b>${esc(c.question)}</b>
      <span class="muted">${esc(c.input.date)} · ${c.input.school === 'feipan' ? '飞盘' : '转盘'} · ${esc(c.input.ui)} · ${esc(c.liuren.keTi)} ${esc(c.liuren.sanChuan.join(''))}</span>
      ${f && f.archived ? `<span class="tag ${o === true ? 'ok' : o === false ? 'bad' : ''}">${o === true ? '如愿' : o === false ? '不如愿' : '已归档'}</span>` : '<span class="tag">待回填</span>'}</summary>
      <div class="muted" style="margin:4px 0;">四柱 ${esc(Object.values(c.chart.siZhu || {}).join(' '))}　${esc(c.chart.juShu || '')}　规则票 ${voteLine(c)}　五行v1 ${c.wuxing ? esc(c.wuxing.verdict) : '—'}</div>
      ${c.ai ? `<details><summary class="muted">AI 解读（${esc(c.ai.model)}）</summary><div class="case-ai">${esc(c.ai.answer)}</div></details>` : ''}
      ${feedbackForm(c)}</details>`;
  }

  function statsHtml() {
    const s = CB.stats(cache, { rulesVersion: window.ChuanRenRules && window.ChuanRenRules.VERSION }), st = s.stage;
    const nextTxt = st.next ? `离${st.next.label}：还差 ${Math.max(0, st.next.n - s.yesno)} 题（且如愿、不如愿各 ≥${st.next.each}，现 ${s.pos}／${s.neg}）` : '两次评估都已到';
    let h = `<p>已归档 ${s.archived} 条（去重后），其中可计分的是非题 ${s.yesno} 题：如愿 ${s.pos}、不如愿 ${s.neg}。<br>${nextTxt}。</p>`;
    h += `<table class="rule-table"><thead><tr><th>判断</th><th>计分题数</th><th>平衡准确率</th><th>准确率</th><th>判定</th></tr></thead><tbody>`;
    h += `<tr><td>AI 结论（奇门为主，基准）</td><td>${s.ai.n}</td><td>${pct(s.ai.balanced)}</td><td>${pct(s.ai.acc)}</td><td class="muted">—</td></tr>`;
    h += `<tr><td>五行推理 v1</td><td>${s.wuxing.n}</td><td>${pct(s.wuxing.balanced)}</td><td>${pct(s.wuxing.acc)}</td><td class="muted">参照</td></tr>`;
    for (const k of [1, 2, 3, 4, 6, 8, 9, 10]) {
      const r = s.rules[k];
      h += `<tr><td>规则 ${k} ${RULE_NAME[k]}</td><td>${r.n}</td><td>${pct(r.balanced)}</td><td>${pct(r.acc)}</td><td>${r.verdict ? `<b>${r.verdict}</b>` : '<span class="muted">未到评估点</span>'}</td></tr>`;
    }
    h += `</tbody></table>`;
    h += `<p style="margin-top:8px;">规则 5 方位（只计第二方位与奇门方位不同的方位题）：${s.rule5.n} 题，第二方位命中 ${s.rule5.second}，奇门方位命中 ${s.rule5.qimen}。<br>
      规则 4 应期候选（末传支日）：${s.rule4YingQi.n} 题有实际应期，命中 ${s.rule4YingQi.hit}。<br>
      规则 7 应期融合·穿壬：${s.rule7.n} 题有实际应期，命中 ${s.rule7.hit}（瞎猜期望 ${s.rule7.expect}）。</p>
      <p class="muted">规则账本按版本分开：只计本版（v${esc(String((window.ChuanRenRules || {}).VERSION || '').split('.')[0])}）录入的案例；AI 与五行 v1 全计。</p>`;
    h += `<p class="muted">口径照冻结规格：平衡准确率＝如愿题判对率与不如愿题判对率的平均，瞎猜为 50%；弃权不计。
      判定只在到达评估点时给出：比 AI 结论高 5 个百分点以上且本身 ≥55% 为通过；低于 AI 结论为停止；其余第一次评估继续、第二次停止。</p>`;
    return h;
  }

  function render() {
    [...$('caseTabSeg').children].forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const box = $('caseBody');
    if (tab === 'stats') { box.innerHTML = statsHtml(); return; }
    const rows = cache.filter((c) => (tab === 'open') !== !!(c.feedback && c.feedback.archived));
    box.innerHTML = rows.length ? rows.map(caseCard).join('') : `<p class="muted">${tab === 'open' ? '没有待回填的案例。排盘、填好占问后按「存为案例」。' : '还没有归档的案例。'}</p>`;
  }

  /* ---------- 导出／导入 ---------- */
  async function exportCases() {
    const data = await store.exportAll(new Date().toISOString());
    data.format = CB.FORMAT; data.app = 'qimen-chuanren';   // 与奇门 app 的导出区分，免得互相导入
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `qimen-chuanren-cases-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importCases(file) {
    try {
      const data = JSON.parse(await file.text());
      if (data.format !== CB.FORMAT) throw new Error('这不是穿壬的案例导出（奇门 app 的案例本请在奇门 app 里导入）');
      const r = await store.importAll(data);
      $('caseSaveTag').textContent = `导入：新增 ${r.added}，更新 ${r.updated}，跳过 ${r.skipped}`;
      await refresh();
    } catch (e) { $('caseSaveTag').textContent = '导入失败：' + e.message; }
  }

  /* ---------- 事件 ---------- */
  $('caseSaveBtn').addEventListener('click', saveCurrent);
  $('caseTabSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { tab = b.dataset.tab; render(); } });
  $('caseExportBtn').addEventListener('click', exportCases);
  $('caseImportInput').addEventListener('change', (e) => { if (e.target.files[0]) importCases(e.target.files[0]); e.target.value = ''; });
  $('caseBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const box = btn.closest('.fb'), c = cache.find((x) => x.id === box.dataset.id); if (!c) return;
    if (btn.dataset.act === 'del') { if (confirm('删除这条案例？')) { await store.remove(c.id); await refresh(); } return; }
    c.feedback = readForm(box); c.updatedAt = new Date().toISOString();
    try { await store.save(c); await refresh(); } catch (err) { alert(err.message); }
  });

  window.ChuanRenCases = { store, refresh, stats: () => CB.stats(cache) };
  refresh();
})();
