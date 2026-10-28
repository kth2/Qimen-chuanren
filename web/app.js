/* 奇门穿壬 PWA 控制器 + 渲染（client-side）
 *
 * 排盘流程与盘面照 Qimen-pwa：同一个引擎（engine.bundle.js）、同一份 style.css、
 * 同样的「盘别 / 日期 / 时间 / 局」输入。奇门宫格的渲染函数从 Qimen-pwa app.js
 * （submodule 所钉的版本）逐字搬来——那边没有把它们导出，只能照抄；只抄展示，不抄任何断法。
 * 本文件自己的部分只有穿壬层：六壬概要、穿壬九宫、规则 1、2、5、6 的票。
 */
(function () {
  const QM = window.QM;
  const WS = window.WangShuai;
  const RULES = window.ChuanRenRules;
  const TDP = window.LiurenTianDiPan;
  const $ = (id) => document.getElementById(id);
  let school = 'zhuanpan';
  let DOMAINS = null;   // Qimen-pwa knowledge/domains.json：占类 → 五行推理占类键、飞盘引擎占类

  /* ======== 以下至「排盘」为止，照 Qimen-pwa app.js 搬来（展示用） ======== */
  const ganColor = (g) => ({ '戊': 'wuxing-tu', '己': 'wuxing-tu', '庚': 'wuxing-jin', '辛': 'wuxing-jin', '壬': 'wuxing-shui', '癸': 'wuxing-shui', '丁': 'wuxing-huo', '丙': 'wuxing-huo', '乙': 'wuxing-mu', '甲': 'wuxing-mu' }[g] || '');
  function xingColor(x) { x = x || ''; if (x.includes('蓬')) return 'wuxing-shui'; if (x.includes('冲') || x.includes('辅')) return 'wuxing-mu'; if (x.includes('英')) return 'wuxing-huo'; if (x.includes('柱') || x.includes('心')) return 'wuxing-jin'; return 'wuxing-tu'; }
  function menColor(m) { return ({ '休门': 'wuxing-shui', '生门': 'wuxing-tu', '伤门': 'wuxing-mu', '杜门': 'wuxing-mu', '景门': 'wuxing-huo', '死门': 'wuxing-tu', '惊门': 'wuxing-jin', '开门': 'wuxing-jin' })[m] || ''; }
  function shenColor(s) { return ({ '值符': 'wuxing-mu', '腾蛇': 'wuxing-huo', '太阴': 'wuxing-jin', '六合': 'wuxing-mu', '白虎': 'wuxing-jin', '玄武': 'wuxing-shui', '九地': 'wuxing-tu', '九天': 'wuxing-jin' })[s] || ''; }
  function gongColor(n) { return ({ '震': 'wuxing-mu', '巽': 'wuxing-mu', '离': 'wuxing-huo', '坤': 'wuxing-tu', '艮': 'wuxing-tu', '中': 'wuxing-tu', '乾': 'wuxing-jin', '兑': 'wuxing-jin', '坎': 'wuxing-shui' })[n] || ''; }
  const SHEN_SHORT = { '值符': '符', '腾蛇': '蛇', '太阴': '阴', '六合': '合', '勾陈': '勾', '太常': '常', '朱雀': '雀', '九地': '地', '九天': '天', '白虎': '虎', '玄武': '玄' };
  const NUM_CN = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const GRID_ORDER = ['4', '9', '2', '3', '5', '7', '8', '1', '6'];
  function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  const HARM_TXT = { mu: '墓', xing: '刑', po: '迫' };
  const HARM_TIP = {
    mu: '入墓：仅余两成力，事多滞塞，须待冲墓方发',
    xing: '击刑：六仪落其刑宫，力减半，主别扭拧劲、彼此掣肘',
    po: '门迫：门克宫，吉门受迫吉不成、凶门受迫凶更烈，力减半'
  };
  const HARM_ORDER = ['mu', 'xing', 'po'];
  function harmBadge(kinds) {
    if (!kinds.length) return '';
    const ks = HARM_ORDER.filter(k => kinds.indexOf(k) >= 0);
    return `<sup class="harm-mark harm-${ks[0]}" title="${ks.map(k => HARM_TIP[k]).join('；')}">` +
      ks.map(k => HARM_TXT[k]).join('') + '</sup>';
  }
  function glyph(text, kinds) {
    if (!text || !kinds.length) return esc(text);
    const ks = HARM_ORDER.filter(k => kinds.indexOf(k) >= 0);
    return `<span class="hg ${ks.map(k => 'harm-box-' + k).join(' ')}">${esc(text)}${harmBadge(ks)}</span>`;
  }
  function ganHarms(gan, g) {
    const W = window.WangShuai;
    if (!W || !gan) return [];
    const out = [];
    if (W.isRuMu(gan, String(g))) out.push('mu');
    if (W.isJiXing(gan, String(g))) out.push('xing');
    return out;
  }
  function menPoAt(pan, g) { return !!(((pan.jiuGongAnalysis || {})[g] || {}).menPo); }
  const HARM_LEGEND = '<div class="harm-legend">' +
    '<span class="lg"><span class="lg-ring harm-box-po"></span><sup class="harm-mark harm-po lg-mark">迫</sup>门迫</span>' +
    '<span class="lg"><span class="lg-ring harm-box-xing"></span><sup class="harm-mark harm-xing lg-mark">刑</sup>击刑</span>' +
    '<span class="lg"><span class="lg-ring harm-box-mu"></span><sup class="harm-mark harm-mu lg-mark">墓</sup>入墓</span>' +
    '<span class="lg"><span class="circle-mark yellow-circle">空</span>空亡</span>' +
    '<span class="lg"><span class="circle-mark green-circle">马</span>驿马</span>' +
    '<span class="lg muted">四害减力：门迫/击刑各减半，空亡吉凶皆减半且须待填实冲实，入墓仅余两成</span>' +
    '</div>';

  function cellZhuanpan(pan, g) {
    const JG = QM.JIU_GONG[g] || {};
    const ja = (pan.jiuGongAnalysis || {})[g] || {};
    const kong = (pan.kongWangGong || []).includes(g);
    const ma = pan.maStar && pan.maStar.gong === g;
    const xing = (pan.jiuXing || {})[g] || '', men = (pan.baMen || {})[g] || '', shen = (pan.baShen || {})[g] || '';
    const tg = (pan.tianPan || {})[g] || '', dg = (pan.diPan || {})[g] || '', dz = (pan.anGan || {})[g] || '';
    const po = menPoAt(pan, g) ? ['po'] : [], ht = ganHarms(tg, g), hd = ganHarms(dg, g);
    const cls = ['gong', 'gong' + g, ja.jiXiong || 'ping', pan.zhiFuGong === g ? 'zhifu' : '',
      pan.zhiShiGong === g ? 'zhishi' : '', kong ? 'gong-kong' : ''].join(' ');
    return `<div class="${cls}"><div class="gong-content">
      <div class="gong-dizhi di-zhi">${esc(dz)}</div>
      <div class="gong-bashen ${shenColor(shen)}">${esc(shen)}</div>
      <div class="gong-tianganfang">${ma ? '<span class="circle-mark green-circle">马</span>' : ''}${kong ? '<span class="circle-mark yellow-circle">空</span>' : ''}</div>
      <div class="gong-bamen ${menColor(men)}">${glyph(men, po)}</div>
      <div class="gong-jiuxing ${xingColor(xing)}">${esc(xing)}</div>
      <div class="gong-tiangan ${ganColor(tg)}">${glyph(tg, ht)}</div>
      <div class="gong-gongname ${gongColor(JG.name)}">${esc(JG.name)}</div>
      <div class="gong-number">${NUM_CN[+g]}</div>
      <div class="gong-dipan ${ganColor(dg)}">${glyph(dg, hd)}</div>
    </div></div>`;
  }

  function cellFeipan(pan, g) {
    const JG = QM.JIU_GONG[g] || {};
    const kong = (pan.kongWangGong || []).includes(g);
    const ma = pan.maStar && pan.maStar.gong === g;
    const star = ((pan.tianPanXing || {})[g] || '').replace('天', '');
    const sh = s => SHEN_SHORT[s] || s || '';
    const tShen = sh((pan.tianPanShen || {})[g]), tYi = (pan.tianPanYi || {})[g] || '', tAn = (pan.tianPanAnGan || {})[g] || '';
    const mMen = ((pan.renPanMen || {})[g] || '').replace('门', ''), aMen = ((pan.renPanAnMen || {})[g] || '').replace('门', ''), rAn = (pan.renPanAnGan || {})[g] || '';
    const dShen = sh((pan.diPanShen || {})[g]), dYi = (pan.diPan || {})[g] || '', dAn = (pan.diPanAnGan || {})[g] || '';
    const po = menPoAt(pan, g) ? ['po'] : [], ht = ganHarms(tYi, g), hd = ganHarms(dYi, g);
    const cls = ['gong', 'gong' + g, pan.zhiFuLuoGong === g ? 'zhifu' : '',
      pan.zhiShiGong === g ? 'zhishi' : '', kong ? 'gong-kong' : ''].join(' ');
    return `<div class="${cls}"><div class="feipan-gong-content kuonang">
      ${(kong || ma) ? `<div class="fp-marks">${ma ? '<span class="circle-mark green-circle">马</span>' : ''}${kong ? '<span class="circle-mark yellow-circle">空</span>' : ''}</div>` : ''}
      <div class="fp-xing ${xingColor(pan.tianPanXing && pan.tianPanXing[g])}">${esc(star)}</div>
      <div class="fp-row fp-tian${ht.length ? ' fp-row-harm' : ''}"><span class="fp-shen">${esc(tShen)}</span><span class="fp-gan ${ganColor(tYi)}">${glyph(tYi, ht)}</span><span class="fp-an">${esc(tAn)}</span></div>
      <div class="fp-row fp-ren${po.length ? ' fp-row-harm' : ''}"><span class="fp-men fp-ming">${glyph(mMen, po)}</span><span class="fp-men fp-an-men">${esc(aMen)}</span><span class="fp-an">${esc(rAn)}</span></div>
      <div class="fp-row fp-di${hd.length ? ' fp-row-harm' : ''}"><span class="fp-shen">${esc(dShen)}</span><span class="fp-gan ${ganColor(dYi)}">${glyph(dYi, hd)}</span><span class="fp-an">${esc(dAn)}</span></div>
      <div class="fp-gongname">${esc(JG.name)}${NUM_CN[+g]}</div>
    </div></div>`;
  }

  function renderChart(pan) {
    const cellFn = school === 'feipan' ? cellFeipan : cellZhuanpan;
    const cls = school === 'feipan' ? 'pan-grid feipan-grid' : 'pan-grid';
    $('chart').innerHTML = `<div class="qimen-pan"><div class="pan-outer"><div class="${cls}">${GRID_ORDER.map(g => cellFn(pan, g)).join('')}</div></div></div>` + HARM_LEGEND;
  }

  function getDate() {
    const d = $('inDate').value, t = $('inTime').value;
    if (d && t) { const dt = new Date(d + 'T' + t); if (!isNaN(dt)) return dt; }
    return new Date();
  }
  function getJuShuOverride() {
    const v = $('inJuShu').value;
    if (!v) return null;
    const [type, number] = v.split('-');
    return { type, number, yuan: '',
      fullName: `${type === 'yin' ? '阴遁' : '阳遁'}${number}局（自定义）`, formatCode: v };
  }
  /* ======== 搬来的部分到此为止 ======== */

  /* ---------- 占类映射：一律查 Qimen-pwa 的 domains.json，不另立 ---------- */
  function domainKeyOf(ui) {
    const ds = (DOMAINS && DOMAINS.domains) || {};
    for (const k in ds) if ((ds[k].uiPurposes || []).indexOf(ui) >= 0) return k;
    return '';
  }
  function feipanCategoryOf(ui) {
    if (!DOMAINS) return ui;
    const by = (DOMAINS.uiPurposeToEngineCategoryBySchool || {}).feipan || {};
    return by[ui] || (DOMAINS.uiPurposeToEngineCategory || {})[ui] || ui;
  }
  /** 年命：引擎只收天干（甲须连支）；规则 6 要完整干支 */
  function nianMingGanForEngine(gz) { return !gz ? '' : gz[0] === '甲' ? gz : gz[0]; }

  /* ---------- 穿壬层 ---------- */
  const JX_CLS = { 吉: 'ji', 凶: 'xiong', 混: 'hun' };
  const RULE_NAME = { 1: '用神天将', 2: '五行推理·天盘支', 5: '方位第二意见', 6: '命干' };
  const GONG_LABEL = (g) => { const J = QM.JIU_GONG[String(g)] || {}; return (J.name || '') + NUM_CN[+g]; };

  function voteHtml(r) {
    if (r.rule === 5) return '<span class="vote z">—</span>';
    if (!r.applicable) return '<span class="vote z">弃权</span>';
    return r.vote > 0 ? '<span class="vote p">+1</span>' : r.vote < 0 ? '<span class="vote n">−1</span>' : '<span class="vote z">0</span>';
  }
  function ruleDetail(r) {
    if (r.rule === 1) {
      const rd = (r.readings || []).map(x => `${x.di}上${x.tian}·${x.jiang}`).join('；');
      return `事宫${GONG_LABEL(r.gong)}：${esc(rd)} → ${esc(r.verdict || '')}`;
    }
    if (r.rule === 2 && r.applicable) {
      return `我（${(r.rZhi || []).join('')}，${esc(r.rWx)}，${esc(r.lR)}）对事（${(r.yZhi || []).join('')}，${esc(r.yWx)}，${esc(r.lY)}）：` +
        `<b>${esc(r.relation)}</b>——${esc(r.why)}（得分 ${r.score > 0 ? '+' : ''}${r.score}）`;
    }
    if (r.rule === 5 && r.applicable) {
      return `奇门方位 ${GONG_LABEL(r.qimenGong)}；第二方位 <b>${r.secondGongs.map(GONG_LABEL).join('、')}</b>`;
    }
    if (r.rule === 6 && r.applicable) {
      return `本命${esc(r.benMingZhi)}上神${esc(r.shangShen)}（${esc(r.meWx)}，乘${esc(r.shangShenJiang)}）对事宫天盘支（${(r.yZhi || []).join('')}，${esc(r.yWx)}）：<b>${esc(r.relation)}</b>`;
    }
    return '';
  }

  function renderChuanRen(pan, res) {
    const ln = TDP.build({ riGan: pan.siZhu.day[0], yueJiang: res.yueJiang.yueJiang, shiZhi: pan.siZhu.time[1] });
    const R = String(res.quYong.R || ''), Y = String(res.quYong.Y || '');
    const r5 = res.rules.find(x => x.rule === 5);
    const second = new Set(((r5 && r5.secondGongs) || []).map(String));
    const yj = res.yueJiang, L = res.liuren;

    let html = `<div class="panel"><h3>六壬层 <span class="exp-badge">实验</span></h3>
      <div style="font-size:13px;line-height:1.8;">
        <b>月将</b> ${esc(yj.yueJiang)}（${esc(yj.zhongQi || '')}后${yj.since ? '，自 ' + esc(yj.since) : ''}）
        <span class="muted">月将切换规则${esc(yj.status)}</span><br>
        <b>占时</b> ${esc(pan.siZhu.time[1])}　<b>${esc(L.zhouYe)}贵</b> ${esc(L.guiRen)} 加地盘 ${esc(L.guiRenOverDi)}，${L.shun ? '顺' : '逆'}行
        　<b>六壬日旬空</b> ${esc(L.xunKong.join(''))}<br>
        <b>取用</b> 我＝${esc(res.quYong.rLabel)}${R ? GONG_LABEL(R) : '（未定）'}　事＝${esc(res.quYong.yName || '')}宫${Y ? GONG_LABEL(Y) : '（未定）'}
      </div></div>`;

    html += `<div class="panel"><h3>穿壬九宫</h3><div class="cr-grid">`;
    for (const g of GRID_ORDER) {
      const rg = ln.readGong(Number(g));
      const cls = ['cr-cell', rg.verdict ? 'cr-' + JX_CLS[rg.verdict] : '', g === R ? 'cr-me' : '', g === Y ? 'cr-shi' : ''].join(' ');
      const roles = (g === R ? '<span class="cr-role me">我</span>' : '') + (g === Y ? '<span class="cr-role shi">事</span>' : '') +
        (second.has(g) ? '<span class="cr-role dir">向</span>' : '');
      const lines = rg.readings.map(x =>
        `<div class="cr-line"><span class="z">${x.di}上</span>${x.tian} <span class="cr-${x.ji ? 'ji' : 'xiong'}-t">${x.jiang}</span></div>`).join('');
      html += `<div class="${cls}"><div class="cr-name">${roles}${GONG_LABEL(g)}</div>
        ${rg.verdict ? `<span class="cr-tag cr-${JX_CLS[rg.verdict]}-t">${rg.verdict}</span>` : ''}${lines || '<div class="muted">无支</div>'}</div>`;
    }
    html += `</div><p class="muted" style="margin:6px 0 0;">每格：地盘支上所加的天盘支与天将。绿框＝我宫，橙框＝事宫，「向」＝规则 5 的第二方位。四维宫两支一吉一凶记「混」。</p></div>`;

    html += `<div class="panel"><h3>穿壬规则 <span class="exp-badge">未检验</span></h3>
      <table class="rule-table"><thead><tr><th>规则</th><th>票</th><th>依据</th></tr></thead><tbody>`;
    for (const r of res.rules) {
      html += `<tr><td>${r.rule}　${RULE_NAME[r.rule]}</td><td>${voteHtml(r)}</td><td>${ruleDetail(r)}${r.reason ? `<div class="muted">${esc(r.reason)}</div>` : ''}</td></tr>`;
    }
    html += `</tbody></table>
      <p class="muted" style="margin:6px 0 0;">自创实验流派（appliesTo: ${esc(res.appliesTo)}）。+1／−1 只是关系分值，不等于吉或成功；
      各规则分开计票、不相加，冲突原样保留。规则 3、4 需要三传，待《大六壬探原》原文。</p></div>`;
    $('chuanren').innerHTML = html;
  }

  function renderBasicInfo(pan) {
    const bi = pan.basicInfo || {}, sz = pan.siZhu || {};
    const zfGong = pan.zhiFuLuoGong || pan.zhiFuGong;
    $('basicInfo').style.display = 'block';
    $('basicInfo').innerHTML = [
      `<span class="item"><b>公历</b> ${esc(bi.date)}</span>`,
      `<span class="item"><b>四柱</b> ${esc(sz.year)} ${esc(sz.month)} ${esc(sz.day)} ${esc(sz.time)}</span>`,
      `<span class="item"><b>局</b> ${esc(pan.juShu && pan.juShu.fullName)}</span>`,
      `<span class="item"><b>旬首</b> ${esc(pan.xunShou || pan.xunShouYi)}</span>`,
      `<span class="item"><b>值符</b> ${esc(pan.zhiFuXing)}(${esc(zfGong)}宫)</span>`,
      `<span class="item"><b>值使</b> ${esc(pan.zhiShiMen)}(${esc(pan.zhiShiGong)}宫)</span>`
    ].join('');
  }

  /* ---------- 排盘 ---------- */
  function cast() {
    const date = getDate(), juShu = getJuShuOverride();
    const ui = $('inDomain').value || '综合';
    const nianMing = $('inNianMing').value;
    const opts = school === 'feipan'
      ? { method: '时家', purpose: '综合' }
      : { type: '四柱', method: '时家', purpose: '综合', location: '默认位置' };
    if (juShu) opts.juShu = juShu;
    const pan = school === 'feipan' ? QM.feipanQimen.calculate(date, opts) : QM.qimen.calculate(date, opts);
    if (pan.error) { $('chuanren').innerHTML = `<div class="panel">排盘出错：${esc(pan.message)}</div>`; return; }
    if (!pan.jiuGongAnalysis) pan.jiuGongAnalysis = {};
    renderBasicInfo(pan); renderChart(pan);

    let feipan = null;
    if (school === 'feipan') {
      // 飞盘取用照 Qimen-pwa：三乙四宫与《鸣法》用神都取自引擎 feipanPredict 的 context
      const ctx = (QM.feipanPredict.buildPrompt(pan, '', { nianMingGan: nianMingGanForEngine(nianMing), fallbackCategory: feipanCategoryOf(ui) }) || {}).context || {};
      const loc = ((ctx.yong && ctx.yong.located) || [])[0] || null;
      feipan = { nianMingGong: ctx.sanyi && ctx.sanyi.nianMingGong, shiGanGong: ctx.sanyi && ctx.sanyi.shiGanGong,
        yongGong: loc && loc.gong, yongName: loc && loc.name };
    }
    try {
      const res = RULES.evaluate({ chart: pan, wangshuai: WS.analyze(pan), domain: domainKeyOf(ui), date, feipan, nianMing });
      renderChuanRen(pan, res);
      window._chuanren = res;
    } catch (e) {
      $('chuanren').innerHTML = `<div class="panel">穿壬层计算出错：${esc(e.message)}</div>`;
      console.error(e);
    }
  }

  /* ---------- 初始化 ---------- */
  function fillNianMing() {
    const G = '甲乙丙丁戊己庚辛壬癸', Z = '子丑寅卯辰巳午未申酉戌亥';
    const sel = $('inNianMing');
    for (let i = 0; i < 60; i++) {
      const gz = G[i % 10] + Z[i % 12];
      const o = document.createElement('option'); o.value = gz; o.textContent = gz; sel.appendChild(o);
    }
  }
  function setNow() {
    const n = new Date(), p = (x) => String(x).padStart(2, '0');
    $('inDate').value = `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
    $('inTime').value = `${p(n.getHours())}:${p(n.getMinutes())}`;
  }
  $('schoolSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    school = b.dataset.school;
    [...$('schoolSeg').children].forEach(x => x.classList.toggle('on', x === b));
    cast();
  });
  $('castBtn').addEventListener('click', cast);
  ['inDomain', 'inNianMing'].forEach(id => $(id).addEventListener('change', cast));

  fillNianMing(); setNow();
  fetch('vendor/qimen-pwa/knowledge/domains.json').then(r => r.json())
    .then(d => { DOMAINS = d; })
    .catch(e => console.warn('[domains] 载入失败，占类一律按时干宫取：', e.message))
    .finally(cast);
})();
