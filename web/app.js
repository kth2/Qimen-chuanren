/* 奇门穿壬 PWA 控制器 + 渲染（client-side）
 *
 * 排盘流程与盘面照 Qimen-pwa：同一个引擎（engine.bundle.js）、同一份 style.css、
 * 同样的「盘别 / 日期 / 时间 / 局」输入。奇门宫格的渲染函数从 Qimen-pwa app.js
 * （submodule 所钉的版本）逐字搬来——那边没有把它们导出，只能照抄；只抄展示，不抄任何断法。
 * 本文件自己的部分只有穿壬层：合盘外圈（十二支天盘、天将、遁干）、六壬概要、四课三传、九宫详解的六壬一行、规则 1–6 的票。
 */
(function () {
  const QM = window.QM;
  const WS = window.WangShuai;
  const RULES = window.ChuanRenRules;
  const TDP = window.LiurenTianDiPan;
  const XY = window.LiurenXiangYi;
  const CM = window.LiurenCaseMatch;
  let lastDomainUi = null;   // 上次排盘实际用的界面占类
  let BOOK = null;      // knowledge/liuren-cases.json：书中六壬案例（盘式照录＋摘要）
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
  /** 界面占类 → 引擎占类（财运→求财、健康→疾病、学业→功名；飞盘另有失物→寻物），查 Qimen-pwa 的表 */
  function engineCategoryOf(ui, sch) {
    if (!DOMAINS) return ui;
    const by = (DOMAINS.uiPurposeToEngineCategoryBySchool || {})[sch] || {};
    return by[ui] || (DOMAINS.uiPurposeToEngineCategory || {})[ui] || ui;
  }
  const feipanCategoryOf = (ui) => engineCategoryOf(ui, 'feipan');

  /* ---------- 占类：唯一解析口径（同 Qimen-pwa resolveCategory） ----------
   * 下拉选了 → 显式，直接就是结论，不再过分类器；留「跟随问句自动判定」→ 才交给引擎的
   * classifyQuestion 按问句关键词判。分类器用 Qimen-pwa 引擎原有的，不在本仓库另写。 */
  const YS = window.YongShen;
  const schoolKey = () => (school === 'feipan' ? 'feipan' : 'zhuanpan');
  /** 引擎占类 → 界面占类（求财→财运、功名→学业、疾病→健康；飞盘寻物→失物）。同名多项取表中先出现者 */
  function uiOfEngineCategory(cat) {
    if (!DOMAINS) return cat || '综合';
    const by = (DOMAINS.uiPurposeToEngineCategoryBySchool || {})[schoolKey()] || {};
    for (const k in by) if (by[k] === cat) return k;
    const m = DOMAINS.uiPurposeToEngineCategory || {};
    for (const k in m) if (m[k] === cat) return k;
    return '综合';
  }
  function resolveDomain() {
    const pick = $('inDomain').value;
    if (pick) return { ui: pick, source: 'explicit' };
    const q = ($('aiQuestion').value || '').trim();
    if (!q) return { ui: '综合', source: 'empty' };
    const builder = school === 'feipan' ? QM.feipanPredict : QM.zhuanpanPredict;
    let cat = '综合';
    try { cat = (builder.classifyQuestion(q, '综合') || {}).category || '综合'; } catch (e) { cat = '综合'; }
    return { ui: uiOfEngineCategory(cat), engineCat: cat, source: 'auto' };
  }
  function renderDomainTag(dom) {
    const tag = $('domainTag'); if (!tag) return;
    const who = dom.source === 'explicit' ? '你指定的' : dom.source === 'auto' ? '按问句自动判定' : '未填问句，暂按综合';
    let html = `本盘按「<b>${esc(dom.ui)}</b>」取用（${who}）`;
    if (YS && YS.isLoaded && YS.isLoaded()) {
      const m = YS.categoryMap(dom.ui, schoolKey());
      if (m && m.loaded && !m.engineSupported) {
        html += `<br><b style="color:#a94442">⚠ ${school === 'feipan' ? '飞盘' : '转盘'}不支持「${esc(m.unsupportedName || m.engineCategory)}」，`
          + `本次落回「${esc(m.degradedTo)}」。</b>${m.degradeWhy ? '<span class="muted">' + esc(m.degradeWhy) + '</span>' : ''}`;
      }
    }
    tag.innerHTML = html;
  }
  /** 本盘别不支持的占类，在下拉里先标出来（同 Qimen-pwa markUnsupportedDomains） */
  function markUnsupportedDomains() {
    if (!YS || !YS.isLoaded || !YS.isLoaded()) return;
    const name = school === 'feipan' ? '飞盘' : '转盘';
    [...$('inDomain').options].forEach((o) => {
      if (!o.value) return;
      const base = o.dataset.base || (o.dataset.base = o.textContent.replace(/（.*不支持）$/, ''));
      const m = YS.categoryMap(o.value, schoolKey());
      o.textContent = m.engineSupported ? base : base + '（' + name + '不支持）';
    });
  }
  /** 年命：引擎只收天干（甲须连支）；规则 6 要完整干支 */
  function nianMingGanForEngine(gz) { return !gz ? '' : gz[0] === '甲' ? gz : gz[0]; }

  /* ---------- 合盘：奇门九宫居中，外圈十二支按地盘方位排 ----------
   * 外圈每格是一个地盘支的方位（巽四上方为巳、左方为辰，依此类推），
   * 格内写加临其上的天盘支、所乘天将、遁干。版式参照热卜「奇门穿壬」。 */
  const OUTER = [   // [地盘支, 行, 列]，5×5 网格，中间 3×3 为奇门九宫
    ['巳', 1, 2], ['午', 1, 3], ['未', 1, 4],
    ['申', 2, 5], ['酉', 3, 5], ['戌', 4, 5],
    ['亥', 5, 4], ['子', 5, 3], ['丑', 5, 2],
    ['寅', 4, 1], ['卯', 3, 1], ['辰', 2, 1],
  ];
  const JIANG_SHORT = { 贵人: '贵', 螣蛇: '蛇', 朱雀: '朱', 六合: '六', 勾陈: '勾', 青龙: '青', 天空: '空', 白虎: '白', 太常: '常', 玄武: '玄', 太阴: '阴', 天后: '后' };
  let view = 'merged';   // 'merged' 合盘 | 'qimen' 只看奇门盘

  function outerBox(ln, dun, di, row, col, marks) {
    const tian = ln.tianOver(di), jiang = ln.jiangOf(tian), ji = TDP.JI_JIANG.has(jiang);
    const gan = dun[tian];
    const side = col === 1 || col === 5;
    const cls = ['cr-ob', side ? 'cr-ob-v' : 'cr-ob-h', jiang === '贵人' ? 'ob-gui' : '', gan ? '' : 'ob-kong'].join(' ');
    const tags = marks.map(m => `<span class="ob-tag">${m}</span>`).join('');
    const tip = `地盘${di}上天盘${tian} · ${jiang}${ji ? '（吉）' : '（凶）'} · ${gan ? '遁干' + gan : '旬空'}`;
    const ganHtml = gan ? `<span class="ob-gan">${gan}</span>` : '<span class="ob-gan ob-kong-t">○</span>';
    const jHtml = `<span class="ob-jiang ${ji ? 'ji' : 'xiong'}">${JIANG_SHORT[jiang]}</span>`;
    const inner = side
      ? `<span class="ob-zhi">${tian}</span>${jHtml}${ganHtml}<span class="ob-di">${di}</span>${tags}`
      : `<div><span class="ob-zhi">${tian}</span>${jHtml}</div><div>${ganHtml}<span class="ob-di">${di}位</span>${tags}</div>`;
    return `<div class="${cls}" style="grid-row:${row};grid-column:${col}" title="${tip}">${inner}</div>`;
  }

  function renderBoard(pan, res) {
    const cellFn = school === 'feipan' ? cellFeipan : cellZhuanpan;
    const cls = school === 'feipan' ? 'pan-grid feipan-grid' : 'pan-grid';
    const grid = `<div class="${cls}">${GRID_ORDER.map(g => cellFn(pan, g)).join('')}</div>`;
    if (!res || view === 'qimen') {
      $('chart').innerHTML = `<div class="qimen-pan"><div class="pan-outer">${grid}</div></div>` + HARM_LEGEND;
    } else {
      const ln = TDP.build({ riGan: pan.siZhu.day[0], yueJiang: res.yueJiang.yueJiang, shiZhi: pan.siZhu.time[1] });
      const dun = TDP.dunGan(pan.siZhu.day);
      const r6 = res.rules.find(x => x.rule === 6);
      const benMing = r6 && r6.benMingZhi;
      const outer = OUTER.map(([di, r, c]) => outerBox(ln, dun, di, r, c, di === benMing ? ['命'] : [])).join('');
      $('chart').innerHTML = `<div class="qimen-pan cr-pan"><div class="cr-board">${outer}
        <div class="cr-center pan-outer">${grid}</div></div></div>` + HARM_LEGEND +
        `<div class="cr-legend">
          <span><i class="sw sw-me"></i>我宫</span><span><i class="sw sw-shi"></i>事宫</span><span><i class="sw sw-dir"></i>第二方位</span>
          <span><b class="ji">吉将</b>／<b class="xiong">凶将</b></span><span><span class="ob-tag">命</span>本命</span>
          <span class="muted">外圈：地盘方位上所加的天盘支、天将、遁干；○＝六壬旬空，不配遁干</span>
        </div>`;
    }
    // 点宫跳到九宫详解
    $('chart').querySelectorAll('.pan-grid .gong').forEach((el, i) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => { const t = document.getElementById('xj-g' + GRID_ORDER[i]); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.add('xj-hit'); setTimeout(() => t.classList.remove('xj-hit'), 1200); } });
    });
    // 我宫、事宫、第二方位：只加内阴影描边，不动宫格内的排版
    const R = String((res && res.quYong.R) || ''), Y = String((res && res.quYong.Y) || '');
    const r5 = res && res.rules.find(x => x.rule === 5);
    const dirs = new Set(((r5 && r5.secondGongs) || []).map(String));
    $('chart').querySelectorAll('.pan-grid .gong').forEach((el, i) => {
      const g = GRID_ORDER[i];
      if (g === R) el.classList.add('cr-me');
      if (g === Y) el.classList.add('cr-shi');
      if (dirs.has(g)) el.classList.add('cr-dir');
    });
  }

  /* ---------- 穿壬层 ---------- */
  const RULE_NAME = { 1: '用神天将', 2: '五行推理·天盘支', 3: '末传落宫', 4: '空亡互检', 5: '方位第二意见', 6: '命干',
    7: '应期融合·穿壬', 8: '类神入传', 9: '贵人互参', 10: '我彼双读' };
  const GONG_LABEL = (g) => { const J = QM.JIU_GONG[String(g)] || {}; return (J.name || '') + NUM_CN[+g]; };

  function voteHtml(r) {
    if (r.rule === 5 || r.rule === 7 || (r.rule === 4 && !r.applicable && r.Y)) return '<span class="vote z">—</span>';   // 规则 7 只给应期
    if (r.verdict === '混') return '<span class="vote z">混</span>';   // 规则 5 只给方位；规则 4 事宫不空不投票
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
    if (r.rule === 3 && r.applicable) {
      return `末传${esc(r.mo)}临地盘${esc(r.moDi)}，落${GONG_LABEL(r.moGong)}（${esc(r.moWx)}）对我宫${GONG_LABEL(r.R)}（${esc(r.meWx)}）：<b>${esc(r.relation)}</b>`;
    }
    if (r.rule === 4 && r.applicable) {
      return `事宫${GONG_LABEL(r.Y)}奇门空亡；末传${esc(r.mo)}${r.moKong ? '亦落六壬旬空' : '不空'} → <b>${esc(r.verdict)}</b>${r.yingQi ? `；应期候选：${esc(r.yingQi)}` : ''}`;
    }
    if (r.rule === 5 && r.applicable) {
      return `奇门方位 ${GONG_LABEL(r.qimenGong)}；第二方位 <b>${r.secondGongs.map(GONG_LABEL).join('、')}</b>`;
    }
    if (r.rule === 6 && r.applicable) {
      return `本命${esc(r.benMingZhi)}上神${esc(r.shangShen)}（${esc(r.meWx)}，乘${esc(r.shangShenJiang)}）对事宫天盘支（${(r.yZhi || []).join('')}，${esc(r.yWx)}）：<b>${esc(r.relation)}</b>`;
    }
    if (r.rule === 7) {
      if (!r.applicable) return '';
      const qp = Object.entries(r.qimenParts || {}).map(([k, v]) => `${esc(k)} ${v.join('') || '—'}`).join('；');
      const lp = Object.entries(r.parts || {}).map(([k, v]) => `${esc(k)} ${v.join('')}`).join('；');
      return `应期日支：<b>${r.picks.map(esc).join('、')}</b>（${esc(r.how)}）<div class="muted">奇门融合法 v1 取 ${r.qimenPicks.join('')}（${qp}）<br>六壬三法：${lp}</div>`;
    }
    if (r.rule >= 8 && r.rule <= 10 && (r.lrWhy || r.qmWhy)) {
      const sg = (v) => v > 0 ? '＋' : v < 0 ? '－' : '〇';
      const head = r.rule === 8 ? `类神（${esc(r.leiShen)}）${r.inChuan && r.inChuan.length ? '入传：' + r.inChuan.join('') : ''}<br>` : '';
      return `${head}六壬${sg(r.lr)} ${esc(r.lrWhy)}<br>奇门${sg(r.qm)} ${esc(r.qmWhy)}${r.verdict && r.verdict !== '混' ? ` → <b>${esc(r.verdict)}</b>` : ''}`
        + (r.rule === 8 ? '<div class="muted">规则 8 判「事是否成形」，不等于如愿；问怕发生之事时，＋1 反是坏消息。</div>' : '');
    }
    return '';
  }

  /* ---------- 奇门分析：照 Qimen-pwa renderAnalysis 搬来（只展示引擎已算好的结果） ---------- */
  function qimenAnalysisPanels(pan) {
    const a = pan.analysis || {};
    const purpose = (pan.basicInfo && pan.basicInfo.purpose) || '综合';
    let html = '';
    if (school === 'feipan') html += `<p class="muted">飞盘解断复用通用奇门基线(五行生克/十干克应/门迫/空亡/格局/用神)，飞盘专法(遁干81格/三乙四宫)以 AI 占断为准。</p>`;
    html += `<div class="panel"><h3>分析与建议 · 目的：${esc(purpose)}</h3>`;
    if (a.yongShen) html += `<p>用神（${esc(purpose)}）：<b>${esc(a.yongShen.name)}</b> 落 <b>${esc(a.yongShen.direction)}方(${esc(a.yongShen.gongName)}宫，${esc(a.yongShen.jiXiongText)})</b> <span class="muted">${esc(a.yongShen.tip)}</span></p>`;
    else html += `<p class="muted">目的「${esc(purpose)}」无专一用神，综观全盘。</p>`;
    if (Array.isArray(a.suggestions) && a.suggestions.length) html += `<b>建议:</b><ul class="suggestion-list">${a.suggestions.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    html += `</div><div class="panel"><h3>格局</h3>`;
    if (Array.isArray(pan.geju) && pan.geju.length) html += `<ul class="geju-list">${pan.geju.map(g => `<li><b>${esc(g.name)}</b>${g.gong ? '(' + g.gong + '宫)' : ''} — ${esc(g.explain || (g.jiXiong === 'ji' ? '吉' : g.jiXiong === 'xiong' ? '凶' : '平'))}</li>`).join('')}</ul>`;
    else html += `<p class="muted">本盘未见显著格局。</p>`;
    return html + `</div>`;
  }

  /* ---------- 九宫详解：奇门一行（引擎）＋ 六壬一行（本宫地盘支上的天盘支、天将、遁干，天将×六亲象义） ---------- */
  function jiuGongPanel(pan, res) {
    const ja = pan.jiuGongAnalysis || {}, sc = res.sanChuan, ln = sc.liuren;
    const dun = TDP.dunGan(pan.siZhu.day), kong = new Set(res.liuren.xunKong), riGan = pan.siZhu.day[0];
    const R = String(res.quYong.R || ''), Y = String(res.quYong.Y || '');
    const r5 = res.rules.find(x => x.rule === 5), dirs = new Set(((r5 && r5.secondGongs) || []).map(String));
    const chuanAt = {}; sc.chuan.forEach((z, i) => { (chuanAt[z] = chuanAt[z] || []).push('初中末'[i] + '传'); });
    const keUp = new Set(sc.ke.map(k => k.shang));
    let html = `<div class="panel" id="jiuGongXiangJie"><h3>九宫详解 <span class="muted" style="font-weight:normal;">点盘上任一宫可跳到这里</span></h3><div class="gong-details">`;
    for (let i = 1; i <= 9; i++) {
      const g = String(i), d = ja[i] || {};
      const roles = (g === R ? '<span class="cr-role me">我</span>' : '') + (g === Y ? '<span class="cr-role shi">事</span>' : '') + (dirs.has(g) ? '<span class="cr-role dir">向</span>' : '');
      html += `<div class="xj-gong" id="xj-g${i}"><div><b>${roles}${i}-${esc(d.gongName || GONG_LABEL(i))}</b> <span class="muted">${esc(d.direction || '')}</span> · ${esc(d.jiXiongText || '')}`
        + `${d.isYongShen ? ' <b style="color:#3c763d;">【用神·' + esc(d.yongShenName) + '】</b>' : ''}${d.keYing ? '[' + esc(d.keYing.name) + ']' : ''}${d.menPo ? ' [门迫]' : ''}${d.kongWang ? ' [空亡]' : ''}${d.yiMa ? ' [驿马]' : ''}`
        + `<br><span class="muted">${esc(d.explain || '')}</span></div>`;
      for (const di of (TDP.GONG_ZHI[i] || [])) {
        const t = ln.tianOver(di), j = ln.jiangOf(t), x = XY.read(j, t, riGan);
        const marks = [...(chuanAt[t] || []), keUp.has(t) ? '入课' : '', kong.has(t) ? '六壬旬空' : ''].filter(Boolean);
        html += `<div class="xj-lr"><span class="muted">六壬·${di}位</span> 上${t}·<span class="${TDP.JI_JIANG.has(j) ? 'ji' : 'xiong'}">${j}</span>·${dun[t] || '○'}`
          + `（${x.liuQin}）${marks.length ? ' <span class="xj-mark">' + marks.join('·') + '</span>' : ''}：${esc(x.text)}${x.fromBase ? '<span class="muted">（书未载此组合，取本义）</span>' : ''}</div>`;
      }
      if (!(TDP.GONG_ZHI[i] || []).length) html += `<div class="xj-lr muted">六壬·中五无支</div>`;
      html += `</div>`;
    }
    return html + `</div><p class="muted" style="margin:6px 0 0;">奇门一行为引擎解断（同 Qimen-pwa）。六壬一行：本宫地盘支上所加天盘支·天将·遁干，括号内为该支对日干的六亲；
      象义取 ${esc(XY.SOURCE)}，书中原则「以十二神与六亲的结合为准」。我＝我宫，事＝事宫，向＝规则 5 第二方位。</p></div>`;
  }

  /** 四课三传（版式同六壬书：四课右起第一课，上行天将、中行上神、下行下神） */
  function sanChuanPanel(pan, res) {
    const sc = res.sanChuan;
    if (!sc) return '';
    const ln = sc.liuren, dun = TDP.dunGan(pan.siZhu.day), kong = new Set(res.liuren.xunKong);
    const jx = (z) => { const j = ln.jiangOf(z); return `<span class="${TDP.JI_JIANG.has(j) ? 'ji' : 'xiong'}">${JIANG_SHORT[j]}</span>`; };
    const ke = sc.ke.slice().reverse();   // 第四课在左，第一课在右
    const keHtml = `<table class="ke-table"><tr>${ke.map(k => `<td>${jx(k.shang)}</td>`).join('')}</tr>
      <tr>${ke.map(k => `<td class="ke-up">${k.shang}</td>`).join('')}</tr>
      <tr>${ke.map(k => `<td class="ke-down">${k.xia}</td>`).join('')}</tr>
      <tr class="muted">${ke.map(k => `<td>第${'一二三四'[k.n - 1]}课</td>`).join('')}</tr></table>`;
    const chHtml = `<table class="chuan-table">${sc.chuan.map((z, i) => `<tr><td class="muted">${'初中末'[i]}传</td>
      <td>${dun[z] || '<span class="muted">○</span>'}</td><td class="ke-up">${z}${kong.has(z) ? '<sup class="kong-mark">空</sup>' : ''}</td><td>${jx(z)}</td>
      <td class="muted">临${ln.diUnder(z)}·${GONG_LABEL(TDP.ZHI_GONG[ln.diUnder(z)])}</td></tr>`).join('')}</table>`;
    return `<div class="panel"><h3>四课三传 <span class="exp-badge">${esc(sc.name)}</span></h3>
      <div class="sc-wrap">${chHtml}${keHtml}</div>
      <p class="muted" style="margin:6px 0 0;">${esc(sc.why)}。三传取法据伍剑虹《大六壬精义讲解》，涉害取深浅法；
        「临」＝该支加在地盘何位、属奇门何宫。空＝六壬日旬空，○＝旬空无遁干。</p>
      ${sc.flags.length ? `<p class="muted" style="margin:4px 0 0;color:#8a6d3b;">${sc.flags.map(esc).join('；')}</p>` : ''}</div>`;
  }


  /* ---------- 书中同课案例 ---------- */
  function bookCaseHtml(c, lv, open) {
    const title = (BOOK && BOOK._books && BOOK._books[c.book]) || c.book;
    const short = c.book === 'wang' ? '王雷之' : c.book === 'wu' ? '伍剑虹' : c.book;
    const jiang = c.yueJiang ? `${c.yueJiang}将${c.yueJiangDerived ? '<span class="muted">(推)</span>' : ''}` : '';
    const shi = c.shiZhi ? `${c.shiZhi}时` : '';
    const chuan = c.chuanBook || c.chuanEngine;
    const lvTag = lv ? `<span class="bk-lv ${lv.key}">${lv.label}</span>` : '';
    const notes = [];
    if (c.flags.includes('活动时')) notes.push('日柱与书记公历日不同，当为活动时（抽签取干支）');
    if (c.flags.includes('书中三传与本 app 不同')) notes.push(`本 app 起得 ${c.chuanEngine}（${c.keTiEngine}）`);
    if (c.bookNote) notes.push(c.bookNote);
    return `<details class="bk-case"${open ? ' open' : ''}><summary>${lvTag}<b>${esc(c.q)}</b>
        <span class="bk-meta">　${esc(short)} ${esc(c.id.replace(/^[^-]+-/, '例'))}·p${esc(c.page)}${c.cat ? '·' + esc(c.cat) : ''}</span></summary>
      <div class="bk-meta">${esc(c.riZhu)}日 ${jiang}${shi}${c.zhouYe ? '（' + esc(c.zhouYe) + '）' : ''}　三传 ${esc(chuan)}${c.keTiBook ? '　' + esc(c.keTiBook) : ''}
        ${c.date ? '　' + esc(c.date) : ''}${c.ganzhiNote ? '　' + esc(c.ganzhiNote) : ''}${c.src ? '　出自' + esc(c.src) : ''}</div>
      ${c.read ? `<div><b>断</b> ${esc(c.read)}</div>` : ''}
      ${c.out ? `<div><b>验</b> ${esc(c.out)}</div>` : ''}
      ${notes.length ? `<div class="bk-flag">${notes.map(esc).join('；')}</div>` : ''}
      <div class="muted">${esc(title)}（摘要，非原文）</div></details>`;
  }

  function renderBookMatches(pan, res) {
    const box = $('bookCases');
    if (!box) return;
    if (!BOOK) { box.innerHTML = '<div class="panel"><h3>书中同课案例</h3><p class="muted">案例库载入中…</p></div>'; return; }
    const cur = { riZhu: pan.siZhu.day, yueJiang: res.yueJiang.yueJiang, shiZhi: pan.siZhu.time[1], chuan: res.sanChuan && res.sanChuan.chuan };
    const m = CM.match(BOOK.cases, cur);
    let html = `<div class="panel"><h3>书中同课案例 <span class="exp-badge">${m.total ? m.total + ' 例' : '无'}</span></h3>`;
    if (!m.total) {
      html += `<p class="muted" style="margin:0;">两本书 ${BOOK.cases.length} 例中，没有与本课（${esc(cur.riZhu)}日 ${esc(cur.yueJiang)}将${esc(cur.shiZhi)}时，三传 ${esc((cur.chuan || []).join(''))}）同课或同三传的案例。</p>`;
    }
    for (const lv of CM.LEVELS) {
      const list = m[lv.key];
      if (!list.length) continue;
      html += `<div class="muted" style="margin-top:6px;">${lv.label}：${esc(lv.note)}</div>`;
      html += list.map(c => bookCaseHtml(c, lv, lv.key !== 'tongChuan')).join('');
    }
    html += `<details id="bkBrowse" style="margin-top:8px;"><summary>浏览全部书中案例（${BOOK.cases.length} 例）</summary>
      <input id="bkSearch" class="bk-search" placeholder="搜问事、日柱、三传、课体…"><div id="bkAll"></div></details>
      <p class="muted" style="margin:6px 0 0;">${Object.values(BOOK._books || {}).map(esc).join('、')}。盘式照书录入，问事、断法、应验是摘要，注明页码，请以原书为准。
      同课＝日柱与天地盘相同，四课三传全同；同三传＝三传相同而日柱不同。</p></div>`;
    box.innerHTML = html;
    const all = $('bkAll'), q = $('bkSearch');
    const draw = () => {
      const k = (q.value || '').trim();
      const hit = BOOK.cases.filter(c => !k || [c.q, c.read, c.out, c.riZhu, c.chuanBook, c.chuanEngine, c.keTiBook, c.cat, c.id].join(' ').includes(k));
      const g = CM.byCategory(hit);
      all.innerHTML = Object.keys(g).map(cat => `<div class="muted" style="margin-top:6px;">${esc(cat)}（${g[cat].length}）</div>` + g[cat].map(c => bookCaseHtml(c, null, false)).join('')).join('') || '<p class="muted">没有符合的案例。</p>';
    };
    q.addEventListener('input', draw);
    $('bkBrowse').addEventListener('toggle', function once() { draw(); }, { once: true });
  }

  function renderChuanRen(pan, res) {
    const R = String(res.quYong.R || ''), Y = String(res.quYong.Y || '');
    const yj = res.yueJiang, L = res.liuren;

    let html = `<div class="panel"><h3>六壬层 <span class="exp-badge">实验</span></h3>
      <div style="font-size:13px;line-height:1.8;">
        <b>月将</b> ${esc(yj.yueJiang)}（${esc(yj.zhongQi || '')}后${yj.since ? '，自 ' + esc(yj.since) : ''}）
        <span class="muted">月将切换规则${esc(yj.status)}</span><br>
        <b>占时</b> ${esc(pan.siZhu.time[1])}　<b>${esc(L.zhouYe)}贵</b> ${esc(L.guiRen)} 加地盘 ${esc(L.guiRenOverDi)}，${L.shun ? '顺' : '逆'}行
        　<b>六壬日旬空</b> ${esc(L.xunKong.join(''))}<br>
        <b>取用</b> 我＝${esc(res.quYong.rLabel)}${R ? GONG_LABEL(R) : '（未定）'}　事＝${esc(res.quYong.yName || '')}宫${Y ? GONG_LABEL(Y) : '（未定）'}
      </div></div>`;

    html += sanChuanPanel(pan, res);
    html += '<div id="bookCases"></div>';
    html += qimenAnalysisPanels(pan);
    html += jiuGongPanel(pan, res);

    html += `<div class="panel"><h3>穿壬规则 <span class="exp-badge">未检验</span></h3>
      <table class="rule-table"><thead><tr><th>规则</th><th>票</th><th>依据</th></tr></thead><tbody>`;
    for (const r of res.rules) {
      html += `<tr><td>${r.rule}　${RULE_NAME[r.rule]}</td><td>${voteHtml(r)}</td><td>${ruleDetail(r)}${r.reason ? `<div class="muted">${esc(r.reason)}</div>` : ''}</td></tr>`;
    }
    html += `</tbody></table>
      <p class="muted" style="margin:6px 0 0;">自创实验流派（appliesTo: ${esc(res.appliesTo)}）。+1／−1 只是关系分值，不等于吉或成功；
      各规则分开计票、不相加，冲突原样保留。规则 3、4 依第二层三传（涉害取深浅法）。
      规则 7–10 为 v2：奇门、六壬两边同向才投票，相反记「混」。</p></div>`;
    $('chuanren').innerHTML = html;
    renderBookMatches(pan, res);
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
    const dom = resolveDomain(), ui = dom.ui;
    lastDomainUi = ui;
    renderDomainTag(dom);
    markUnsupportedDomains();
    const nianMing = $('inNianMing').value;
    const opts = school === 'feipan'
      ? { method: '时家', purpose: ui }
      : { type: '四柱', method: '时家', purpose: ui, location: '默认位置' };   // 同 Qimen-pwa：引擎按占类取用神
    if (juShu) opts.juShu = juShu;
    const pan = school === 'feipan' ? QM.feipanQimen.calculate(date, opts) : QM.qimen.calculate(date, opts);
    if (pan.error) { $('chuanren').innerHTML = `<div class="panel">排盘出错：${esc(pan.message)}</div>`; return; }
    if (!pan.jiuGongAnalysis) pan.jiuGongAnalysis = {};
    renderBasicInfo(pan);

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
      renderBoard(pan, res);
      renderChuanRen(pan, res);
      window._chuanren = res;
      // 供 AI 解读（web/ai.js）取用：同一张盘、同一份穿壬结果，不重算
      window._chuanrenCtx = { pan, res, school, date, ui, domainSource: dom.source, nianMing, engineCategory: engineCategoryOf(ui, school), dateStr: `${$('inDate').value} ${$('inTime').value}` };
    } catch (e) {
      renderBoard(pan, null);
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
  $('viewSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    view = b.dataset.view;
    [...$('viewSeg').children].forEach(x => x.classList.toggle('on', x === b));
    cast();
  });
  $('castBtn').addEventListener('click', cast);
  // 自动判定时，问句一改就重判占类；占类真变了才重排盘
  let qTimer = null;
  $('aiQuestion').addEventListener('input', () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      if ($('inDomain').value) return;
      const d = resolveDomain();
      if (d.ui !== lastDomainUi) cast(); else renderDomainTag(d);
    }, 400);
  });
  ['inDomain', 'inNianMing'].forEach(id => $(id).addEventListener('change', cast));

  fillNianMing(); setNow();
  fetch('knowledge/liuren-cases.json').then(r => r.json())
    .then(d => { BOOK = d; const c = window._chuanrenCtx; if (c && c.res) renderBookMatches(c.pan, c.res); })
    .catch(e => console.warn('[书中案例] 载入失败：', e.message));
  fetch('vendor/qimen-pwa/knowledge/domains.json').then(r => r.json())
    .then(d => { DOMAINS = d; if (YS && YS.load) YS.load(d); })
    .catch(e => console.warn('[domains] 载入失败，占类一律按时干宫取：', e.message))
    .finally(cast);
})();
