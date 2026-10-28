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
    assert(rows.length === 4, label + '：规则表不是四行');
    assert(/月将/.test(d.getElementById('chuanren').textContent), label + '：缺月将');
    console.log(`✓ ${label}：${[...rows].map((r) => r.children[0].textContent.trim() + ' ' + r.children[1].textContent.trim()).join(' ｜ ')}`);
  }

  d.getElementById('inDate').value = '2026-10-28';
  d.getElementById('inTime').value = '15:30';
  d.getElementById('inDomain').value = '财运';
  d.getElementById('inNianMing').value = '庚午';
  d.getElementById('castBtn').click();
  check('转盘 2026-10-28 15:30 财运 年命庚午');
  assert(/卯/.test(d.getElementById('chuanren').textContent), '霜降后应为卯将');

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
    assert(m.user.includes('【穿壬·六壬层】') && m.user.includes('规则1') && m.user.includes('规则6'), name + '：缺穿壬段');
    assert(m.user.includes('【旺衰与四害'), name + '：缺旺衰块');
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

  d.querySelector('#viewSeg button[data-view="qimen"]').click();
  assert(!d.querySelector('.cr-board') && d.querySelectorAll('#chart .gong').length === 9, '只看奇门：应无外圈');
  console.log('✓ 只看奇门：外圈收起');

  assert(!errors.length, '页面报错：' + errors.join(' / '));
  console.log('冒烟通过，无脚本报错。');
  w.close(); srv.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
