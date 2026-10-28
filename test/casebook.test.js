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
