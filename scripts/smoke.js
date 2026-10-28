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
  d.getElementById('inNianMing').value = '庚午';
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
  fb.querySelector('input[value="hope"]').checked = true; fb.querySelector('input[value="yes"]').checked = true; fb.querySelector('input[value="wish"]').checked = true;
  fb.querySelector('button[data-act="archive"]').click();
  for (let i = 0; i < 40 && /待回填 1/.test(d.getElementById('caseCountTag').textContent); i++) await sleep(50);
  assert(/共 1 条，待回填 0/.test(d.getElementById('caseCountTag').textContent), '归档失败：' + d.getElementById('caseCountTag').textContent);
  d.querySelector('#caseTabSeg button[data-tab="stats"]').click();
  assert(/可计分的是非题 1 题/.test(d.getElementById('caseBody').textContent) && /未到评估点/.test(d.getElementById('caseBody').textContent), '准确率页不对');
  console.log('✓ 案例本：存（含 AI 解读）→ 回填归档 → 准确率页');

  d.querySelector('#viewSeg button[data-view="qimen"]').click();
  assert(!d.querySelector('.cr-board') && d.querySelectorAll('#chart .gong').length === 9, '只看奇门：应无外圈');
  console.log('✓ 只看奇门：外圈收起');

  assert(!errors.length, '页面报错：' + errors.join(' / '));
  console.log('冒烟通过，无脚本报错。');
  w.close(); srv.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
