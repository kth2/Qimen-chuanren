const test = require('node:test');
const assert = require('node:assert/strict');
const CB = require('../core/casebook.js');

function rec(i, { want = 'hope', hap = 'yes', ai = 'wish', votes = {}, note } = {}) {
  return { id: 'c' + i, question: '问' + i, feedback: { archived: true, type: 'yesno', want, happened: hap, aiVerdict: ai, note: note || '况' + i },
    votes: [1, 2, 3, 4, 5, 6].map((k) => ({ rule: k, applicable: votes[k] != null, vote: votes[k] || 0 })), wuxing: null };
}

test('如愿：盼的发生、怕的没发生', () => {
  assert.equal(CB.outcome(rec(1, { want: 'hope', hap: 'yes' })), true);
  assert.equal(CB.outcome(rec(1, { want: 'fear', hap: 'yes' })), false);
  assert.equal(CB.outcome(rec(1, { want: 'fear', hap: 'no' })), true);
  assert.equal(CB.outcome(rec(1, { hap: '?' })), null);
  assert.equal(CB.outcome(rec(1, { hap: 'partial' })), null);
});

test('平衡准确率、同题去重、弃权不计', () => {
  const rs = [rec(1, { votes: { 1: 1 } }), rec(2, { votes: { 1: 1 } }), rec(3, { hap: 'no', votes: { 1: -1 } }), rec(4, { hap: 'no', votes: { 1: 1 } }),
    rec(5, { votes: {} }), Object.assign(rec(6, { votes: { 1: 1 } }), { question: '问1', feedback: Object.assign(rec(1).feedback) })];
  const s = CB.stats(rs);
  assert.equal(s.yesno, 5);                       // 例6 与例1 同题同实况，去重
  assert.equal(s.rules[1].n, 4);                  // 例5 弃权
  assert.equal(s.rules[1].balanced, (1 + 0.5) / 2);
  assert.equal(s.rules[1].verdict, null);         // 未到评估点不下结论
});

test('到第一次评估点才给判定', () => {
  const rs = [];
  for (let i = 0; i < 40; i++) {
    const wish = i % 2 === 0;
    rs.push(rec(i, { hap: wish ? 'yes' : 'no', ai: i % 4 === 0 ? 'unwish' : (wish ? 'wish' : 'unwish'), votes: { 3: wish ? 1 : -1, 6: 1 } }));
  }
  const s = CB.stats(rs);
  assert.equal(s.stage.reached.n, 40);
  assert.equal(s.rules[3].balanced, 1);
  assert.equal(s.rules[3].verdict, '通过');       // 100% ≥ AI 75% + 5
  assert.equal(s.rules[6].verdict, '停止');       // 恒 +1：50% < AI
});

test('v2：规则 8 对「实况发生」计分而非如愿；规则账本按版本主号分开；规则 7 计应期命中', () => {
  const mk = (i, o) => {
    const r = rec(i, o);
    r.rulesVersion = o.ver || '2.0.0';
    r.votes.push({ rule: 7, applicable: true, vote: 0, picks: ['子', '午'] }, { rule: 8, applicable: o.v8 != null, vote: o.v8 || 0 });
    if (o.day) r.feedback.actualDayZhi = o.day;
    return r;
  };
  const rs = [
    mk(1, { want: 'fear', hap: 'yes', v8: 1, day: '午' }),   // 怕的事发生：不如愿，但规则 8 判发生——判对
    mk(2, { want: 'hope', hap: 'no', v8: -1, day: '丑' }),   // 规则 8 判不发生——判对
    mk(3, { want: 'hope', hap: 'yes', v8: 1, ver: '1.0.0-dev' }), // v1 记录：不计入规则账本
  ];
  const s = CB.stats(rs, { rulesVersion: '2.0.0' });
  assert.equal(s.rules[8].n, 2);
  assert.equal(s.rules[8].acc, 1);
  assert.equal(s.rule7.n, 2);
  assert.equal(s.rule7.hit, 1);
  assert.equal(s.rule7.expect, +(2 * 2 / 12).toFixed(2));
  assert.equal(CB.stats(rs).rules[8].n, 3);   // 不给版本则全计
  assert.equal(CB.happened(rs[0]), true);
});
