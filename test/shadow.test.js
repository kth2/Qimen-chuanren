// 六壬判法影子追踪 v1：判法照 docs/SHADOW-liuren-v1.md；原书例作 golden
const test = require('node:test');
const assert = require('node:assert/strict');
const SH = require('../core/liuren/shadow.js');
const CB = require('../core/casebook.js');

test('S1：袁-8 癸酉日丑将戌时，干上辰克癸 → 不如愿（书中其人败诉）', () => {
  const v = SH.votes({ riZhu: '癸酉', yueJiang: '丑', shiZhi: '戌', xunKong: ['戌', '亥'] });
  assert.equal(v.S1.shang, '辰');
  assert.equal(v.S1.rel, '干上神克干');
  assert.equal(v.S1.vote, -1);
});

test('S1：干上神生干 → 如愿；比和、干生上神、干克上神不投票', () => {
  // 甲日寄寅，亥将寅时：寅上亥，水生木
  const a = SH.votes({ riZhu: '甲子', yueJiang: '亥', shiZhi: '寅', xunKong: ['戌', '亥'] });
  assert.deepEqual([a.S1.shang, a.S1.rel, a.S1.vote], ['亥', '干上神生干', 1]);
  // 袁-6 丁酉日寅将寅时：书云「日生上神，虚耗百出」，干上未
  const b = SH.votes({ riZhu: '丁酉', yueJiang: '寅', shiZhi: '寅', xunKong: ['辰', '巳'] });
  assert.deepEqual([b.S1.shang, b.S1.rel, b.S1.vote], ['未', '干生上神', 0]);
  // 袁-7 辛酉日寅将戌时：辛寄戌，戌上寅，金克木
  const c = SH.votes({ riZhu: '辛酉', yueJiang: '寅', shiZhi: '戌', xunKong: ['子', '丑'] });
  assert.deepEqual([c.S1.shang, c.S1.rel, c.S1.vote], ['寅', '干克上神', 0]);
  // 袁-2 丙寅日丑将子时：书云「干上午」，比和
  const d = SH.votes({ riZhu: '丙寅', yueJiang: '丑', shiZhi: '子', xunKong: ['戌', '亥'] });
  assert.deepEqual([d.S1.shang, d.S1.rel, d.S1.vote], ['午', '比和', 0]);
});

test('S2：初传落旬空才触发；末传空不算（袁-4 末传午旬空）', () => {
  // 丁丑日卯将午时：三传子辰戌
  assert.equal(SH.votes({ riZhu: '丁丑', yueJiang: '卯', shiZhi: '午', xunKong: ['子', '丑'] }).S2.fired, true);
  assert.equal(SH.votes({ riZhu: '丁丑', yueJiang: '卯', shiZhi: '午', xunKong: ['申', '酉'] }).S2.fired, false);
  const y4 = SH.votes({ riZhu: '庚寅', yueJiang: '子', shiZhi: '亥', xunKong: ['午', '未'] });
  assert.deepEqual([y4.S2.c1, y4.S2.fired], ['辰', false]);
});

// 造案例：S1 克干（癸酉丑将戌时），实况给定
const rec = (id, at, o) => ({ id, createdAt: at, question: 'q' + id,
  chart: { siZhu: { day: o.day || '癸酉', time: '壬' + (o.shi || '戌') } },
  liuren: { yueJiang: o.yj || '丑', xunKong: o.kong || ['戌', '亥'] },
  feedback: { archived: true, note: 'n' + id, verdict: 'happened',
    labels: { type: 'yesno', want: o.want || 'hope', happened: o.happened || 'no' } } });

test('检验集按录入时间分：冻结日以前的只进回看，不计入评估', () => {
  const recs = [
    rec(1, '2026-11-05T01:00:00.000Z', {}),               // 回看
    rec(2, '2026-11-10T00:00:00.000Z', {}),               // 检验集（含当日）
    rec(3, '2026-11-12T08:00:00.000Z', { happened: 'yes' }),
  ];
  const s = SH.stats(recs, CB);
  assert.equal(s.S1.lookback.n, 1);
  assert.equal(s.S1.test.n, 2);
  assert.equal(s.S1.verdict, null);          // 未到评估点不下结论
  assert.equal(s.S1.next.n, 40);
  assert.equal(s.S2.test.fired + s.S2.test.rest, 2);
});

test('S1 到第一次评估点才给判定；S2 单向，比两组发生率', () => {
  const recs = [];
  // S1 克干 → 预测不如愿。30 题不如愿（对）、10 题如愿（错）→ 平衡准确率 50%，无 AI 基准时不判
  for (let i = 0; i < 30; i++) recs.push(rec('a' + i, '2026-11-11T00:00:00.000Z', { happened: 'no' }));
  for (let i = 0; i < 10; i++) recs.push(rec('b' + i, '2026-11-11T00:00:00.000Z', { happened: 'yes' }));
  const s = SH.stats(recs, CB);
  assert.equal(s.S1.test.n, 40);
  assert.equal(s.S1.reached.label, '第一次评估');
  assert.equal(s.S1.test.balanced, 0.5);
  assert.equal(s.S1.verdict, null);          // 这批题没有 AI 结论作基准，不判
  // S2：这些盘初传不空（癸酉丑将戌时，旬空戌亥，初传辰）→ 全在未触发组
  assert.equal(s.S2.test.fired, 0);
  assert.equal(s.S2.test.rest, 40);
  assert.equal(s.S2.verdict, null);
  // 另造触发组：丁丑卯将午时旬空子丑，初传子空。10 题里 2 题发生；未触发 40 题里 10 题发生（25%）→ 差 5 点，继续
  for (let i = 0; i < 10; i++) recs.push(rec('c' + i, '2026-11-11T00:00:00.000Z', { day: '丁丑', yj: '卯', shi: '午', kong: ['子', '丑'], happened: i < 2 ? 'yes' : 'no' }));
  const t = SH.stats(recs, CB);
  assert.equal(t.S2.test.fired, 10);
  assert.equal(t.S2.reached.label, '第一次评估');
  assert.ok(Math.abs(t.S2.test.diff - 0.05) < 1e-9);
  assert.equal(t.S2.verdict, '继续');
});

test('规格登记：两条都注《探原》书页，冻结日与分界一致', () => {
  assert.deepEqual(SH.ITEMS.map((x) => [x.id, x.src]), [['S1', '探原 61'], ['S2', '探原 63'], ['S3', '探原 66、75']]);
  assert.equal(SH.SPEC.cutoff.slice(0, 10), SH.SPEC.frozenAt);
});

test('S3：类神九处——闲地、空亡、休囚、刑克记不如愿；现而旺相不空且生合记如愿；占类不在表内不投票', () => {
  const SC = require('../core/liuren/sanchuan.js');
  const base = { riZhu: '癸酉', yueJiang: '丑', shiZhi: '戌', xunKong: ['戌', '亥'], yueZhi: '子' };
  // 不在表内的占类、缺月支：不投票
  assert.equal(SH.votes(Object.assign({}, base, { ui: '失物' })).S3.vote, 0);
  assert.equal(SH.votes(Object.assign({}, base, { ui: '财运', yueZhi: '' })).S3.vote, 0);
  // 逐项对照定义：把每个类神的状态按规格重算一遍
  const sc = SC.compute({ riGan: '癸', riZhi: '酉', yueJiang: '丑', shiZhi: '戌' });
  const v = SH.votes(Object.assign({}, base, { ui: '财运' })).S3;
  const long = [...'子丑寅卯辰巳午未申酉戌亥'].find((z) => sc.liuren.jiangOf(z) === '青龙');
  assert.deepEqual(v.lei.map((x) => [x.name, x.zhi]), [['青龙', long]]);
  const nine = [...sc.ke.map((k) => k.shang), ...sc.chuan];
  if (!nine.includes(long)) { assert.equal(v.lei[0].state, '闲地'); assert.equal(v.vote, -1); }
  // 婚姻分男女：男占取天后与财星，女占取六合与官杀，未给性别只取六合
  const names = (xb) => SH.votes(Object.assign({}, base, { ui: '婚姻', xingBie: xb })).S3.lei.map((x) => x.name);
  assert.ok(names('男').includes('天后') && names('男').includes('财星'));
  assert.ok(names('女').includes('六合') && names('女').includes('官杀'));
  assert.deepEqual(names(''), ['六合']);
  // 全表扫一遍，四种结论都要出现过，且状态与票一致
  const seen = new Set();
  const GZ = ['甲子', '丙寅', '戊辰', '庚午', '壬申', '乙亥', '丁丑', '己卯', '辛巳', '癸未'];
  for (const rz of GZ) for (const yj of '子卯午酉') for (const sz of '丑辰未戌') for (const ui of ['财运', '事业', '学业']) {
    const r = SH.votes({ riZhu: rz, yueJiang: yj, shiZhi: sz, xunKong: [], yueZhi: '寅', ui }).S3;
    r.lei.forEach((x) => seen.add(x.state));
    if (r.lei.some((x) => x.state === '现而德合相生')) assert.equal(r.vote, 1);
    else if (r.lei.every((x) => ['闲地', '空亡', '休囚', '刑克日辰'].includes(x.state))) assert.equal(r.vote, -1);
    else assert.equal(r.vote, 0);
  }
  for (const st of ['闲地', '休囚', '刑克日辰', '现而德合相生']) assert.ok(seen.has(st), '未出现：' + st);
});
