/**
 * 冒烟测试：在 jsdom 里打开 dist/index.html，按真实页面载入全部脚本，
 * 排转盘、飞盘各一次，检查奇门盘、穿壬九宫、规则表都画出来了，且没有报错。
 * 用法：npm run build && npm run smoke
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const DIST = path.join(__dirname, '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      if (!p.startsWith(DIST) || !fs.existsSync(p)) { res.statusCode = 404; return res.end(); }
      res.setHeader('Content-Type', TYPES[path.extname(p)] || 'application/octet-stream');
      fs.createReadStream(p).pipe(res);
    }).listen(0, () => resolve(srv));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(c, msg) { if (!c) throw new Error('冒烟失败：' + msg); }

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/`;
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message));
  vc.on('error', (...a) => errors.push(a.join(' ')));
  const dom = await JSDOM.fromURL(base + 'index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.fetch = (u) => fetch(new URL(u, base)); },
  });
  const w = dom.window, d = w.document;
  for (let i = 0; i < 50 && !d.querySelector('.cr-board'); i++) await sleep(100);

  function check(label) {
    assert(d.querySelectorAll('#chart .gong').length === 9, label + '：奇门盘不是九宫');
    assert(d.querySelectorAll('.cr-board .cr-ob').length === 12, label + '：合盘外圈不是十二格');
    assert(d.querySelectorAll('.cr-board .cr-center .gong').length === 9, label + '：合盘中间不是九宫');
    assert(d.querySelectorAll('.cr-ob.ob-gui').length === 1, label + '：贵人不是正好一格');
    const rows = d.querySelectorAll('.rule-table tbody tr');
    assert(rows.length === 10, label + '：规则表不是十行');
    assert(d.querySelectorAll('.xj-gong').length === 9 && d.querySelectorAll('.xj-lr').length === 13, label + '：九宫详解应九宫、十二支加中五一行');
    assert(/格局/.test(d.getElementById('chuanren').textContent), label + '：缺格局');
    assert(/月将/.test(d.getElementById('chuanren').textContent), label + '：缺月将');
    assert(d.querySelectorAll('.chuan-table tr').length === 3 && d.querySelectorAll('.ke-table .ke-up').length === 4, label + '：缺四课三传');
    console.log(`✓ ${label}：${[...rows].map((r) => r.children[0].textContent.trim() + ' ' + r.children[1].textContent.trim()).join(' ｜ ')}`);
  }

  d.getElementById('inDate').value = '2026-10-28';
  d.getElementById('inTime').value = '15:30';
  // 占类自动判定：留「跟随问句自动判定」，问句含「考试」→ 学业（引擎功名）；显式选择优先
  d.getElementById('inDate').value = '2026-10-28';
  d.getElementById('inTime').value = '15:30';
  d.getElementById('inDomain').value = '';
  d.getElementById('aiQuestion').value = '这次考试能考上吗？';
  d.getElementById('castBtn').click();
  assert(/「学业」/.test(d.getElementById('domainTag').textContent) && /自动判定/.test(d.getElementById('domainTag').textContent), '自动判定占类不对：' + d.getElementById('domainTag').textContent);
  assert(w._chuanrenCtx.ui === '学业' && w._chuanrenCtx.domainSource === 'auto', '自动占类未用于排盘');
  d.getElementById('aiQuestion').value = '';
  d.getElementById('castBtn').click();
  assert(/综合/.test(d.getElementById('domainTag').textContent), '无问句应暂按综合');
  console.log('✓ 占类自动判定：' + '学业／空问句综合');
  d.getElementById('inDomain').value = '财运';
  { const g = d.getElementById('inNmGan'), z = d.getElementById('inNmZhi');
    assert(g.options.length === 11, '年干应为 10 个加「不提供」');
    g.value = '庚'; g.dispatchEvent(new w.Event('change'));
    assert([...z.options].map((o) => o.value).filter(Boolean).join('') === '子寅辰午申戌', '庚年年支只列阳支');
    z.value = '午'; z.dispatchEvent(new w.Event('change'));
    assert(d.getElementById('inNianMing').value === '庚午', '年命未合成干支');
    g.value = '甲'; g.dispatchEvent(new w.Event('change'));
    z.value = ''; z.dispatchEvent(new w.Event('change'));
    assert(d.getElementById('inNianMing').value === '' && /甲年请选年支/.test(d.getElementById('nmHint').textContent), '甲年未选支应提示');
    g.value = '庚'; g.dispatchEvent(new w.Event('change')); z.value = '午'; z.dispatchEvent(new w.Event('change'));
    console.log('✓ 年命：年干 10 个，年支按阴阳只列 6 个'); }
  d.getElementById('castBtn').click();
  check('转盘 2026-10-28 15:30 财运 年命庚午');
  // 2026-10-28 15:30：乙亥日、卯将、申时（offset 7）。课一 乙寄辰上亥，下贼上之类由引擎定；只核对三传与引擎一致
  { const S = w.LiurenSanChuan.compute({ riGan: '乙', riZhi: '亥', yueJiang: '卯', shiZhi: '申' });
    const shown = [...d.querySelectorAll('.chuan-table .ke-up')].map((e) => e.textContent.replace('空', '')).join('');
    assert(shown === S.chuan.join(''), '页面三传与引擎不符：' + shown + ' vs ' + S.chuan.join(''));
    console.log('✓ 四课三传：' + S.name + ' ' + shown); }
  assert(/卯/.test(d.getElementById('chuanren').textContent), '霜降后应为卯将');

  // 书中同课案例：等案例库载入；2024-01-07 02:30 为庚午日丑将丑时，与伍剑虹书伍-10 全同
  for (let i = 0; i < 60 && /载入中/.test(d.getElementById('bookCases').textContent); i++) await new Promise((r) => setTimeout(r, 50));
  assert(/书中同课案例/.test(d.getElementById('bookCases').textContent), '缺书中同课案例面板');
  d.getElementById('inDate').value = '2024-01-07';
  d.getElementById('inTime').value = '02:30';
  d.getElementById('castBtn').click();
  { const bc = d.getElementById('bookCases');
    assert(bc.querySelector('.bk-lv.quanTong') && /家中被盗/.test(bc.textContent), '庚午日丑将丑时应列出伍-10（全同）：' + d.getElementById('basicInfo').textContent + ' ｜ ' + bc.textContent.slice(0, 200));
    d.getElementById('bkBrowse').open = true; d.getElementById('bkBrowse').dispatchEvent(new w.Event('toggle'));
    const n = d.querySelectorAll('#bkAll .bk-case').length;
    assert(n === JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../knowledge/liuren-cases.json'), 'utf8')).cases.length, '浏览全部案例条数不对：' + n);
    d.getElementById('bkSearch').value = '海湾'; d.getElementById('bkSearch').dispatchEvent(new w.Event('input'));
    assert(d.querySelectorAll('#bkAll .bk-case').length === 1, '搜索「海湾」应得一例');
    console.log(`✓ 书中同课案例：全同 ${bc.querySelectorAll('.bk-lv.quanTong').length}、同课 ${bc.querySelectorAll('.bk-lv.tongKe').length}、同三传 ${bc.querySelectorAll('.bk-lv.tongChuan').length}；浏览 ${n} 例`); }
  d.getElementById('inDate').value = '2026-10-28';
  d.getElementById('inTime').value = '15:30';
  d.getElementById('castBtn').click();

  d.querySelector('#schoolSeg button[data-school="feipan"]').click();
  check('飞盘 同一时刻');

  // AI：组出的提示词（两派各一次）+ 用假模型走一遍流式显示
  const AI = w.ChuanRenAI;
  assert(AI, 'AI 模块未载入');
  d.getElementById('inDomain').value = '财运';
  for (const sch of ['zhuanpan', 'feipan']) {
    d.querySelector(`#schoolSeg button[data-school="${sch}"]`).click();
    const m = await AI.buildMessages(w._chuanrenCtx, '这次投资能赚钱吗');
    const name = sch === 'feipan' ? '飞盘' : '转盘';
    const other = sch === 'feipan' ? '转盘奇门·解断方法纲要' : '飞盘奇门·解断方法纲要';
    assert(m.system.includes('解断方法纲要') && !m.system.includes(other), name + '：纲要串派或缺失');
    assert(m.user.includes('【穿壬·六壬层】') && m.user.includes('规则1') && m.user.includes('规则3') && m.user.includes('规则4') && m.user.includes('规则6') && m.user.includes('规则7') && m.user.includes('规则10'), name + '：缺穿壬段');
    assert(m.user.includes('【旺衰与四害'), name + '：缺旺衰块');
    assert(/三传（.+）：初传/.test(m.user) && m.user.includes('四课：第一课'), name + '：提示词缺四课三传');
    assert(m.category === '求财', name + '：占类应为求财，实为 ' + m.category);
    console.log(`✓ AI 提示词（${name}）：system ${m.system.length} 字，user ${m.user.length} 字，含纲要、旺衰、穿壬段`);
  }
  w.eval("LLM.chat = async (s, u, onTok) => { onTok('## 结论\\n可成。'); return '## 结论\\n可成。\\n\\n## 穿壬旁证\\n规则1 弃权'; }");
  d.getElementById('aiQuestion').value = '这次投资能赚钱吗';
  d.getElementById('aiBtn').click();
  for (let i = 0; i < 50 && d.getElementById('aiStatus').textContent !== '完成'; i++) await sleep(50);
  assert(d.getElementById('aiStatus').textContent === '完成', 'AI 未完成：' + d.getElementById('aiStatus').textContent);
  assert(/穿壬旁证/.test(d.getElementById('aiAnswer').textContent), 'AI 答案未显示');
  console.log('✓ AI 解读：假模型流式作答，答案已渲染');

  // 案例本：存 → 回填归档 → 准确率
  d.getElementById('caseSaveBtn').click();
  for (let i = 0; i < 40 && !d.querySelector('.case-card'); i++) await sleep(50);
  assert(/含 AI 解读/.test(d.getElementById('caseSaveTag').textContent), '存案例未带 AI 解读：' + d.getElementById('caseSaveTag').textContent);
  const fb = d.querySelector('.case-card .fb');
  // 回填同奇门 app：只写实况、选应验程度；是非题／盼怕／发生由 AI 标注员只看问句与实况代标
  fb.querySelector('button[data-act="archive"]').click();
  assert(/请先写 ① 实际发生了什么/.test(fb.textContent), '没写实况也能归档');
  w.eval(`window._labelCalls = 0; const _ans = LLM.chat; LLM.chat = async (s, u, a, b) => /标注员/.test(s)
    ? (window._labelCalls++, window._labelSeen = u, '{"isYesNo":true,"event":"投资赚钱","want":"hope","happened":"yes"}') : _ans(s, u, a, b);`);
  fb.querySelector('[data-k="note"]').value = '赚了两万';
  fb.querySelector('input[value="happened"]').checked = true;
  fb.querySelector('button[data-act="archive"]').click();
  for (let i = 0; i < 60 && /待回填 1/.test(d.getElementById('caseCountTag').textContent); i++) await sleep(50);
  assert(w._labelCalls === 1 && !/生门|规则|结论/.test(w._labelSeen), '标注员没调用，或看到了盘与断语');
  assert(/共 1 条，待回填 0/.test(d.getElementById('caseCountTag').textContent), '归档失败：' + d.getElementById('caseCountTag').textContent);
  d.querySelector('#caseTabSeg button[data-tab="stats"]').click();
  assert(/可计分的是非题 1 题/.test(d.getElementById('caseBody').textContent) && /未到评估点/.test(d.getElementById('caseBody').textContent), '准确率页不对');
  assert(/完全应验 1/.test(d.getElementById('caseBody').textContent) && /应验分 100\.0%/.test(d.getElementById('caseBody').textContent), '准确率页缺应验分');
  { const s0 = w.ChuanRenCases.stats(); assert(s0.ai.n === 1 && s0.ai.acc === 1, 'AI 结论方向未由应验推出'); }
  console.log('✓ 案例本：存（含 AI 解读）→ 只填实况与应验 → AI 盲标 → 准确率页');

  // 问句方向：怕发生之事要在提示词里点出；盼发生之事不点
  { const mFear = await AI.buildMessages(w._chuanrenCtx, '这次会不会被裁员');
    const mHope = await AI.buildMessages(w._chuanrenCtx, '这次投资能赚钱吗');
    assert(mFear.user.includes('⚠ 问句方向') && mFear.system.includes('【问句方向】'), '怕发生之事未点出');
    assert(!mHope.user.includes('⚠ 问句方向'), '盼发生之事不该点出问句方向');
    console.log('✓ 问句方向：怕发生之事已点出'); }
  // 改了问句：旧解读标灰；存案例不收旧解读；检出怕发生之事时回填预选「怕」
  d.querySelector('#caseTabSeg button[data-tab="open"]').click();
  d.getElementById('aiQuestion').value = '这次会不会被裁员';
  d.getElementById('aiQuestion').dispatchEvent(new w.Event('input'));
  assert(d.getElementById('aiAnswer').classList.contains('ai-stale') && /问句已改/.test(d.getElementById('aiStatus').textContent), '改问句后旧解读未标灰');
  d.getElementById('caseSaveBtn').click();
  for (let i = 0; i < 40 && !/已存/.test(d.getElementById('caseSaveTag').textContent + '') ; i++) await sleep(50);
  for (let i = 0; i < 40 && !/问句已改/.test(d.getElementById('caseSaveTag').textContent); i++) await sleep(50);
  assert(/问句已改，未含/.test(d.getElementById('caseSaveTag').textContent), '改问句后仍收了旧解读：' + d.getElementById('caseSaveTag').textContent);
  console.log('✓ 改问句：旧解读标灰、不入案例');

  // AI 复盘：已归档案例写好实况 → 按复盘 → 假模型回 JSON → 存进案例并显示；准确率页有复盘汇总
  d.querySelector('#caseTabSeg button[data-tab="done"]').click();
  { let card = d.querySelector('.case-card .fb');
    card.querySelector('[data-k="note"]').value = '没赚到，亏了三千';
    card.querySelector('input[value="not_happened"]').checked = true;
    card.querySelector('button[data-act="archive"]').click();
    for (let i = 0; i < 40 && !/没赚到/.test(d.getElementById('caseBody').innerHTML); i++) await sleep(50);
    w.eval(`LLM.chat = async (s, u) => JSON.stringify({ misreads: [{ claim: '可成。', basedOn: 'r8', actual: '亏了三千', why: '只看了生门旺相' }],
      verdict: 'partly_derivable', correction: '用神宫虽旺，规则 8 两边同吉却挂在旬空……', misweighted: [{ itemId: 'yong', how: 'overrated', why: '旺而有阻' }],
      lesson: '用神旺不等于得财', observations: [] })`);
    card = d.querySelector('.case-card .fb');
    assert(/规则对错/.test(card.textContent), '缺规则对错');
    card.querySelector('button[data-act="review"]').click();
    for (let i = 0; i < 60 && !d.querySelector('.rv-box'); i++) await sleep(50);
    const box = d.querySelector('.rv-box');
    assert(box && /断错分析/.test(box.textContent) && /可成。/.test(box.textContent) && /部分可断出/.test(box.textContent) && /下次留意/.test(box.textContent),
      '复盘未显示：' + (d.querySelector('[data-k="rvtag"]') || {}).textContent);
    assert((await w.ChuanRenCases.store.list()).some((r) => r.review && r.review.verdict === 'partly_derivable'), '复盘未存进案例');
    assert(!/未能重排/.test(box.textContent), '复盘时未能重排当时的盘');
    d.querySelector('#caseTabSeg button[data-tab="stats"]').click();
    assert(/复盘汇总（1 例）/.test(d.getElementById('caseBody').textContent) && /规则8/.test(d.getElementById('caseBody').textContent), '准确率页缺复盘汇总');
    console.log('✓ AI 复盘：断错分析、当时该怎么断、偏差、心得已存进案例；准确率页有复盘汇总'); }
  // 判读不对可手改：改成怕发生 → 记为手改，如愿翻转
  d.querySelector('#caseTabSeg button[data-tab="done"]').click();
  { const card = d.querySelector('.case-card .fb');
    card.querySelector('[data-lab="want"]').value = 'fear';
    card.querySelector('[data-lab="happened"]').value = 'no';
    card.querySelector('button[data-act="label-save"]').click();
    for (let i = 0; i < 40 && !/你改过/.test(d.getElementById('caseBody').textContent); i++) await sleep(50);
    assert(/怕它发生 · 没发生/.test(d.getElementById('caseBody').textContent) && /如愿/.test(d.querySelector('.case-card .lab').textContent), '手改判读未生效');
    console.log('✓ 判读手改：盼怕、发生可改，如愿随之重算'); }

  // 万年历：打开 → 月历格子 → 点一天看四柱时辰 → 用此日排盘、设为年命
  d.getElementById('calBtn').click();
  { const cp = d.getElementById('calPanel');
    assert(cp.style.display === 'block' && cp.querySelectorAll('.cal-c').length % 7 === 0 && cp.querySelectorAll('.cal-c').length >= 28, '万年历未打开或格子不对');
    cp.querySelector('select[data-cal="y"]').value = '2024'; cp.querySelector('select[data-cal="y"]').dispatchEvent(new w.Event('change', { bubbles: true }));
    cp.querySelector('select[data-cal="m"]').value = '2'; cp.querySelector('select[data-cal="m"]').dispatchEvent(new w.Event('change', { bubbles: true }));
    assert(/立春 4 日/.test(cp.textContent) && /癸卯 → 甲辰/.test(cp.textContent), '2024 年 2 月应见立春与年柱换年');
    cp.querySelector('.cal-c[data-date="2024-02-04"]').click();
    assert(/16:27 交立春/.test(d.getElementById('calDay').textContent) && d.querySelectorAll('#calDay button[data-cal="nm"]').length === 2, '立春当天应分交节前后两个年命');
    cp.querySelector('.cal-c[data-date="2024-02-03"]').click();
    assert(/年柱 癸卯/.test(d.getElementById('calDay').textContent) && /夜子/.test(d.getElementById('calDay').textContent), '立春前一天年柱应为癸卯');
    d.querySelector('#calDay button[data-cal="nm"]').click();
    assert(d.getElementById('inNmGan').value === '癸' && d.getElementById('inNmZhi').value === '卯', '设为年命未生效');
    d.querySelector('.cal-c[data-date="2024-02-10"]').click();
    d.querySelector('#calDay button[data-cal="use"]').click();
    assert(d.getElementById('inDate').value === '2024-02-10' && cp.style.display === 'none' && /2024-02-10/.test(d.getElementById('basicInfo').textContent), '用此日排盘未生效');
    d.getElementById('calBtn').click();
    assert(cp.querySelector('.cal-grid') && cp.querySelector('#calFindBox'), '万年历应同时有月历与四柱反查');
    const pick = (k, v) => { const e = cp.querySelector(`select[data-cal="${k}"]`); e.value = v; e.dispatchEvent(new w.Event('change', { bubbles: true })); };
    pick('fy', '丙午');
    assert([...cp.querySelectorAll('select[data-cal="fm"] option')].map((o) => o.value).join(' ') === '庚寅 辛卯 壬辰 癸巳 甲午 乙未 丙申 丁酉 戊戌 己亥 庚子 辛丑', '丙年月柱应按五虎遁列 12 个');
    pick('fm', '戊戌'); pick('fd', '丁丑');
    assert([...cp.querySelectorAll('select[data-cal="fh"] option')].length === 13, '时柱应为不限加 12 个');
    pick('fh', '乙巳');
    cp.querySelector('button[data-cal="find"]').click();
    assert(/共 3 处/.test(d.getElementById('calFind').textContent) && /2026-10-30/.test(d.getElementById('calFind').textContent), '四柱反查不对：' + d.getElementById('calFind').textContent);
    d.querySelector('#calFind button[data-cal="use"][data-date="2026-10-30"]').click();
    assert(d.getElementById('inDate').value === '2026-10-30' && d.getElementById('inTime').value === '10:00' && /丙午 戊戌 丁丑 乙巳/.test(d.getElementById('basicInfo').textContent), '反查后排盘四柱不对：' + d.getElementById('basicInfo').textContent);
    console.log('✓ 万年历：月历、立春换年、四柱时辰、设为年命、用此日排盘、四柱反查'); }

  d.querySelector('#viewSeg button[data-view="qimen"]').click();
  assert(!d.querySelector('.cr-board') && d.querySelectorAll('#chart .gong').length === 9, '只看奇门：应无外圈');
  console.log('✓ 只看奇门：外圈收起');

  assert(!errors.length, '页面报错：' + errors.join(' / '));
  console.log('冒烟通过，无脚本报错。');
  w.close(); srv.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
