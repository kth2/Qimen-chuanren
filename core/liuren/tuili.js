/**
 * 奇门穿壬 · 六壬推理（只显示、不投票、不进规则账本）。纯函数，无副作用。appliesTo: chuanren-exp
 *
 * 依据（2026-11-05 起）：袁树珊《大六壬探原》卷下论断篇（书页 59–76）、集说篇课体纲要（书页 78–82）、
 * 中黄歌（书页 88）——六壬基准。伍剑虹《大六壬精义讲解》作参照，凡出自伍书的句子单独标出。
 * 骨架即两书共用的八门：先锋门（占时）、直事门（月将）、外事门（日干）、内事门（日枝）、
 * 发端门（初传）、移易门（中传）、归计门（末传）、变体门（年命）（《探原》书页 59–66；伍书页 13–14）。
 *
 * 每句带出处：src＝「探原 N」（《探原》书页，即页脚页码）或「伍书 N」（伍剑虹书页）；
 *   own:true ＝ 书中没有逐字规定、本 app 自定的取法，界面上要标出来。
 * 《探原》书页 82：「十二天将，虽着吉凶，若乘神生干，则凶将亦吉；乘神克干，则吉将亦凶」，
 * 伍书页 96–97 亦言吉神凶神「更次」。故本模块不给总吉凶，只把书上说的一条条摆出来。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./xiangyi.js'), require('./tiandipan.js'));
  else root.LiurenTuiLi = factory(root.LiurenXiangYi, root.LiurenTianDiPan);
})(typeof self !== 'undefined' ? self : this, function (XY, TDP) {
  'use strict';

  const APPLIES_TO = 'chuanren-exp';
  const SOURCE = '袁树珊《大六壬探原》卷下论断篇（伍剑虹《大六壬精义讲解》作参照）';
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const zi = (z) => ZHI.indexOf(z);
  const at = (i) => ZHI[((i % 12) + 12) % 12];
  const GAN = '甲乙丙丁戊己庚辛壬癸';
  const GAN_WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
  const ZHI_WX = { 子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土' };
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const MENG = '寅申巳亥', ZHONG = '子午卯酉';
  const SAN_HE = ['申子辰', '亥卯未', '寅午戌', '巳酉丑'];
  const JI_GONG = { 甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳', 己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑' };
  // 《探原》书页 68–71：合、破、害、刑、冲
  const LIU_HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
  const PO = { 午: '卯', 卯: '午', 辰: '丑', 丑: '辰', 酉: '子', 子: '酉', 戌: '未', 未: '戌', 亥: '寅', 寅: '亥', 申: '巳', 巳: '申' };
  const HAI = { 酉: '戌', 戌: '酉', 申: '亥', 亥: '申', 未: '子', 子: '未', 午: '丑', 丑: '午', 巳: '寅', 寅: '巳', 辰: '卯', 卯: '辰' };
  const XING = { 子: '卯', 卯: '子', 寅: '巳', 巳: '申', 申: '寅', 丑: '戌', 戌: '未', 未: '丑', 辰: '辰', 午: '午', 酉: '酉', 亥: '亥' };
  const chong = (z) => at(zi(z) + 6);
  const sanHeOf = (z) => SAN_HE.find((g) => g.includes(z));
  // 驿马：冲三合之首（书页 71）；天马：正七月午、二八月申……（书页 66 注）
  const YIMA = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };
  const tianMa = (yueZhi) => '午申戌子寅辰'[((zi(yueZhi) - 2 + 12) % 12) % 6];
  // 十干长生（书页 70）：阳干顺行、阴干逆行
  const CHANG_SHENG = { 甲: '亥', 乙: '午', 丙: '寅', 戊: '寅', 丁: '酉', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };
  const STAGES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  const stage = (gan, z) => STAGES[(((GAN.indexOf(gan) % 2 === 0 ? 1 : -1) * (zi(z) - zi(CHANG_SHENG[gan]))) % 12 + 12) % 12];
  // 十二天将五行（书页 65 注）
  const JIANG_WX = { 贵人: '土', 螣蛇: '火', 朱雀: '火', 六合: '木', 勾陈: '土', 青龙: '木', 天空: '土', 白虎: '金', 太常: '土', 玄武: '水', 太阴: '金', 天后: '水' };
  const XIONG_JIANG = ['白虎', '螣蛇', '玄武', '勾陈'];   // 书页 65：「虎、蛇为至凶之神，玄、勾次之」
  const T = (text, p) => ({ text, src: p ? '探原 ' + p : '', own: false });
  const W = (text, p) => ({ text, src: '伍书 ' + p, own: false });
  const OWN = (text) => ({ text, src: '', own: true });
  const L = T;

  /** 课体：《探原》课体纲要（书页 78）；伍书页 7–12 作参照 */
  const TANYUAN_KETI = {
    元首: '上克下，臣忠子孝（乾坤）。', 始入: '下贼上，子逆臣乖（乾坤）。', 重审: '下贼上，子逆臣乖（乾坤）。',
    比用: '事有两歧，择善而从；人有亲疏，就近弃远（知一）。', 知一: '事有两歧，择善而从；人有亲疏，就近弃远（知一）。',
    涉害: '取所涉深者，事多艰难，风霜尽历。', 改正涉害: '取所涉深者，事多艰难，风霜尽历。',
    见机: '取四孟者，事属犹疑，见机急改。', 察微: '取四仲者，事防谋害，知着察微。', 缀瑕: '取干上神者，事应交争，久延乃得。',
    嚆矢: '神遥克日者，先惊恐而后安然。', 弹射: '日遥克神者，远图难而近取易。',
    虎视: '昴星：惊危百出，耐守方佳。', 冬蛇掩目: '昴星：惊危百出，耐守方佳。',
    别责: '残缺不全，另谋始妥。', 八专: '二人同心，其利断金；阳主进速，阴主退迟。',
    无依: '返吟：冲动不安，惟利旧事。', 无亲: '返吟：冲动不安，惟利旧事。',
    自任: '伏吟：俯伏如常，缓图新局。', 自信: '伏吟：俯伏如常，缓图新局。', 杜传: '伏吟：俯伏如常，缓图新局。', 不虞: '伏吟：俯伏如常，缓图新局。',
  };
  const KETI = {
    重审: { p: 7, text: '下克上，以下犯上，重重审核、处处为难；但下克上是我克人，先迷而后利，最后得利的还是自己。' },
    元首: { p: 7, text: '上克下，上支配下，循序而行，天下顺而百事宜；对个人则受某种制约，压制过甚难免有后顾之忧。' },
    '知一（比用）': { p: 8, text: '几处相克并见、矛盾复杂，取与日干同性的一克为主要矛盾——矛盾最激烈、最容易发生变革之处。' },
    涉害: { p: 9, text: '自己涉及别人，或别人有害涉及自己。' },
    '遥克（蒿矢）': { p: 10, text: '神遥克日，箭从远方来伤我，遥远而力绵；一般危害不大（三传见巳酉金局则危害非浅）。' },
    '遥克（弹射）': { p: 10, text: '日遥克神，我去伤他人而太远无力，如弹丸；一般危害不大（三传见巳酉金局则危害非浅）。' },
    '昴星（虎视）': { p: 10, text: '有人虎视眈眈，你已被监视注视，有潜在危险；「机」未现、事将萌。' },
    '昴星（冬蛇掩目）': { p: 10, text: '有人虎视眈眈，你已被监视注视，有潜在危险；「机」未现、事将萌。' },
    别责: { p: 10, text: '遭受责难，受家人或上司责难，非常被动；四课不全，气不全，事情办不成或办不好。' },
    八专: { p: 11, text: '干支同位，主次不分、彼我不明；有「专政」之意，受责难后被管制或遭刑罚。' },
    伏吟: { p: 12, text: '天地盘重合，如天地静止：难受呻吟、不动、为困、被拘捕。' },
    返吟: { p: 12, text: '动荡不定、反复不宁：静的被冲动、禁锢解除，或动的被冲散——好事办不成，坏事不成凶；初传有马则事来得快。' },
  };
  const QISHU = { 重审: '强', 元首: '强', '知一（比用）': '强', 涉害: '强', 别责: '弱', 八专: '弱', 伏吟: '弱', 返吟: '弱',
    '遥克（蒿矢）': '居中', '遥克（弹射）': '居中', '昴星（虎视）': '居中', '昴星（冬蛇掩目）': '居中' };

  /** 旺相休囚死（《探原》书页 67：当令者旺、我生者相、我克者死、克我者囚、生我者休；以月建为纲） */
  function wangXiang(zhi, yueZhi) {
    const ling = ZHI_WX[yueZhi], it = ZHI_WX[zhi];
    if (!ling || !it) return '';
    if (it === ling) return '旺';
    if (SHENG[ling] === it) return '相';
    if (SHENG[it] === ling) return '休';
    if (KE[it] === ling) return '囚';
    return '死';
  }

  /** 一个支的读法：天将、六亲、象义、遁干、旬空、所临地盘与奇门宫 */
  function readZhi(ln, z, riGan, dun, kong) {
    const j = ln.jiangOf(z), x = XY.read(j, z, riGan), di = ln.diUnder(z);
    return { zhi: z, jiang: j, ji: TDP.JI_JIANG.has(j), liuQin: x.liuQin, text: x.text, fromBase: x.fromBase,
      dun: dun[z] || '', kong: kong.has(z), di, gong: TDP.ZHI_GONG[di] };
  }
  const zhiLine = (r) => `${r.dun || ''}${r.zhi}乘${r.jiang}（${r.liuQin}）：${r.text}${r.fromBase ? '〔书未载此组合，取本义〕' : ''}${r.kong ? '；落旬空' : ''}`;

  /** 三传走向（伍书页 77 第 53 问、页 130 第 117 条；《探原》书页 79 连茹、间断） */
  function moves(chuan) {
    const steps = [];
    for (let i = 1; i < 3; i++) {
      const d = ((zi(chuan[i]) - zi(chuan[i - 1])) % 12 + 12) % 12;
      if (d) steps.push(d);
    }
    const fwd = steps.filter((d) => d >= 1 && d <= 5), back = steps.filter((d) => d >= 7);
    const dir = steps.length && fwd.length === steps.length ? '进' : steps.length && back.length === steps.length ? '退' : '';
    const gaps = steps.map((d) => (d <= 6 ? d : 12 - d));
    const sanHe = SAN_HE.some((g) => new Set(chuan).size === 3 && chuan.every((z) => g.includes(z)));
    const chong = steps.includes(6);
    const lian = gaps.length === 2 && gaps.every((g) => g === 1);
    const jian = gaps.length === 2 && gaps.every((g) => g === 2);
    return { steps, gaps, dir, sanHe, chong, lian, jian };
  }

  // 六十甲子；行年（《探原》凡例：男一岁起丙寅顺行，女一岁起壬申逆行）
  const GZ60 = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12]);
  /** 虚岁：起课年柱减本命年柱（六十甲子位差）加一；over60 再加六十 */
  function xuSui(yearGz, mingGz, over60) {
    const y = GZ60.indexOf(yearGz), m = GZ60.indexOf(mingGz);
    if (y < 0 || m < 0) return 0;
    return ((y - m) % 60 + 60) % 60 + 1 + (over60 ? 60 : 0);
  }
  function xingNian(gender, age) {
    if (!(age >= 1) || (gender !== '男' && gender !== '女')) return '';
    return gender === '男' ? GZ60[(2 + age - 1) % 60] : GZ60[(((8 - (age - 1)) % 60) + 60) % 60];
  }
  // 论方所（书页 87）
  const FANG_SUO = { 子: '江湖', 丑: '山田、坟墓', 寅: '山林', 卯: '山林', 辰: '冈岭、墙垣，又为衙署', 巳: '窑灶', 午: '市，又为道路', 未: '平田，又为井', 申: '园场，又为道路', 酉: '城', 戌: '营', 亥: '水边楼台' };
  const ZHU_JU = { 子: '房', 丑: '墙', 寅: '道路', 卯: '大门', 辰: '米栈', 巳: '厨灶', 午: '厅堂', 未: '园井', 申: '庭心、天井', 酉: '后门', 戌: '浴堂', 亥: '坑厕、水沟' };
  // 占类 → 集说篇专项（书页 84–87）
  const ZHUAN_XIANG = {
    traveler: ['存亡', '老少', '远近'], find_person: ['存亡', '男女', '老少', '远近', '方所'], health: ['存亡'],
    pregnancy: ['男女'], lost_item: ['新旧', '高低', '远近', '方所'], shefu: ['新旧', '高低', '方所'], fengshui: ['方所'],
    lawsuit: ['胜负'], contest: ['胜负'], relationship: ['亲疏'],
  };
  const YANG_JIANG = ['贵人', '螣蛇', '朱雀', '勾陈', '青龙', '白虎'];   // 书页 84：贵、蛇、雀、勾、龙、虎为阳将

  // 五行关系（以日干五行论）
  const sheng = (a, b) => SHENG[a] === b, keWx = (a, b) => KE[a] === b;

  /**
   * @param a.sc       SanChuan.compute 的结果（含 ke、chuan、name、keTi、why、liuren 天地盘）
   * @param a.riZhu    日柱（如「丁丑」）
   * @param a.yueZhi   月建地支（月柱之支），用来定旺相休囚、天马、应期；不给就不看
   * @param a.taiSui   太岁（年柱之支）；不给就不看
   * @param a.xunKong  六壬日旬空 [支, 支]
   * @param a.nianMing 年命（本命）干支（只有天干或空 → 本命不看）
   * @param a.xingNian 行年干支（由性别与虚岁推得；不给就不看）
   * @param a.domain   占类键（Qimen-pwa domains.json，如 lost_item）；定「占类专项」看哪几节
   */
  function analyze(a) {
    const sc = a.sc, ln = sc.liuren, riGan = a.riZhu[0], riZhi = a.riZhu[1];
    const kong = new Set(a.xunKong || []), dun = TDP.dunGan(a.riZhu);
    const R = (z) => readZhi(ln, z, riGan, dun, kong);
    const ke = sc.ke, [c1, c2, c3] = sc.chuan.map(R);
    const me = GAN_WX[riGan], ganPos = JI_GONG[riGan];
    const steps = [];
    const keTi = sc.keTi || sc.name;
    const wxRel = (z) => { const it = ZHI_WX[z]; return it === me ? '比' : sheng(it, me) ? '生' : sheng(me, it) ? '泄' : keWx(it, me) ? '克' : '财'; };

    // 大局·课体
    {
      const items = [];
      const tn = keTi.split('、').map((n) => TANYUAN_KETI[n]).filter(Boolean);
      const cat = sc.name.replace(/（.*）/, '');
      items.push(T(`课名${keTi}${keTi === cat || keTi === sc.name ? '' : '（' + cat + '）'}：${[...new Set(tn)].join('')}`, keTi.includes('涉害') || /见机|察微|缀瑕/.test(keTi) ? '78；课名见 31–46' : '78；课名见 30–46'));
      if (/元首|始入|重审|比用|知一|涉害|见机|察微|缀瑕/.test(keTi)) {
        const shangKe = /元首|知一/.test(keTi) || (/涉害|见机|察微|缀瑕/.test(keTi) && /上克下/.test(sc.why || ''));
        items.push(T(shangKe ? '用逢上克下：主卑幼之灾，事从外来，利男子，利先起。' : '用逢下贼上：主尊长之灾，事由内起，利女子，利后应。', 63));
      }
      if (keTi.includes('独足')) items.push(T('三传皆归一神，是名独足，凡占不利。', 22));
      const k = KETI[sc.name];
      if (k) items.push(W(`伍剑虹参照——${sc.name}：${k.text}`, k.p));
      if (QISHU[sc.name]) items.push(W(`伍剑虹参照——气数${QISHU[sc.name]}（四课全如贼克、比用、涉害气数强；别责、八专、返吟、伏吟弱；遥克、昴星居中）。`, 122));
      const distinct = new Set(ke.map((k2) => k2.shang + '/' + k2.xiaPos)).size;
      items.push(T(distinct === 4 ? '四课全，事正顺而易。' : '四课不全，事不正、逆而难。', 61));
      steps.push({ key: 'keti', title: '大局·课体', items });
    }

    // 先锋门·占时（书页 59–60）
    {
      const sz = ln.shiZhi, items = [];
      const t = ln.tianOver(sz), r = R(t);
      items.push(T(`占时为先锋门，不待运式而先有所主。占时${sz}，上神${zhiLine(r)}`, 59));
      const hits = [];
      if (wxRel(sz) === '财') hits.push(T(`时${sz}为日干之财：主财帛之事（更乘旺气、得吉神良将上下相生则定）。`, 59));
      if (YIMA[riZhi] === sz) hits.push(T(`时${sz}为日马：若不值天空、不落空亡，主出入道路、攸往咸宜之事。`, 59));
      const ganHe = LIU_HE[ganPos] === sz || (sanHeOf(ganPos).includes(sz) && sz !== ganPos);
      const zhiHe = LIU_HE[riZhi] === sz || (sanHeOf(riZhi).includes(sz) && sz !== riZhi);
      if (ganHe && zhiHe) hits.push(T('时合日干又合日枝：主两动，应内外和合，非一事也。', 59));
      else if (ganHe) hits.push(T('时为日干三合、六合：主外事和合。', 59));
      else if (zhiHe) hits.push(T('时为日枝三合、六合：主内事和合。', 59));
      if (HAI[ganPos] === sz) hits.push(T('时为日干六害：主外忧。', 59));
      if (HAI[riZhi] === sz) hits.push(T('时为日枝六害：主内忧。', 59));
      if (kong.has(sz)) hits.push(T('时为日之空亡：事主虚诈，闲占无益；凡占空喜终难成功，惟病讼以空亡为最吉（新病逢空则病散，旧病逢空则人亡）。', '59–60'));
      if (stage(riGan, sz) === '墓') hits.push(T('时为日墓：主干涉田土，或事属茔葬（更在传中则然）。', 60));
      if (chong(ganPos) === sz) hits.push(T('时为干冲：主外动。', 60));
      if (chong(riZhi) === sz) hits.push(T('时为枝冲：主内动，或主家宅卑幼及与人相争之事。', 60));
      if (XING[ganPos] === sz || XING[riZhi] === sz) hits.push(T('时为日刑：主出入事速。', 60));
      if (PO[riZhi] === sz || PO[ganPos] === sz) hits.push(T('时为日破：主破财走失。', 60));
      items.push(...hits);
      if (hits.some((h) => /干/.test(h.text))) items.push(OWN('「日干」的合、害、冲、刑、破，以日干寄宫之支论。'));
      steps.push({ key: 'xianfeng', title: '先锋门·占时', items });
    }
    // 直事门·月将（书页 60）
    {
      const items = [T(`月将${ln.yueJiang}加时${ln.shiZhi}。月将即太阳，所临吉增凶散，其用与天月二德同。`, 60)];
      if (sc.chuan.includes(ln.yueJiang)) items.push(T(`月将${ln.yueJiang}入传：为福不浅，系吉神则吉，系凶神则减凶，即值空亡亦不以空论。`, 60));
      steps.push({ key: 'zhishi', title: '直事门·月将', items });
    }

    // 外事门·日干（我）／内事门·日枝（彼）（书页 60–61）
    const gs = R(ke[0].shang), gy = R(ke[1].shang), zs = R(ke[2].shang), zy = R(ke[3].shang);
    {
      const items = [T(`日干${riGan}为外事门：干为我、为外、为动、为人、为男。干上${zhiLine(gs)}`, 60), L(`干阴（第二课）${zhiLine(gy)}`, '')];
      const rel = wxRel(gs.zhi);
      const said = { 生: '干上神生干，大吉。', 克: '干上神克干，大凶。', 泄: '干生上神，虚耗百出。', 财: '干克上神，阻隔重逢。' }[rel];
      if (said) items.push(T(said, 61));
      if (gs.zhi === riZhi) {
        const m = { 生: '枝加干生干，主彼就我助我。', 泄: '枝加干受生，主彼就我脱我。', 克: '枝加干克干，主彼就我欺我。', 财: '枝加干受克，主妻财就我。', 比: '枝加干比干，主彼就我培我。' }[rel];
        items.push(T(m, 60));
        if (LIU_HE[riZhi] === ganPos) items.push(T('枝加干合干，主彼就我和好。', '60–61'));
      }
      steps.push({ key: 'waishi', title: '外事门·日干（我）', items });
    }
    {
      const items = [T(`日枝${riZhi}为内事门：枝为彼、为内、为静、为宅、为女。枝上${zhiLine(zs)}`, 60), L(`枝阴（第四课）${zhiLine(zy)}`, '')];
      if (zs.zhi === ganPos) {
        const it = ZHI_WX[riZhi], rel = it === me ? '比' : sheng(it, me) ? '受生' : sheng(me, it) ? '生枝' : keWx(it, me) ? '受克' : '克枝';
        const m = { 受生: '干加枝受生，主我就彼助我。', 生枝: '干加枝生枝，主我就彼脱我。', 受克: '干加枝受克，主我就彼受欺。', 克枝: '干加枝克枝，主我就妻财。', 比: '干加枝比枝，主我就彼培彼。' }[rel];
        items.push(T(m, 60));
        if (LIU_HE[riZhi] === ganPos) items.push(T('干加枝合枝，主我就彼和好。', '60–61'));
      }
      // 干枝上神交互（书页 61）
      const zw = ZHI_WX[riZhi];
      const gsW = ZHI_WX[gs.zhi], zsW = ZHI_WX[zs.zhi];
      if (LIU_HE[gs.zhi] === riZhi && LIU_HE[zs.zhi] === ganPos) items.push(T('干上神合枝，枝上神合干：主彼我和好。', 61));
      if ((sheng(gsW, zw) && sheng(zsW, me)) || (sheng(gsW, me) && sheng(zsW, zw))) items.push(T('干上神生枝、枝上神生干，或干枝各受上神生：主彼我皆利。', 61));
      if ((keWx(gsW, zw) && keWx(zsW, me)) || (keWx(gsW, me) && keWx(zsW, zw))) items.push(T('干上神克枝、枝上神克干，或干枝各受上神克：主彼我相伤。', 61));
      if ((sheng(zw, gsW) && sheng(me, zsW)) || (sheng(me, gsW) && sheng(zw, zsW))) items.push(T('干上神脱枝、枝上神脱干，或干枝各受上神脱：主我脱彼，彼亦脱我。', 61));
      // 枝上神之生旺墓绝以日枝本气之干论（阳支取阳干、阴支取阴干）：书页 101 例丙寅日干上午、枝上卯，「干枝上皆值帝旺」
      const ZHI_GAN = { 子: '壬', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丁', 午: '丙', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '癸' };
      const sg = stage(riGan, gs.zhi), sz2 = stage(ZHI_GAN[riZhi], zs.zhi);
      const both = { 帝旺: '干枝上各见旺神：静乃获福，动必招尤。', 墓: '干枝上皆乘墓：终日昏昏，如醉如梦。', 沐浴: '干枝上逢败气：身衰宅败，意懒心灰。', 绝: '干枝上值绝神：生意索然，惟宜了结旧事。', 死: '干枝上逢死神：祸在眉睫，惟知止不殆。' };
      if (sg === sz2 && both[sg]) { items.push(T(both[sg], 61)); items.push(OWN('干上神以日干论、枝上神以日枝本气之干论其生旺墓绝（依书页 101 丙寅日例）。')); }
      if (XING[gs.zhi] === zs.zhi || XING[zs.zhi] === gs.zhi || HAI[gs.zhi] === zs.zhi) items.push(T('干枝上见刑、见害：宾主不投，各怀嫉妒。', 61));
      if (gs.kong && zs.kong) items.push(T('干枝上值空亡：镜花水月，劳而无功。', 61));
      if (sg !== sz2 && (both[sg] || both[sz2])) items.push(OWN(`干上神为日干${sg}之地、枝上神为日枝${sz2}之地；书页 61 所言为干枝上同见者，此处不同，不断。`));
      items.push(T('体虽如是，用或变更，学者可举一反三，慎毋胶柱而鼓瑟也。', 61));
      steps.push({ key: 'neishi', title: '内事门·日枝（彼）', items });
    }

    // 发端门·初传（书页 61–63）
    const wx = (r) => (a.yueZhi ? wangXiang(r.zhi, a.yueZhi) : '');
    const linGong = (r) => `临地盘${r.di}${r.gong ? '（奇门' + r.gong + '宫）' : ''}`;
    const zhan = (r) => {   // 内战外战（书页 62、82）：以天将五行与所乘枝神五行论
      const jw = JIANG_WX[r.jiang], zw = ZHI_WX[r.zhi];
      if (keWx(jw, zw)) return T(`${r.jiang}（${jw}）克所乘${r.zhi}（${zw}），将克神为外战：忧轻，虽凶可解。`, 62);
      if (keWx(zw, jw)) return T(`所乘${r.zhi}（${zw}）克${r.jiang}（${jw}），神克将为内战：忧重，虽吉有咎。`, 62);
      return null;
    };
    {
      const items = [T(`初传为发端门，应事之起点；发用能左右四课之祸福。初传${zhiLine(c1)}，${linGong(c1)}。`, '61、63')];
      const m = /第(\d)课/.exec(sc.why || '');
      if (m) {
        const n = +m[1];
        items.push(T(n <= 2 ? `用在第${n}课，主外事。` : `用在第${n}课${n === 4 ? '，名「蓦越」，事主蓦然而至' : ''}（书言用在第三、四课，如天乙逆行在贵人后，主事迟）。`, 63));
      }
      const lq = c1.liuQin;
      const yong = { 财: '用逢日财：事因求财。', 鬼: '用逢日鬼：动辄得咎。', 子孙: '用逢脱气：事属子孙。', 兄弟: '用逢日比：事属兄弟、朋友。', 父母: '用逢日印：生机蓬勃。' }[lq];
      if (yong) items.push(T(yong, 63));
      if (lq === '官') items.push(T('用逢官（克我而阴阳异）：克我者为鬼、又为官杀，惟官人占官禄、士人占科名、妇人占夫之类最宜，余皆大忌。', 69));
      const k1 = ZHI_WX[c1.zhi];
      const keWho = [];
      if (keWx(k1, me)) keWho.push('克日，身危或长上官讼');
      if (keWx(k1, ZHI_WX[riZhi])) keWho.push('克辰，家宅不宁');
      if (keWx(k1, ZHI_WX[ln.shiZhi])) keWho.push('克时，忧惊叠至');
      if (keWx(k1, ZHI_WX[sc.chuan[2]])) keWho.push('克末，有头无尾，先易后难');
      const nz = String(a.nianMing || '')[1], xz = String(a.xingNian || '')[1];
      if ((nz && ZHI.includes(nz) && keWx(k1, ZHI_WX[nz])) || (xz && keWx(k1, ZHI_WX[xz]))) keWho.push(`克${nz && keWx(k1, ZHI_WX[nz]) ? '本命' : ''}${xz && keWx(k1, ZHI_WX[xz]) ? (nz && keWx(k1, ZHI_WX[nz]) ? '、' : '') + '行年' : ''}，百事难成`);
      if (keWho.length) items.push(T(`用${keWho.join('；')}。`, 63));
      const st = stage(riGan, c1.zhi);
      const stTxt = { 长生: '用逢长生：谋为发达。', 沐浴: '用逢败（沐浴）：事必毁坏。', 死: '用逢死：事必毁坏。', 墓: '用逢墓库：事多迟延；占病死，占物在，占人归，占旧事凶。', 绝: '用绝：事了，人来、信至。' }[st];
      if (stTxt) items.push(T(`初传${c1.zhi}为日干${st}之地。${stTxt}`, 63));
      const bad = [];
      if (XING[c1.zhi] === ganPos || XING[c1.zhi] === riZhi) bad.push('刑');
      if (chong(c1.zhi) === ganPos || chong(c1.zhi) === riZhi) bad.push('冲');
      if (PO[c1.zhi] === ganPos || PO[c1.zhi] === riZhi) bad.push('破');
      if (HAI[c1.zhi] === ganPos || HAI[c1.zhi] === riZhi) bad.push('害');
      if (bad.length) { items.push(T(`用${bad.join('、')}干枝：重逢险恶，卒鲜收成。`, 63)); items.push(OWN('「用刑冲破害」取初传与日干寄宫、日枝之刑冲破害。')); }
      if (c1.kong) items.push(T('用空亡：忧喜不成，谋事出旬可望，托人谨防诈骗。', 63));
      const w = wx(c1);
      if (w) {
        const wTxt = w === '旺' || w === '相' ? '用逢旺相，则获利获名' : w === '死' ? '用逢死气，主丧失，尤应烦恼' : '用逢休囚，则防灾防讼';
        items.push(T(`初传${c1.zhi}${ZHI_WX[c1.zhi]}，${a.yueZhi}月${w}：${wTxt}；旺气为现成主近，相气为将来稍远，休囚等为已往远甚。`, '63、72'));
      }
      const zz = zhan(c1); if (zz) items.push(zz);
      steps.push({ key: 'fadian', title: '发端门·初传', items });
    }
    // 移易门·中传（书页 61–62）
    {
      const items = [T(`中传为移易门，应事之变迁：初凶中吉则移凶为吉，初吉中凶则移吉为凶。中传${zhiLine(c2)}，${linGong(c2)}。`, 61)];
      const w1 = ZHI_WX[c1.zhi], w2 = ZHI_WX[c2.zhi];
      if (sheng(w1, w2)) items.push(T(`初${c1.zhi}生中${c2.zhi}，母传子则顺。`, 62));
      else if (sheng(w2, w1)) items.push(T(`中${c2.zhi}生初${c1.zhi}，子传母则逆。`, 62));
      if (c2.liuQin === '鬼' || c2.liuQin === '官') items.push(T('中传为鬼：鬼主事坏。', 62));
      if (stage(riGan, c2.zhi) === '墓') items.push(T('中传为日墓：墓主事止。', 62));
      if (HAI[c1.zhi] === c2.zhi) items.push(T('初中相害：害为折腰，事多阻隔。', 62));
      if (PO[c1.zhi] === c2.zhi) items.push(T('初中相破：破主中（途）事体不成。', 62));
      if (c2.kong) items.push(T('中传空：空为断桥，又为折腰，主事体不成。', 62));
      const zz = zhan(c2); if (zz) items.push(zz);
      steps.push({ key: 'yiyi', title: '移易门·中传', items });
    }
    // 归计门·末传（书页 62）
    {
      const items = [T(`末传为归计门，应事之结束；发用在初，决事在末，最为紧切。末传${zhiLine(c3)}，${linGong(c3)}。`, 62)];
      const w1 = ZHI_WX[c1.zhi], w3 = ZHI_WX[c3.zhi];
      if (keWx(w3, w1)) items.push(T(`末${c3.zhi}克初${c1.zhi}，为终来克始：远行万里，入水不溺，入火不烧，病苏灾止。`, 62));
      const zei = /下贼上/.test(sc.why || '') && sc.ke.find((k) => k.shang === c1.zhi && keWx(ZHI_WX[k.xia] || GAN_WX[k.xia], w1));
      if (zei && keWx(w3, ZHI_WX[zei.xia] || GAN_WX[zei.xia])) items.push(T('初传受下贼克，而末传能制其贼克：终可反凶为吉。', 62));
      if (PO[c3.zhi] === c1.zhi || HAI[c3.zhi] === c1.zhi || PO[c3.zhi] === c2.zhi || HAI[c3.zhi] === c2.zhi) items.push(T('末传加破、害：有阻隔，吉凶皆不成。', 62));
      if (c3.kong) items.push(T('末传逢空亡：事无结果。', 62));
      const s1 = stage(riGan, c1.zhi), s3 = stage(riGan, c3.zhi);
      if (s1 === '长生' && s3 === '墓') items.push(T('初为日之长生，末为日之墓库：有始无终。', 62));
      if (s1 === '墓' && s3 === '长生') items.push(T('初为日之墓库，末为日之长生：先难后易。', 62));
      const zz = zhan(c3); if (zz) items.push(zz);
      steps.push({ key: 'guiji', title: '归计门·末传', items });
    }

    // 变体门·年命（书页 66）：年＝行年，命＝本命，各看其上神
    {
      const nm = String(a.nianMing || ''), nz = nm[1], xn = String(a.xingNian || '');
      const items = [];
      const one = (label, gz, z) => {
        const t = ln.tianOver(z), r = R(t), hit = [];
        items.push(T(`${label}${gz}，上神${zhiLine(r)}`, 66));
        if (t === ln.yueJiang) hit.push(T(`${label}上见月将：能解诸凶。`, 66));
        if (a.taiSui && (XING[t] === a.taiSui || XING[a.taiSui] === t)) hit.push(T(`${label}上神${t}与太岁${a.taiSui}相刑：常人主官讼忧疑。`, 66));
        if (t === '申' && r.jiang === '白虎') hit.push(T(`${label}上见传送申乘白虎：主疾病争端。`, 66));
        if (t === '亥' && r.jiang === '玄武') hit.push(T(`${label}上见登明亥乘玄武：主覆舟溺死。`, 66));
        if ((t === '辰' || t === '戌') && XIONG_JIANG.includes(r.jiang)) hit.push(T(`${label}上见${t}乘${r.jiang}（凶将）：百事不利。`, '65–66'));
        const ma = [YIMA[riZhi] === t ? '驿马' : '', a.yueZhi && tianMa(a.yueZhi) === t ? '天马' : ''].filter(Boolean);
        if (ma.length) hit.push(T(`${label}上见${ma.join('、')}：主奔驰远动，官职升迁。`, 66));
        const st = stage(riGan, t);
        if (st === '死' || st === '绝') hit.push(T(`${label}上见日干${st}之神：主人鬼相侵，惊危百出。`, 66));
        if ((r.liuQin === '鬼' || r.liuQin === '官') && (r.jiang === '白虎' || r.jiang === '勾陈')) hit.push(T(`${label}上见官鬼又乘${r.jiang}：主田土官非。`, 66));
        if (r.liuQin === '财') hit.push(T(`${label}上见财：书言「又遇德合，主财禄盈庭」；德合本面板未算，只记见财。`, 66));
        items.push(...hit);
        return hit.length;
      };
      const have = [];
      if (xn) have.push(one('行年', xn, xn[1]));
      if (nz && ZHI.includes(nz)) have.push(one('本命', nm, nz));
      if (have.length) {
        items.unshift(T('年命为变体门：课传人所同，年命人所独；课传凶而年命得救可转祸为福，神将吉而年命刑冲反令喜处生忧。年＝行年，命＝本命。', 66));
        if (!have.some((n) => n)) items.push(T('年命上神未见书中所列诸象（月将、太岁刑、申虎、亥玄、辰戌凶将、二马、死绝、财、官鬼虎勾），其余见父母、兄弟、子孙者「俱依法论」。', 66));
        items.push(T('三传凶，行年吉，能解之；三传行年俱凶，不能解。', 62));
        if (!xn) items.push(OWN('未给性别，行年不看（行年须由性别与岁数推得）。'));
      } else items.push(T('未给年命地支，也未给性别，此项不看（本命须有年支，行年须有性别）。', 66));
      steps.push({ key: 'bianti', title: '变体门·年命', items });
    }

    // 占类专项（集说篇书页 84–87）
    {
      const parts = ZHUAN_XIANG[a.domain] || [];
      const items = [];
      const f = sc.chuan[0], cf = c1, wq = a.yueZhi ? wangXiang(f, a.yueZhi) : '';
      const youQi = wq === '旺' || wq === '相';
      const mzj = (z) => (MENG.includes(z) ? '孟' : ZHONG.includes(z) ? '仲' : '季');
      for (const part of parts) {
        if (part === '存亡') {
          const hu = ZHI.split('').find((z) => ln.jiangOf(z) === '白虎');
          const ke2 = hu && keWx(ZHI_WX[hu], ZHI_WX[zs.zhi]);
          items.push(T(`论存亡：问人不知存亡，专视白虎——白虎乘${hu}，${ke2 ? `克枝上神${zs.zhi}，则亡` : `不克枝上神${zs.zhi}，则存`}。`, 84));
          const st = stage(riGan, f);
          if (['长生', '帝旺', '临官'].includes(st) || ['死', '墓'].includes(st)) items.push(T(`占人得生旺为存，死墓为亡：发用${f}为日干${st}之地。`, 84));
          if (a.xingNian) { const di = ln.diUnder(a.xingNian[1]); items.push(T(`占久出之人，行年${a.xingNian[1]}临${di}（${mzj(di)}）：${{ 孟: '临孟则存', 仲: '临仲则病', 季: '临季则亡' }[mzj(di)]}。`, 84)); }
          if (['长生', '帝旺', '临官', '死', '墓'].includes(st)) items.push(OWN('「占人得生旺」取发用之支在日干十二长生中的位置。'));
        } else if (part === '男女') {
          const yang = sc.chuan.filter((z) => zi(z) % 2 === 0).length;
          const txt = yang === 3 ? '纯阳主男' : yang === 0 ? '纯阴主女' : yang === 1 ? '一阳二阴主男' : '一阴二阳主女';
          items.push(T(`论男女：三传${sc.chuan.join('')}，${txt}。`, 84));
          items.push(T(`发用乘${c1.jiang}，为${YANG_JIANG.includes(c1.jiang) ? '阳将' : '阴将'}（贵、蛇、雀、勾、龙、虎为阳将；后、阴、合、空、常、玄为阴将）。`, 84));
        } else if (part === '老少') {
          const di = c1.di;
          items.push(T(`论老少：发用临${di}（${mzj(di)}）——临孟为少，临仲为壮，临季为老${wq ? `；发用${wq}，${youQi ? '有气为少' : '无气为老'}` : ''}。`, 85));
        } else if (part === '新旧') {
          const st = stage(riGan, f);
          const bits = [`发用${f}为${mzj(f)}神（孟新、仲半新、季旧）`];
          if (wq) bits.push(`${wq}（旺相为新、休囚为旧）`);
          if (st === '长生' || st === '墓') bits.push(`为日干${st}（长生为新、墓神为旧）`);
          items.push(T(`论新旧：${bits.join('，')}。占物，新神发用为新物，旧神发用为旧物。`, 85));
        } else if (part === '高低') {
          const bits = [];
          if (f === ke[0].shang) bits.push('干上发用为高，物藏高处');
          else if (f === ke[2].shang) bits.push('枝上发用为低，物藏低处');
          if (wq) bits.push(youQi ? '发用有气为高' : '发用无气为低');
          if (bits.length) items.push(T(`论高低：${bits.join('；')}。`, 86));
        } else if (part === '方所') {
          items.push(T(`论方所：发用${f}为${FANG_SUO[f]}；论住居为${ZHU_JU[f]}。`, 87));
          items.push(OWN('方所取发用之支；书中未限定取哪一支，类神另见规则 8。'));
        } else if (part === '远近') {
          const bits = [];
          if (/知一|比用|伏吟/.test(sc.name + keTi)) bits.push(`课体${keTi}为近`);
          if (/涉害|返吟/.test(sc.name)) bits.push(`课体${sc.name}为远`);
          if (wq) bits.push(youQi ? `发用${wq}为远` : `发用${wq}为近`);
          if (c1.jiang === '贵人' || c1.jiang === '太常') bits.push(`发用乘${c1.jiang}为近`);
          if (c1.jiang === '青龙' || c1.jiang === '六合') bits.push(`发用乘${c1.jiang}为远`);
          const d = ((zi(c1.di) - zi(ganPos)) % 12 + 12) % 12;
          bits.push(d === 0 ? '发用临干为近' : `发用所临距干${Math.min(d, 12 - d)}位（隔一二三四位渐远，七位极远）`);
          items.push(T(`论远近：${bits.join('；')}；以三传言，初近、中远、末更远。`, 87));
        } else if (part === '胜负') {
          const zw = ZHI_WX[riZhi];
          const bits = [keWx(me, zw) ? '干克枝，我胜' : keWx(zw, me) ? '枝克干，彼胜' : me === zw ? '干枝比和，彼我俱不胜' : '干枝相生，书未论胜负'];
          if (/上克下/.test(sc.why || '')) bits.push('上克下发用，先举者胜');
          else if (/下贼上/.test(sc.why || '')) bits.push('下贼上发用，后起者胜');
          const gK = keWx(ZHI_WX[gs.zhi], me), zK = keWx(ZHI_WX[zs.zhi], zw);
          if (gK && zK) bits.push('干枝俱被上克，尊卑皆负'); else if (gK) bits.push('干被上克，尊负'); else if (zK) bits.push('枝被上克，卑负');
          if (keWx(ZHI_WX[zs.zhi], me)) bits.push('干被枝上克，我负');
          if (keWx(ZHI_WX[gs.zhi], zw)) bits.push('枝被干上克，彼负');
          items.push(T(`论胜负：${bits.join('；')}。`, 86));
        } else if (part === '亲疏') {
          const he2 = (x, y) => LIU_HE[x] === y || (sanHeOf(x).includes(y) && x !== y);
          const sh = (x, y) => sheng(ZHI_WX[x], ZHI_WX[y]) || sheng(ZHI_WX[y], ZHI_WX[x]);
          const qin = he2(gs.zhi, zs.zhi) || he2(ganPos, riZhi) || he2(gs.zhi, riZhi) || he2(zs.zhi, ganPos) || sh(gs.zhi, zs.zhi) || sh(ganPos, riZhi);
          items.push(T(`论亲疏：干枝上下${qin ? '互为合或相生，彼此相契为亲' : '不联合、不相生，道不同不相为谋，为疏'}。`, 85));
          const fq = he2(f, ganPos) || sh(f, ganPos);
          items.push(T(`发用${f}与干${fq ? '相合或相生，为亲' : '不联合、不相生，为疏'}。`, 85));
        }
      }
      if (parts.length) steps.push({ key: 'zhuanxiang', title: '占类专项', items });
    }

    // 应期（书页 71–72、88）：只作参照
    {
      const items = [];
      const f = sc.chuan[0];
      const qi = [];
      if (a.taiSui && f === a.taiSui) qi.push('发用起太岁，吉凶应在本年之内');
      if (a.yueZhi && f === a.yueZhi) qi.push('发用起月建，应在本月之内');
      if (f === ln.yueJiang) qi.push('发用起月将，应在月将值事之内');
      if (dun[f] === '甲') qi.push('发用起旬首，应在本旬之内');
      if (f === ganPos || f === riZhi) qi.push('发用起本日干枝，应在本日');
      if (f === ln.shiZhi) qi.push('发用起所占之时，应在当时');
      if (qi.length) items.push(T(qi.join('；') + '。', '71–72'));
      else {
        const d = ((zi(f) - zi(riZhi)) % 12 + 12) % 12;
        items.push(T(d >= 1 && d <= 3 ? `岁月节候均不见发用，以本日枝推：初传${f}在日枝${riZhi}后第${d}位，应在第${d + 1}日。` : `岁月节候均不见发用，以本日枝推：初传${f}不在日枝${riZhi}后一至三位（「出四位则不取」），此法不取。`, 72));
      }
      items.push(T(`初传${f}所合${LIU_HE[f]}为成期，末传${sc.chuan[2]}所冲${chong(sc.chuan[2])}为散期。`, 72));
      const su = [], chi = [];
      if (sc.chuan.includes(ln.shiZhi)) su.push('传见占时');
      if (sc.chuan.some((z) => dun[z] === '丁')) su.push('传见丁神');
      if (sc.chuan.includes(YIMA[riZhi])) su.push('传见驿马');
      if (ln.shun) su.push('贵人顺行'); else chi.push('贵人逆行');
      if (sc.name === '伏吟') chi.push('伏吟');
      if (sc.name === '涉害') chi.push('涉害');
      if ([c1, c2, c3].some((r) => r.kong)) chi.push('传见空');
      if (sc.chuan.some((z) => stage(riGan, z) === '墓')) chi.push('传见墓');
      items.push(T(`迟速：${su.length ? su.join('、') + '，主事速' : ''}${su.length && chi.length ? '；' : ''}${chi.length ? chi.join('、') + '，主事迟' : ''}。`, 87));
      const ZH = { 亥: '丑', 子: '丑', 寅: '辰', 卯: '辰', 巳: '未', 午: '未', 申: '戌', 酉: '戌', 戌: '丑', 丑: '辰', 辰: '未', 未: '戌' };
      items.push(T(`中黄歌：发用${f}，看天盘${ZH[f]}所临地盘${ln.diUnder(ZH[f])}为应期。`, 88));
      items.push(OWN('应期诸法只作参照；AI 解读的最终应期照纪律第 12 条，六壬一路只用规则 7 所列之支。'));
      steps.push({ key: 'yingqi', title: '应期（参照）', items });
    }

    // 合看
    const he = [];
    const mv = moves(sc.chuan);
    if (mv.lian) {
      he.push(T(`三传${sc.chuan.join('')}为${mv.dir === '进' ? '顺' : '逆'}连茹：${mv.dir === '进' ? '主牵连引进' : '主牵连引退'}，吉则愈吉，凶则愈凶。${c3.kong ? (mv.dir === '进' ? '末空，反以退论。' : '末空，当作进言。') : ''}${c1.kong ? '初传逢空，进不能进，退不能退。' : ''}`, 79));
    } else if (mv.jian) {
      he.push(T(`三传${sc.chuan.join('')}为${mv.dir === '进' ? '顺' : '逆'}间断：${mv.dir === '进' ? '前进多阻' : '后退有妨'}${[c1, c2, c3].some((r) => r.kong) ? '；一见空亡，不拘此说' : ''}。`, 79));
    } else if (mv.dir) {
      he.push(T(`传${mv.dir}：传进为进，传退为退；进空宜退，退空宜进；再观三传，吉则宜进，凶则宜退。`, 84));
    } else if (mv.steps.length) {
      const desc = [];
      for (let i = 1; i < 3; i++) {
        const d = ((zi(sc.chuan[i]) - zi(sc.chuan[i - 1])) % 12 + 12) % 12;
        if (d) desc.push(`${sc.chuan[i - 1]}→${sc.chuan[i]}${d === 6 ? '对冲' : d < 6 ? '进' + '一二三四五'[d - 1] + '位' : '退' + '一二三四五'[12 - d - 1] + '位'}`);
      }
      he.push(OWN(`三传${sc.chuan.join('')}：${desc.join('，')}，进退不一，不归入进或退。`));
    }
    const set = new Set(sc.chuan);
    if (set.size === 3) {
      if ([...set].every((z) => MENG.includes(z))) he.push(T('三传四孟（寅申巳亥），名「玄胎」：主生机蓬勃，攸往咸宜。', 79));
      else if ([...set].every((z) => ZHONG.includes(z))) he.push(T('三传四仲（子午卯酉），名「关隔」（一名三交）：主门户破伤，阴私暗昧。', 79));
      else if ([...set].every((z) => '辰戌丑未'.includes(z))) he.push(T('三传四季（辰戌丑未），名「稼穑」：主耕耘田地，动吉静凶。', 79));
      const g = SAN_HE.find((x) => sc.chuan.every((z) => x.includes(z)));
      const JU = { 亥卯未: '木局：主仁政远敷，甘棠成荫', 寅午戌: '火局：主文明有象，烛照无遗', 巳酉丑: '金局：主锋刃肃煞，革故鼎新', 申子辰: '水局：主源流不息，灌溉功深' };
      if (g) he.push(T(`三传${g}，名「${JU[g]}」。`, 79));
    }
    if (mv.lian) he.push(W('伍剑虹参照——连茹者急：事情连续不断，发展快。', '77、130'));
    else if (mv.sanHe) he.push(W('伍剑虹参照——三合局更缓：事关牵连，必待合足才成，拖延缠绵。', '77、130'));
    else if (mv.chong) he.push(W('伍剑虹参照——传见对冲：事情冲荡不定，拖得时间更长。', 78));
    const allW = [c1, c2, c3].map((r) => ZHI_WX[r.zhi]);
    if (allW.every((w) => sheng(w, me))) he.push(T('三传生日：百事吉。', 62));
    if (allW.every((w) => keWx(w, me))) he.push(T('三传克日：百事凶。', 62));
    if (keWx(me, allW[0]) && keWx(allW[0], allW[1]) && keWx(allW[1], allW[2])) he.push(T('干克初，初克中，中克末：求财大获。', 62));
    const kc = [c1, c2, c3].filter((r) => r.kong).length;
    if (kc === 3) he.push(T('三传皆空：占事了无一实。', 62));
    else if (c1.kong && c2.kong) he.push(T('初中空：以末传为主。', 62));
    else if (c2.kong && c3.kong) he.push(T('中末空：以初传为主。', 62));
    if (sc.chuan[0] === ke[0].shang && sc.chuan[2] === ke[2].shang) he.push(T('三传自干上发用，传归枝上，名「朝枝格」：主我去求人干事，不得自由。', 62));
    if (sc.chuan[0] === ke[2].shang && sc.chuan[2] === ke[0].shang) he.push(T('三传自枝上发用，传归干上，名「朝日格」：主人来托我干事，易于成合。', 62));
    const shangs = new Set(ke.map((k) => k.shang));
    if (sc.chuan.every((z) => shangs.has(z))) he.push(T('三传不离四课，号曰「如珠走盘」：谋事成，吉则吉，凶则凶；忌占病讼、忧产。', 62));
    if (a.taiSui && sc.chuan.includes(a.taiSui)) {
      const tw = ZHI_WX[a.taiSui];
      he.push(T(`太岁${a.taiSui}在传：主一年吉凶之事。${sheng(tw, me) ? '太岁生我最吉。' : keWx(tw, me) ? '太岁克我最凶，若有救神，尚可幸免。' : ''}`, 67));
    }
    he.push(T(`贵人${ln.guiRen}临${ln.guiRenOverDi}，${ln.shun ? '顺治：凡占多顺' : '逆行：凡占多逆'}；顺逆之分，吉凶系焉。`, 83));
    const lq = [c1, c2, c3].map((r) => r.liuQin);
    const tag = (q) => (q === '财' || q === '父母' ? '成' : q === '官' || q === '鬼' ? '否' : '不明');
    he.push(W(`伍剑虹参照——三传六亲 ${lq.join('、')}：见财、父母者成，见官鬼者否，见子孙、兄弟者结果不明。逐传为 ${lq.map(tag).join('、')}。`, 130));

    // 先看这几条：照《探原》所言轻重（书页 61–63、72），只指出从哪里看起，不给吉凶
    const brief = (r) => `${r.dun || ''}${r.zhi}乘${r.jiang}（${r.liuQin}）${r.kong ? '，落旬空' : ''}${a.yueZhi ? '，' + a.yueZhi + '月' + wangXiang(r.zhi, a.yueZhi) : ''}`;
    const gRel = wxRel(gs.zhi);
    const focus = [
      T(`初传 ${brief(c1)}。书言发用「能左右四课之祸福，其力甚大」——这是整课最要紧的一个字。`, 63),
      T(`末传 ${brief(c3)}。书言「发用在初，决事在末，最为紧切」——看结局。`, 62),
      T(`干上神 ${gs.zhi} 对日干${riGan}：${{ 生: '生干，大吉', 克: '克干，大凶', 泄: '干生上神，虚耗百出', 财: '干克上神，阻隔重逢', 比: '比和，书未专论' }[gRel]}——看「我」的处境。`, 61),
      T(`应期线索：本旬空亡${[...kong].join('、') || '（无）'}，空亡填实可为成期；初传${sc.chuan[0]}所合${LIU_HE[sc.chuan[0]]}为成期，末传所冲${chong(sc.chuan[2])}为散期。`, 72),
    ];

    return {
      appliesTo: APPLIES_TO, source: SOURCE, keTi, focus,
      steps, heKan: he, moves: mv,
      chuan: [c1, c2, c3],
      caution: T('书中原话：「王课论生克，以天将所乘枝神之五行为主……若乘神生干，则凶将亦吉；乘神克干，则吉将亦凶。故将之吉凶，不必尽泥，而神之生克，务宜详究。」又：「吉凶相倚」，须于四课、三传、年命九处合而观之。本面板只把书上的要素逐条摆出，不合成总吉凶。', '75、82、91'),
    };
  }

  /**
   * 给 AI 提示词用的几行：与面板同一份内容，每句后注〔探原 N〕〔伍书 N〕或〔本 app 取法〕。
   */
  function toPromptLines(r) {
    const tag = (it) => (it.own ? '〔本 app 取法〕' : it.src ? `〔${it.src}〕` : '');
    const out = [`六壬推理（照${r.source}，八门逐项；只作旁证，不投票）：`];
    for (const st of r.steps) out.push(`  ${st.title}：` + st.items.map((it) => it.text + tag(it)).join(' '));
    out.push('  合看：' + r.heKan.map((it) => it.text + tag(it)).join(' '));
    out.push(`  ${r.caution.text}〔${r.caution.src}〕`);
    return out;
  }

  return { APPLIES_TO, SOURCE, KETI, TANYUAN_KETI, QISHU, ZHUAN_XIANG, analyze, wangXiang, moves, stage, xuSui, xingNian, toPromptLines };
});
