const test = require('node:test');
const assert = require('node:assert/strict');
const RV = require('../core/review.js');

global.window = global.window || {};
require('../vendor/qimen-pwa/engine.bundle.js');
const QM = global.window.QM;

const CHART = QM.zhuanpanPredict.serializeChart(QM.qimen.calculate(new Date(2026, 9, 28, 15, 30), { type: '四柱', method: '时家', purpose: '财运', location: '默认位置' }));

function rec(o = {}) {
  return {
    id: 'c1', question: '这次投资能赚钱吗', framing: '', input: { ui: '财运', school: 'zhuanpan', date: '2026-10-28 15:30' },
    chart: { siZhu: {}, juShu: '' }, liuren: { yueJiang: '卯', keTi: '重审', sanChuan: ['午', '丑', '申'], xunKong: ['申', '酉'] },
    votes: [
      { rule: 1, applicable: false, vote: 0, verdict: '混' },
      { rule: 2, applicable: true, vote: -1, relation: '事克我' },
      { rule: 5, applicable: true, vote: 0, secondGongs: [3], qimenGong: 8 },
      { rule: 7, applicable: true, vote: 0, picks: ['未'], method: 'qimen-first' },
      { rule: 8, applicable: true, vote: 1, verdict: '两边同吉' },
      { rule: 9, applicable: true, vote: -1, verdict: '两边同凶' },
    ],
    wuxing: { score: 1, verdict: '如愿' },
    ai: { answer: '## 结论\n此财**可得**，生门旺相。\n\n应期在未日。', model: 'x' },
    feedback: Object.assign({ archived: true, type: 'yesno', want: 'hope', happened: 'no', aiVerdict: 'wish', note: '亏了三千', actualGong: '3', actualDayZhi: '酉' }, o.fb || {}),
  };
}
const LR = [{ id: 'ke', text: '四课：…' }, { id: 'sc', text: '三传：…' }, { id: 'gui', text: '贵人…' }, { id: 'xk', text: '六壬日旬空 申酉' }];

test('条目清单：九宫、值符、空亡、驿马、用神、总体、六壬四项、每条规则票、五行 v1，id 唯一', () => {
  const list = RV.items(rec(), CHART, LR);
  const ids = list.map((x) => x.id);
  for (const id of ['g1', 'g5', 'g9', 'zf', 'kw', 'ma', 'yong', 'zt', 'ke', 'sc', 'gui', 'xk', 'r1', 'r2', 'r5', 'r7', 'r8', 'r9', 'wx']) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(list.find((x) => x.id === 'r8').text, /\+1/);
  assert.match(list.find((x) => x.id === 'r1').text, /混/);
});

test('规则对错按实况确定性地算：规则 8 对发生，其余对如愿；规则 5 对方位，规则 7 对应期日支', () => {
  const by = Object.fromEntries(RV.ruleCheck(rec()).map((r) => [r.id, r.result]));
  assert.equal(by.ai, '错');      // 断如愿，实际没发生（盼的）→ 不如愿
  assert.equal(by.wx, '错');
  assert.equal(by.r1, '—');       // 混
  assert.equal(by.r2, '对');      // −1，实际不如愿
  assert.equal(by.r5, '对');      // 实际 3 宫在第二方位
  assert.equal(by.r7, '错');      // 实际酉日，所取未
  assert.equal(by.r8, '错');      // 断发生，实际没发生
  assert.equal(by.r9, '对');
  // 怕发生之事：没发生＝如愿；规则 8 仍对「发生」
  const fear = Object.fromEntries(RV.ruleCheck(rec({ fb: { want: 'fear' } })).map((r) => [r.id, r.result]));
  assert.equal(fear.ai, '对');
  assert.equal(fear.r8, '错');
  assert.equal(fear.r2, '错');
});

test('提示词：列条目与规则对错、附解读与实况，并写明不得新造断法、断不出就说', () => {
  const r = rec(), list = RV.items(r, CHART, LR);
  const { system, user } = RV.prompt(r, list);
  assert.match(system, /不新造断法/);
  assert.ok(user.includes('- r8 ｜ 规则8'));
  assert.ok(user.includes('规则8 类神入传：错'));
  assert.ok(user.includes('亏了三千'));
  assert.ok(user.includes('此财**可得**'));
  assert.match(user, /not_derivable/);
});

test('解析：原句须在解读里（容忍 Markdown 标记与空白）；条目 id 须存在；枚举不合法的丢弃', () => {
  const r = rec(), list = RV.items(r, CHART, LR);
  const out = '```json\n' + JSON.stringify({
    misreads: [
      { claim: '此财可得，生门旺相。', basedOn: 'yong', actual: '亏了', why: '高估生门' },   // 去掉 ** 后在解读里
      { claim: '必定大赚', basedOn: 'g8', actual: '亏了', why: '' },                       // 编造原句
      { claim: '应期在未日。', basedOn: 'r99', actual: '酉日', why: '' },                    // 依据不存在→清空
    ],
    verdict: 'partly_derivable', correction: '生门虽旺而空亡……', whyNotDerivable: 'x',
    misweighted: [{ itemId: 'kw', how: 'underrated', why: '空亡' }, { itemId: 'g8', how: 'bad', why: '' }, { itemId: 'zz', how: 'missed', why: '' }],
    lesson: '用神宫空亡先看虚实', observations: ['a', 'b', 'c', 'd'],
  }) + '\n```';
  const p = RV.parse(out, r, list);
  assert.ok(p.ok);
  assert.equal(p.misreads.length, 2);
  assert.equal(p.misreads[0].basedOn, 'yong');
  assert.equal(p.misreads[1].basedOn, '');
  assert.equal(p.misweighted.length, 1);
  assert.equal(p.whyNotDerivable, '');          // 非 not_derivable 不留
  assert.equal(p.observations.length, 3);
  assert.equal(p.dropped.length, 4);
  assert.equal(RV.parse('{"verdict":"maybe"}', r, list).ok, false);
  assert.equal(RV.parse('没有 JSON', r, list).ok, false);
  const nd = RV.parse('{"verdict":"not_derivable","correction":"x","whyNotDerivable":"盘上无相应之象"}', r, list);
  assert.equal(nd.correction, '');
  assert.equal(nd.whyNotDerivable, '盘上无相应之象');
});

test('无 AI 解读：断错分析一律丢弃', () => {
  const r = rec(); r.ai = null;
  const p = RV.parse(JSON.stringify({ verdict: 'derivable', correction: 'x', misreads: [{ claim: '此财可得', basedOn: '' }] }), r, RV.items(r, CHART, LR));
  assert.equal(p.misreads.length, 0);
});

test('并入与汇总：只加 review 一栏；按类别汇总断错与偏差', () => {
  const r = rec(), list = RV.items(r, CHART, LR);
  const p = RV.parse(JSON.stringify({ verdict: 'derivable', correction: 'x', misreads: [{ claim: '应期在未日。', basedOn: 'r7' }],
    misweighted: [{ itemId: 'g8', how: 'overrated', why: '' }], lesson: 'L' }), r, list);
  const r2 = RV.apply(r, p, { at: '2026-10-29T06:00:00Z', model: 'm', basedOnActual: '亏了三千' });
  assert.deepEqual(r2.feedback, r.feedback);
  assert.equal(r2.review.verdict, 'derivable');
  assert.ok(r2.review.ruleCheck.length > 0);
  const sm = RV.summarize([r2, rec()]);
  assert.equal(sm.n, 1);
  assert.deepEqual(sm.misreadBy[0], ['规则7 应期融合·穿壬', 1]);
  assert.deepEqual(sm.misweighted[0], ['奇门·宫中门星神干·高估', 1]);
  assert.equal(sm.lessons[0].lesson, 'L');
});
