const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const TL = require('../core/liuren/tuili.js');
const SC = require('../core/liuren/sanchuan.js');
const TDP = require('../core/liuren/tiandipan.js');

const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const BOOK = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledge/liuren-cases.json'), 'utf8'));
/** 照原书例起课：有月将与占时就用；书中缺的（活动时）以位差起，只能核三传的形 */
function fromCase(id, extra) {
  const c = BOOK.cases.find((x) => x.id === id);
  const p = c.yueJiang && c.shiZhi
    ? { riGan: c.riZhu[0], riZhi: c.riZhu[1], yueJiang: c.yueJiang, shiZhi: c.shiZhi, zhouYe: c.zhouYe || undefined }
    : { riGan: c.riZhu[0], riZhi: c.riZhu[1], yueJiang: ZHI[c.diff], shiZhi: '子' };
  const sc = SC.compute(p);
  if (c.chuanBook) assert.equal(sc.chuan.join(''), c.chuanBook, id + ' 三传须与书同');
  return TL.analyze(Object.assign({ sc, riZhu: c.riZhu, xunKong: TDP.xunKong(c.riZhu) }, extra || {}));
}
const all = (r) => r.steps.flatMap((s) => s.items).concat(r.heKan).map((x) => x.text).join('\n');

test('骨架照《探原》论断篇八门（书页 59–66），前置课体、后附德（书页 68）与应期参照；每句注《探原》或伍书书页，或标「本 app 取法」', () => {
  const r = fromCase('王-13');
  assert.deepEqual(r.steps.map((s) => s.title), ['大局·课体', '先锋门·占时', '直事门·月将', '外事门·日干（我）', '内事门·日枝（彼）', '发端门·初传', '移易门·中传', '归计门·末传', '变体门·年命', '德（福佑之神）', '应期（参照）']);
  for (const it of r.steps.flatMap((s) => s.items).concat(r.heKan)) {
    if (/^(干阴|枝阴)/.test(it.text)) continue;   // 紧接上一句的续行
    assert.ok(it.own || /^(探原|伍书) /.test(it.src), '无出处：' + it.text);
  }
  assert.equal(r.appliesTo, 'chuanren-exp');
  assert.match(r.source, /探原/);
  assert.match(r.caution.text, /乘神生干，则凶将亦吉/);
  // 伍剑虹书只作参照，句首注明
  for (const it of r.steps.flatMap((s) => s.items).concat(r.heKan).filter((x) => /^伍书/.test(x.src))) assert.match(it.text, /^伍剑虹参照——/);
});

test('课体用《探原》课名与课体纲要（书页 78）：王-13 退连茹；王-22、王-53、王-77 顺连茹；王-40 顺间断、王-94 逆间断', () => {
  const r = fromCase('王-13');
  assert.equal(r.moves.dir, '退');
  assert.match(all(r), /逆连茹：主牵连引退/);
  assert.match(all(r), /逆行：凡占多逆/);
  for (const id of ['王-22', '王-53', '王-77']) assert.match(all(fromCase(id)), /顺连茹/, id);
  assert.match(all(fromCase('王-40')), /顺间断：前进多阻/);
  assert.match(all(fromCase('王-94')), /逆间断：后退有妨/);
  assert.equal(fromCase('王-22').moves.sanHe, false, '亥子丑是三会，不是三合');
});

test('三合局名（书页 79）：伍-17 戌午寅火局；王-68 亥卯未木局；回环即「如珠走盘」（书页 62）', () => {
  assert.match(all(fromCase('伍-17')), /三传寅午戌，名「火局：主文明有象/);
  assert.match(all(fromCase('王-68')), /木局/);
  for (const id of ['王-21', '王-68']) assert.match(all(fromCase(id)), /如珠走盘/, id);
});

test('《探原》占卜一斑录：袁-8 癸酉日元首，用逢上克下；袁-1 伏吟自任「俯伏如常」；袁-7 太岁戌在传', () => {
  const r8 = fromCase('袁-8');
  assert.match(all(r8), /课名元首：上克下，臣忠子孝/);
  assert.match(all(r8), /用逢上克下：主卑幼之灾/);
  assert.match(all(fromCase('袁-1')), /课名自任（伏吟）：伏吟：俯伏如常，缓图新局/);
  const r7 = fromCase('袁-7', { taiSui: '戌', yueZhi: '子' });
  assert.match(all(r7), /太岁戌在传：主一年吉凶之事。太岁生我最吉/);   // 戌土生辛金；书断「末传戌，太岁值印绶」
  assert.match(all(r7), /三传寅午戌，名「火局/);
  assert.match(all(fromCase('袁-2')), /干枝上各见旺神：静乃获福，动必招尤/);   // 书断「干枝上皆值帝旺」
  assert.match(all(fromCase('袁-6')), /干生上神，虚耗百出/);                     // 书引「日生上神，虚耗百出」
});

test('旺相休囚以月建为纲（书页 67）；十干长生阳顺阴逆（书页 70）', () => {
  assert.equal(TL.wangXiang('子', '亥'), '旺');
  assert.equal(TL.wangXiang('寅', '子'), '相');
  assert.equal(TL.wangXiang('申', '子'), '休');
  assert.equal(TL.wangXiang('酉', '卯'), '囚');   // 春金囚：克我者
  assert.equal(TL.wangXiang('辰', '子'), '囚');
  assert.equal(TL.wangXiang('午', '子'), '死');   // 冬火死：我克者
  assert.equal(TL.wangXiang('戌', '辰'), '旺');
  assert.equal(TL.stage('甲', '亥'), '长生'); assert.equal(TL.stage('甲', '未'), '墓');
  assert.equal(TL.stage('乙', '午'), '长生'); assert.equal(TL.stage('乙', '戌'), '墓');
  assert.equal(TL.stage('丁', '丑'), '墓'); assert.equal(TL.stage('辛', '辰'), '墓'); assert.equal(TL.stage('壬', '辰'), '墓');
});

test('2026-10-30 午时丁丑日卯将（冬蛇掩目，子辰戌）：八门各项', () => {
  const sc = SC.compute({ riGan: '丁', riZhi: '丑', yueJiang: '卯', shiZhi: '午' });
  assert.equal(sc.chuan.join(''), '子辰戌');
  const r = TL.analyze({ sc, riZhu: '丁丑', yueZhi: '戌', taiSui: '午', xunKong: TDP.xunKong('丁丑'), nianMing: '庚午' });
  const t = all(r);
  assert.match(t, /课名冬蛇掩目.*惊危百出，耐守方佳/);
  assert.match(t, /时为日干三合、六合：主外事和合/);       // 午合丁寄宫未
  assert.match(t, /时为日枝六害：主内忧/);                 // 午丑害
  assert.match(t, /干生上神，虚耗百出/);                   // 丁火生辰土
  assert.match(t, /初传丙子乘螣蛇（官）.*临地盘卯（奇门3宫）/);
  assert.match(t, /用逢官（克我而阴阳异）/);
  assert.match(t, /初传子为日干绝之地。用绝：事了，人来、信至/);
  assert.match(t, /初传子水，戌月死：用逢死气/);
  assert.match(t, /神克将为内战/);
  assert.match(t, /末戌克初子，为终来克始/);
  assert.match(t, /本命上见月将：能解诸凶/);               // 午上卯，卯为月将
  assert.match(t, /中黄歌：发用子，看天盘丑所临地盘辰为应期/);
  assert.match(t, /初传子所合丑为成期，末传戌所冲辰为散期/);
  assert.match(t, /子→辰进四位，辰→戌对冲/);
  // 没给年支：变体不看
  assert.match(all(TL.analyze({ sc, riZhu: '丁丑', xunKong: [], nianMing: '庚' })), /未给年命地支/);
});

test('给 AI 的几行：与面板同一份；〔探原 N〕〔伍书 N〕〔本 app 取法〕逐句标明', () => {
  const sc = SC.compute({ riGan: '丁', riZhi: '丑', yueJiang: '卯', shiZhi: '午' });
  const r = TL.analyze({ sc, riZhu: '丁丑', yueZhi: '戌', xunKong: TDP.xunKong('丁丑'), nianMing: '庚午' });
  const lines = TL.toPromptLines(r), t = lines.join('\n');
  assert.match(lines[0], /只作旁证，不投票/);
  assert.equal(lines.length, 1 + r.steps.length + 2);
  assert.match(t, /发端门·初传：初传为发端门.*〔探原 61、63〕/);
  assert.match(t, /伍剑虹参照——.*〔伍书 10〕/);
  assert.match(t, /六壬一路只用规则 7 所列之支。〔本 app 取法〕/);
  assert.doesNotMatch(t, /【待核】/, '年命一项已照《探原》书页 66 补全');
});

test('行年（《探原》凡例：男一岁丙寅顺行，女一岁壬申逆行）：书中袁-4 三十四岁丙子命己亥行年、袁-8 五十一岁庚申命丙辰行年', () => {
  assert.equal(TL.xuSui('己酉', '丙子'), 34);
  assert.equal(TL.xingNian('男', 34), '己亥');
  assert.equal(TL.xuSui('庚戌', '庚申'), 51);
  assert.equal(TL.xingNian('男', 51), '丙辰');
  assert.equal(TL.xingNian('女', 1), '壬申');
  assert.equal(TL.xingNian('女', 2), '辛未');
  assert.equal(TL.xingNian('男', 61), '丙寅');
  assert.equal(TL.xuSui('庚戌', '庚申', true), 111);
  assert.equal(TL.xingNian('', 30), '');
  // 袁-4：行年亥上加白虎（书断「行年亥上加白虎」）
  const r = fromCase('袁-4', { nianMing: '丙子', xingNian: '己亥', yueZhi: '丑', taiSui: '酉' });
  const t = all(r);
  assert.match(t, /行年己亥，上神.*乘白虎/);
  assert.match(t, /本命丙子，上神.*乘天空/);   // 书断「本命子上加天空」
  assert.match(t, /年＝行年，命＝本命/);
});

test('占类专项（集说篇书页 84–87）：按占类只列相关几节', () => {
  const sc = SC.compute({ riGan: '丁', riZhi: '丑', yueJiang: '卯', shiZhi: '午' });   // 子辰戌
  const base = { sc, riZhu: '丁丑', yueZhi: '戌', xunKong: TDP.xunKong('丁丑') };
  const zx = (domain, extra) => { const r = TL.analyze(Object.assign({ domain }, base, extra || {})); const s = r.steps.find((x) => x.key === 'zhuanxiang'); return s ? s.items.map((x) => x.text).join('\n') : ''; };
  assert.equal(zx('wealth'), '', '求财不列专项');
  assert.match(zx('pregnancy'), /论男女：三传子辰戌，纯阳主男/);
  const lost = zx('lost_item');
  assert.match(lost, /论新旧：发用子为仲神/);
  assert.match(lost, /论方所：发用子为江湖；论住居为房/);
  assert.match(lost, /论远近：/);
  assert.match(zx('lawsuit'), /论胜负：干枝相生，书未论胜负|论胜负：/);
  assert.match(zx('find_person', { xingNian: '己亥' }), /论存亡：问人不知存亡，专视白虎/);
  assert.match(zx('find_person', { xingNian: '己亥' }), /行年亥临/);
  assert.match(zx('relationship'), /论亲疏：/);
  // 迟速（书页 87）各占类都列在应期参照里
  const r = TL.analyze(Object.assign({ domain: 'wealth' }, base));
  assert.match(r.steps.find((x) => x.key === 'yingqi').items.map((x) => x.text).join(''), /迟速：.*主事(速|迟)/);
});

// 德（《探原》书页 68）：表照原文逐字录；袁-8 为原书例
test('德：四德表照书页 68；袁-8 月德亥临申命', () => {
  const TL = require('../core/liuren/tuili.js');
  // 天德：正月丁未、二月坤申、三月壬亥、四月辛戌、五月乾亥、六月甲寅、七月癸丑、八月艮寅、九月丙巳、十月乙辰、十一月巽巳、十二月庚申
  const yue = '寅卯辰巳午未申酉戌亥子丑';
  assert.equal([...yue].map((m) => TL.deShen('甲', '子', m).tian).join(''), '未申亥戌亥寅丑寅巳辰巳申');
  // 月德：正五九丙巳，二六十甲寅，三七十一壬亥，四八十二庚申
  assert.equal([...yue].map((m) => TL.deShen('甲', '子', m).yue).join(''), '巳寅亥申巳寅亥申巳寅亥申');
  // 日德：甲己寅，乙庚申，丙辛戌，戊癸巳，丁壬亥
  assert.equal([...'甲乙丙丁戊己庚辛壬癸'].map((g) => TL.deShen(g, '子', '寅').ri).join(''), '寅申戌亥巳寅申戌亥巳');
  // 枝德：子巳、丑午、寅未、卯申、辰酉、巳戌、午亥、未子、申丑、酉寅、戌卯、亥辰
  assert.equal([...'子丑寅卯辰巳午未申酉戌亥'].map((z) => TL.deShen('甲', z, '寅').zhi).join(''), '巳午未申酉戌亥子丑寅卯辰');
  // 袁-8：庚戌年十二月初三（1911-01-03，小寒前，月建子）癸酉日丑将戌时，书云「月德临于申命」：子月月德亥，申上正是亥
  const SC = require('../core/liuren/sanchuan.js');
  const sc = SC.compute({ riGan: '癸', riZhi: '酉', yueJiang: '丑', shiZhi: '戌' });
  assert.equal(TL.deShen('癸', '酉', '子').yue, '亥');
  assert.equal(sc.liuren.tianOver('申'), '亥');
  const r = TL.analyze({ sc, riZhu: '癸酉', yueZhi: '子', taiSui: '戌', xunKong: ['戌', '亥'], nianMing: '庚申', xingNian: '丙辰', domain: '' });
  const de = r.steps.find((s) => s.key === 'de');
  assert.ok(de && /日德巳、枝德寅、月德亥、天德巳/.test(de.items[0].text) && de.items[0].src === '探原 68');
  // 丙辛日照书取戌，并标待核
  const sc2 = SC.compute({ riGan: '丙', riZhi: '寅', yueJiang: '丑', shiZhi: '子' });
  const r2 = TL.analyze({ sc: sc2, riZhu: '丙寅', yueZhi: '子', taiSui: '酉', xunKong: ['戌', '亥'], nianMing: '', xingNian: '', domain: '' });
  const de2 = r2.steps.find((s) => s.key === 'de');
  assert.ok(/日德戌/.test(de2.items[0].text) && de2.items.some((it) => it.own && /待核/.test(it.text)));
});
