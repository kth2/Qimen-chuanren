/* 奇门穿壬 · AI 解读
 *
 * 与 Qimen-pwa 共用：
 *   · LLM（vendor/qimen-pwa/llm.js）：Gemini / Ollama / OpenAI 兼容端点，流式、重试、备用链都照旧。
 *     设置存在同一个 localStorage 键（qm_llm_cfg）。两个 app 都在 kth2.github.io 下，同源，
 *     所以在任一边填过的 key 与模型，另一边直接可用。
 *   · 奇门提示词：引擎 zhuanpanPredict / feipanPredict.buildPrompt，载入各派自己的解断纲要
 *     （vendor/qimen-pwa/assets/*-method.md），两派零串味照旧。
 *   · 旺衰四害、应期、五行推理：Qimen-pwa 的 WangShuai / YingQi / WuXing 模块原样调用。
 * 本文件只新增：「穿壬·六壬层」一段（事实与规则票），以及约束模型怎样用它的几条纪律。
 *
 * 与 Qimen-pwa 的差距（如实说明）：它的结构化证据包（象义、应期时间线、类象、力量禁令、
 * 证据合流、吟局、八十一格、时格、取数）由 app.js 里约 300 行编排生成，没有导出，这里没有。
 */
(function () {
  const QM = window.QM, MD = window.MdLite, TDP = window.LiurenTianDiPan;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => (s == null ? '' : String(s)).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const GONG_NAME = { 1: '坎一', 2: '坤二', 3: '震三', 4: '巽四', 5: '中五', 6: '乾六', 7: '兑七', 8: '艮八', 9: '离九' };
  const ZHI_GONG = TDP.ZHI_GONG;

  /* ---------- 设置（字段与 Qimen-pwa 一一对应，存同一个键） ---------- */
  function showProvFields() {
    const p = $('cfgProvider').value;
    document.querySelectorAll('.prov').forEach((el) => { el.style.display = el.classList.contains('prov-' + p) ? '' : 'none'; });
  }
  function updateProviderTag() { const i = LLM.info(); $('aiProviderTag').textContent = `${i.provider}/${i.model}`; }
  function loadCfgForm() {
    const c = LLM.getCfg();
    $('cfgProvider').value = c.provider || 'gemini';
    $('cfgGeminiKey').value = c.geminiKey || ''; $('cfgGeminiModel').value = c.geminiModel || '';
    $('cfgOllamaUrl').value = c.ollamaUrl || ''; $('cfgOllamaModel').value = c.ollamaModel || '';
    $('cfgCustomUrl').value = c.customUrl || ''; $('cfgCustomKey').value = c.customKey || ''; $('cfgCustomModel').value = c.customModel || '';
    $('cfgGeminiFallbackModel').value = c.geminiFallbackModel || '';
    $('cfgGeminiThinkingBudget').value = (c.geminiThinkingBudget === 0 || c.geminiThinkingBudget) ? c.geminiThinkingBudget : '';
    $('cfgCustomFallbackModel').value = c.customFallbackModel || '';
    const sec = (ms) => (ms ? String(Math.round(ms / 1000)) : '');
    $('cfgIdleTimeout').value = sec(c.idleTimeoutMs);
    $('cfgTotalTimeout').value = sec(c.totalTimeoutMs);
    $('cfgMaxRetries').value = (c.maxRetries === 0 || c.maxRetries) ? String(c.maxRetries) : '';
    $('cfgMaxTokens').value = c.maxTokens ? String(c.maxTokens) : '';
    $('cfgFallbackProvider').value = c.fallbackProvider || 'none';
    showProvFields(); updateProviderTag();
  }
  function formCfg() {
    // 先取已存配置再覆盖，Qimen-pwa 日后若多存了字段，这里保存时不会把它抹掉
    return Object.assign({}, LLM.getCfg(), {
      provider: $('cfgProvider').value,
      geminiKey: $('cfgGeminiKey').value.trim(), geminiModel: $('cfgGeminiModel').value.trim() || 'gemini-3.5-flash',
      ollamaUrl: $('cfgOllamaUrl').value.trim() || 'http://localhost:11434', ollamaModel: $('cfgOllamaModel').value.trim() || 'qwen3:latest',
      customUrl: $('cfgCustomUrl').value.trim(), customKey: $('cfgCustomKey').value.trim(), customModel: $('cfgCustomModel').value.trim() || 'gpt-3.5-turbo',
      geminiFallbackModel: $('cfgGeminiFallbackModel').value.trim(),
      geminiThinkingBudget: $('cfgGeminiThinkingBudget').value.trim() === '' ? '' : Number($('cfgGeminiThinkingBudget').value),
      customFallbackModel: $('cfgCustomFallbackModel').value.trim(),
      fallbackProvider: $('cfgFallbackProvider').value,
      idleTimeoutMs: (Number($('cfgIdleTimeout').value) || 0) * 1000,
      totalTimeoutMs: (Number($('cfgTotalTimeout').value) || 0) * 1000,
      maxRetries: $('cfgMaxRetries').value === '' ? '' : Number($('cfgMaxRetries').value),
      maxTokens: Number($('cfgMaxTokens').value) || 0,
    });
  }
  function saveCfg() {
    LLM.saveCfg(formCfg());
    $('cfgSavedTag').textContent = '已保存 ✓（Qimen-pwa 同步可用）';
    setTimeout(() => { $('cfgSavedTag').textContent = ''; }, 2500);
    updateProviderTag();
  }
  async function listModelsFor(provider, btn) {
    const tag = document.querySelector(`[data-modelstag="${provider}"]`);
    btn.disabled = true; tag.textContent = '查询中…';
    try {
      const ms = await LLM.listModels(provider, formCfg());
      const input = { gemini: 'cfgGeminiModel', local: 'cfgOllamaModel', custom: 'cfgCustomModel' }[provider];
      const sel = document.createElement('select');
      sel.innerHTML = `<option value="">（${ms.length} 个，选一个填入）</option>` +
        ms.map((m) => `<option value="${esc(m.id)}">${esc(m.label || m.id)}</option>`).join('');
      sel.addEventListener('change', () => { if (sel.value) { $(input).value = sel.value; saveCfg(); } });
      tag.textContent = ''; tag.appendChild(sel);
    } catch (e) { tag.textContent = '失败：' + e.message; }
    finally { btn.disabled = false; }
  }

  /* ---------- 纲要 ---------- */
  const _method = {};
  async function methodText(school) {
    if (_method[school]) return _method[school];
    const r = await fetch(`vendor/qimen-pwa/assets/${school}-method.md`);
    if (!r.ok) throw new Error('解断纲要加载失败(HTTP ' + r.status + ')');
    const t = (await r.text()).trim();
    if (!t) throw new Error('解断纲要内容为空');
    return (_method[school] = t);
  }

  /* ---------- 纪律 ---------- */
  const DISCIPLINE = [
    '',
    '=== 解读要求（须逐条遵守）===',
    '【奇门部分】',
    '1. 推理依据仅限上方《解断方法纲要》与盘面、引擎给出的数据；不得引入八字、六爻、梅花、紫微、塔罗等体系。训练知识与纲要冲突时，以纲要为准。',
    '2. 用神以【用神落宫】为准，吉凶格局以引擎已判者为准，不得另取、推翻。',
    '3. 每一处论断落到具体宫位元素并附依据；逐宫析用神宫、值符宫、值使宫、日干宫、时干宫、年命宫（若提供）。',
    '4. 年命、日干为甲者按所遁之仪取宫（甲子戊、甲戌己、甲申庚、甲午辛、甲辰壬、甲寅癸），不得以本盘旬首顶替；时干为甲者以值符落宫论。',
    '【穿壬·六壬层】',
    '5. 穿壬是自创的实验流派，各条规则尚未经案例检验。六壬层只作旁证：可以引用，不得据以推翻奇门的成败结论。',
    '6. 六壬层只用【穿壬·六壬层】一段给出的事实（天盘支、天将、遁干、旬空、四课三传、规则票）。四课三传以该段为准，不得另起；不得引用毕法赋等未给出的内容。三传可读作起因、经过、结局，但成败仍以奇门为准。',
    '7. 规则票的 +1／−1 只是关系分值，不等于吉、成功或有利；各条分开看，不相加。',
    '8. 六壬层与奇门结论相左时，两边理由都写出，再给出唯一答案（以奇门为准），并注明哪条规则与之相左。',
    '9. 「穿壬事宫」按五行推理 v1 取用，可能与【用神落宫】不同；不同时两者都列，判断仍以【用神落宫】为准。',
    '【格式】',
    '10. 结尾单列一节「穿壬旁证」：逐条列规则 1、2、5、6 的票或方位，并说明与奇门结论是否一致。',
  ].join('\n');

  /* ---------- 穿壬段 ---------- */
  function chuanRenBlock(pan, res) {
    const ln = TDP.build({ riGan: pan.siZhu.day[0], yueJiang: res.yueJiang.yueJiang, shiZhi: pan.siZhu.time[1] });
    const dun = TDP.dunGan(pan.siZhu.day);
    const L = res.liuren, yj = res.yueJiang, q = res.quYong;
    const out = ['', '【穿壬·六壬层】（自创实验流派，未经案例检验，只作旁证）'];
    out.push(`月将${yj.yueJiang}（${yj.zhongQi || ''}后），占时${pan.siZhu.time[1]}，${L.zhouYe}贵${L.guiRen}加地盘${L.guiRenOverDi}，${L.shun ? '顺' : '逆'}行；六壬日旬空：${L.xunKong.join('')}（与奇门空亡分开，不互相替代）。`);
    out.push('十二地盘方位所加（地盘支：天盘支·天将·遁干 → 所属宫）：');
    for (const di of TDP.ZHI) {
      const t = ln.tianOver(di);
      out.push(`  ${di}：${t}·${ln.jiangOf(t)}·${dun[t] || '旬空无遁干'} → ${GONG_NAME[ZHI_GONG[di]]}`);
    }
    const sc = res.sanChuan;
    if (sc) {
      const kk = sc.ke.map((k) => `第${'一二三四'[k.n - 1]}课 ${k.xia}上${k.shang}·${ln.jiangOf(k.shang)}`).join('；');
      out.push(`四课：${kk}。`);
      out.push(`三传（${sc.name}；${sc.why}）：` + sc.chuan.map((z, i) =>
        `${'初中末'[i]}传 ${z}·${ln.jiangOf(z)}·${dun[z] || '旬空无遁干'}${L.xunKong.includes(z) ? '（六壬旬空）' : ''}，临地盘${ln.diUnder(z)}（${GONG_NAME[ZHI_GONG[ln.diUnder(z)]]}）`).join('；') + '。');
      if (sc.flags.length) out.push('三传取法待核处：' + sc.flags.join('；'));
    }
    out.push(`取用（照五行推理 v1）：我＝${q.rLabel}${q.R ? GONG_NAME[q.R] : '（未定）'}；事＝${q.yName || ''}宫${q.Y ? GONG_NAME[q.Y] : '（未定）'}。`);
    out.push('规则票：');
    for (const r of res.rules) {
      if (r.rule === 1) out.push(r.applicable
        ? `  规则1 用神天将：事宫${GONG_NAME[r.gong]} ${r.readings.map((x) => `${x.di}上${x.tian}·${x.jiang}`).join('；')} → ${r.verdict}，票 ${r.vote > 0 ? '+1' : '−1'}`
        : `  规则1 用神天将：弃权（${r.reason}）`);
      if (r.rule === 2) out.push(r.applicable
        ? `  规则2 五行推理·天盘支：我（${r.rZhi.join('')}，${r.rWx}，${r.lR}）对事（${r.yZhi.join('')}，${r.yWx}，${r.lY}）＝${r.relation}，${r.why}；票 ${r.vote > 0 ? '+1' : '−1'}`
        : `  规则2 五行推理·天盘支：弃权（${r.reason}）`);
      if (r.rule === 5) out.push(r.applicable
        ? `  规则5 方位第二意见：奇门方位 ${GONG_NAME[r.qimenGong]}；第二方位 ${r.secondGongs.map((g) => GONG_NAME[g]).join('、')}（不投票，只给方位）`
        : `  规则5 方位第二意见：弃权（${r.reason}）`);
      if (r.rule === 6) out.push(r.applicable
        ? `  规则6 命干：本命${r.benMingZhi}上神${r.shangShen}（${r.meWx}，乘${r.shangShenJiang}）对事宫天盘支（${r.yZhi.join('')}，${r.yWx}）＝${r.relation}；票 ${r.vote > 0 ? '+1' : '−1'}`
        : `  规则6 命干：弃权（${r.reason}）`);
    }
    out.push('规则3、4 需要三传，三传已能排出，但这两条规则尚未启用。');
    return out.join('\n');
  }

  /* ---------- 答案显示（同 Qimen-pwa：流式纯文本，完成后渲染 Markdown） ---------- */
  let _raw = '', _showRaw = false;
  function paint() {
    const box = $('aiAnswer'), bar = $('aiAnswerBar');
    const can = !!(MD && MD.render) && MD.looksMarkdown(_raw);
    bar.style.display = can ? 'block' : 'none';
    $('aiRawToggle').textContent = _showRaw ? '显示表格' : '查看原文';
    if (can && !_showRaw) { box.classList.add('md-on'); box.innerHTML = MD.render(_raw); }
    else { box.classList.remove('md-on'); box.textContent = _raw; }
  }
  function stream(t) { _raw = t; const b = $('aiAnswer'); b.classList.remove('md-on'); b.textContent = t; }
  function head(cat) {
    const u = (LLM.current && LLM.current()) || (LLM.lastUsed && LLM.lastUsed()), i = LLM.info();
    const who = u ? `${u.provider}/${u.model}${u.fellBack ? `（备用接管；主选 ${i.provider}/${i.model}）` : ''}` : `${i.provider}/${i.model}`;
    return `【占类：${cat}　模型：${who}　奇门穿壬·实验】\n\n`;
  }

  /** 供测试：不调模型，只组出要发给模型的 system 与 user */
  async function buildMessages(ctx, q) {
    const { pan, res, school, engineCategory, nianMing } = ctx;
    const mt = await methodText(school);
    const nmGan = !nianMing ? '' : nianMing[0] === '甲' ? nianMing : nianMing[0];
    const builder = school === 'feipan' ? QM.feipanPredict : QM.zhuanpanPredict;
    const prompt = builder.buildPrompt(pan, q, { methodText: mt, category: engineCategory, fallbackCategory: engineCategory, nianMingGan: nmGan });
    const ysGongs = (((prompt.context || {}).yong || {}).located || []).map((x) => x && x.gong).filter(Boolean);
    const ws = window.WangShuai ? window.WangShuai.toPromptBlock(pan, { JIU_GONG: QM.JIU_GONG }) : '';
    const yq = window.YingQi ? window.YingQi.toPromptBlock(pan, { JIU_GONG: QM.JIU_GONG, yongShenGongs: ysGongs }) : '';
    let wx = '';
    if (window.WuXing && res.wuxing && res.wuxing.applicable) wx = '\n' + window.WuXing.toPromptLines(res.wuxing, false).join('\n');
    const user = prompt.user + ws + yq + wx + '\n' + chuanRenBlock(pan, res) +
      `\n\n【再次提醒】占问：${q}。奇门为主，穿壬只作旁证；结尾单列「穿壬旁证」。`;
    return { system: prompt.system + '\n' + DISCIPLINE, user, category: (prompt.context && prompt.context.category) || engineCategory };
  }

  async function runAI() {
    const ctx = window._chuanrenCtx;
    if (!ctx || !ctx.res) { $('aiStatus').textContent = '请先排盘'; return; }
    const q = $('aiQuestion').value.trim();
    if (!q) { $('aiStatus').textContent = '请填写占问'; return; }
    const btn = $('aiBtn'); btn.disabled = true;
    $('aiAnswerBar').style.display = 'none';
    $('aiStatus').textContent = 'AI 解读中…（边生成边显示）';
    try {
      const m = await buildMessages(ctx, q);
      window._aiMessages = m;   // 便于在控制台核对喂给模型的内容
      $('aiAnswer').style.display = 'block'; _showRaw = false; stream(head(m.category));
      let streamed = false;
      const ans = await LLM.chat(m.system, m.user, (full) => { streamed = true; stream(head(m.category) + (full || '')); },
        (msg) => { $('aiStatus').textContent = msg; });
      _raw = head(m.category) + ((!streamed || !ans) ? (ans || '（无内容）') : ans);
      paint();
      $('aiStatus').textContent = '完成';
    } catch (e) {
      $('aiStatus').textContent = '失败：' + e.message;
      console.error(e);
    } finally { btn.disabled = false; }
  }

  /* ---------- 初始化 ---------- */
  if (typeof LLM === 'undefined') { $('aiStatus').textContent = 'AI 模块未载入'; return; }
  $('cfgProvider').addEventListener('change', showProvFields);
  $('cfgSaveBtn').addEventListener('click', saveCfg);
  $('aiBtn').addEventListener('click', runAI);
  $('aiRawToggle').addEventListener('click', () => { _showRaw = !_showRaw; paint(); });
  $('cfgProbeBtn').addEventListener('click', async () => {
    const b = $('cfgProbeBtn'), out = $('cfgProbeOut');
    b.disabled = true; out.textContent = '自检中…';
    try {
      const rows = await LLM.probe((t) => { out.textContent = t; });
      out.textContent = rows.map((r) => `${r.ok ? (r.warn ? '⚠' : '✅') : '❌'} ${r.step}（${r.mode}）　HTTP ${r.status || '—'}　${r.ms}ms\n    ${r.detail}`).join('\n');
    } catch (e) { out.textContent = '自检本身出错：' + e.message; }
    finally { b.disabled = false; }
  });
  document.querySelectorAll('[data-listmodels]').forEach((b) => b.addEventListener('click', () => listModelsFor(b.dataset.listmodels, b)));
  loadCfgForm();
  window.ChuanRenAI = { buildMessages, DISCIPLINE };
})();
