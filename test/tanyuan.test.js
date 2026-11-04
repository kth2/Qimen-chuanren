// 《大六壬探原》（六壬基准）原书例与 720 课表。金标：test/fixtures/tanyuan-720.json
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../core/liuren/sanchuan.js');
const T = require('./fixtures/tanyuan-720.json');

const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const run = (rz, yj, sz, opts) => S.compute({ riGan: rz[0], riZhi: rz[1], yueJiang: yj, shiZhi: sz }, opts);
/** 照表起课：干上神 g ⇒ 月将取（g − 日干寄宫）之位差，占时子 */
const byGanShang = (rz, g) => run(rz, ZHI[((ZHI.indexOf(g) - ZHI.indexOf(S.JI_GONG[rz[0]])) % 12 + 12) % 12], '子');

test('《探原》书页 32–46「六十花甲日三传」720 课逐课一致', () => {
  const bad = [];
  let n = 0;
  for (const day in T.days) {
    const row = T.days[day].split(' ');
    assert.equal(row.length, 12, day);
    row.forEach((book, i) => { n++; const got = byGanShang(day, ZHI[i]).chuan.join(''); if (got !== book) bad.push(`${day} 干上${ZHI[i]} 书${book} 得${got}`); });
  }
  assert.equal(n, 720);
  assert.deepEqual(bad, []);
});

test('涉害（书页 9–11）：下贼上数克上神者，上克下数上神所克者', () => {
  // 正月甲辰日亥将卯时：戌加甲四重，子加辰五重，取子
  const r = run('甲辰', '亥', '卯');
  assert.equal(r.chuan.join(''), '子申辰');
  assert.match(r.why, /戌4重、子5重/);
  // 甲午日干上子：「戌加子仅二重克，寅加辰有六重克，故取寅为初传」
  const r2 = byGanShang('甲午', '子');
  assert.equal(r2.chuan.join(''), '寅子戌');
  assert.match(r2.why, /戌2重、寅6重/);
  const k = r2.ke.find((x) => x.shang === '寅');
  assert.equal(S.sheHaiDepth(k, 'shang'), 6);
  // 改正涉害数例：庚午日干上午寅子戌、己丑日干上卯卯亥未、壬戌日干上辰辰酉寅、癸未日干上酉卯亥未
  for (const [rz, g, exp] of [['庚午', '午', '寅子戌'], ['己丑', '卯', '卯亥未'], ['壬戌', '辰', '辰酉寅'], ['癸未', '酉', '卯亥未']]) {
    assert.equal(byGanShang(rz, g).chuan.join(''), exp, rz + g);
  }
});

test('伏吟（书页 26–27）：癸丑日子将子时丑戌未（不虞）；丁己辛三卯日卯子午', () => {
  assert.equal(run('癸丑', '子', '子').chuan.join(''), '丑戌未');
  for (const rz of ['丁卯', '己卯', '辛卯']) {
    const r = byGanShang(rz, S.JI_GONG[rz[0]]);
    assert.equal(r.chuan.join(''), '卯子午', rz);
    assert.match(r.why, /书页 27 注/);
  }
  assert.equal(byGanShang('乙酉', '辰').chuan.join(''), '辰酉卯');   // 乙日初辰自刑，中取枝上，中又自刑取冲
});

test('昴星（书页 18）戊寅日子将申时丑午酉；八专（书页 22）甲寅日子将卯时丑亥亥、不取遥克', () => {
  const r = run('戊寅', '子', '申');
  assert.equal(r.chuan.join(''), '丑午酉');
  assert.match(r.name, /虎视/);
  const b = run('甲寅', '子', '卯');
  assert.equal(b.chuan.join(''), '丑亥亥');
  assert.equal(b.name, '八专');
  assert.deepEqual(b.flags, []);
});
