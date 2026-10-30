/**
 * 奇门穿壬 · 六壬推理（只显示、不投票、不进规则账本）。纯函数，无副作用。appliesTo: chuanren-exp
 *
 * 骨架照伍剑虹《大六壬精义讲解》第二章第一节「六壬判断的基本要素」（书页 13–14）八项：
 *   先锋（正时）、值事（月将）、外事（日干）、内事（日支）、发端（初传）、移易（中传）、归计（末传）、变体（年命）。
 * 前置「大局·课体」：书页 96–97 说吉凶「课格起了很大的作用，它是总体的概括」，十二神吉凶「更次」。
 * 后附「合看」：书页 77、130 的进退、急缓、贵人顺逆、成否；书页 75 的回环、外应。
 *
 * 每句带出处：src 为书页（伍剑虹书 PDF 页码，与书中页脚「N/163」一致）；
 *   own:true ＝ 书中没有逐字规定、本 app 自定的取法，界面上要标出来。
 * 书页 96–97 明言不能只凭十二神定吉凶，故本模块不给总吉凶，只把书上说的一条条摆出来。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./xiangyi.js'), require('./tiandipan.js'));
  else root.LiurenTuiLi = factory(root.LiurenXiangYi, root.LiurenTianDiPan);
})(typeof self !== 'undefined' ? self : this, function (XY, TDP) {
  'use strict';

  const APPLIES_TO = 'chuanren-exp';
  const SOURCE = '伍剑虹《大六壬精义讲解》';
  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const zi = (z) => ZHI.indexOf(z);
  const ZHI_WX = { 子: '水', 亥: '水', 寅: '木', 卯: '木', 巳: '火', 午: '火', 申: '金', 酉: '金', 辰: '土', 戌: '土', 丑: '土', 未: '土' };
  const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const MENG = '寅申巳亥', ZHONG = '子午卯酉';
  const SAN_HE = ['申子辰', '亥卯未', '寅午戌', '巳酉丑'];
  const L = (text, src, own) => ({ text, src: src ? '书页 ' + src : '', own: !!own });

  /** 课体本义（书页 7–12）与气数（书页 122） */
  const KETI = {
    重审: { p: 7, text: '下克上，以下犯上，重重审核、处处为难；但下克上是我克人，先迷而后利，最后得利的还是自己。' },
    元首: { p: 7, text: '上克下，上支配下，循序而行，天下顺而百事宜；对个人则受某种制约，压制过甚难免有后顾之忧。' },
    '知一（比用）': { p: 8, text: '几处相克并见、矛盾复杂，取与日干同性的一克为主要矛盾——矛盾最激烈、最容易发生变革之处。' },
    涉害: { p: 9, text: '自己涉及别人，或别人有害涉及自己。' },
    '遥克（蒿矢）': { p: 10, text: '神遥克日，箭从远方来伤我，遥远而力绵；遥克不是直接争斗，而是被人旁敲侧击、暗地捣鬼，不知灾从何来，一般危害不大（三传见巳酉金局则危害非浅）。' },
    '遥克（弹射）': { p: 10, text: '日遥克神，我去伤他人而太远无力，如弹丸；遥克不是直接争斗，而是旁敲侧击，一般危害不大（三传见巳酉金局则危害非浅）。' },
    '昴星（虎视）': { p: 10, text: '有人虎视眈眈，你已被监视注视，有潜在危险；四课无克，事物相互作用的力量微弱或尚未形成，「机」未现、事将萌。' },
    '昴星（冬蛇掩目）': { p: 10, text: '有人虎视眈眈，你已被监视注视，有潜在危险；四课无克，事物相互作用的力量微弱或尚未形成，「机」未现、事将萌。' },
    别责: { p: 10, text: '遭受责难，受家人或上司责难，非常被动；四课不全，气不全，事情办不成或办不好。' },
    八专: { p: 11, text: '干支同位，主次不分、彼我不明；有「专政」之意，受责难后被管制或遭刑罚。' },
    伏吟: { p: 12, text: '天地盘重合，如天地静止：难受呻吟、不动、为困、被拘捕。' },
    返吟: { p: 12, text: '动荡不定、反复不宁：静的被冲动、禁锢解除，或动的被冲散——好事办不成，坏事不成凶；初传有马则事来得快。' },
  };
  const QISHU = { 重审: '强', 元首: '强', '知一（比用）': '强', 涉害: '强', 别责: '弱', 八专: '弱', 伏吟: '弱', 返吟: '弱',
    '遥克（蒿矢）': '居中', '遥克（弹射）': '居中', '昴星（虎视）': '居中', '昴星（冬蛇掩目）': '居中' };

  /** 旺相休囚死（书页 15：得时我旺、我生者相、生我者休、克我者囚、我克者死；以月建为纲） */
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

  /** 三传走向（书页 77 第 53 问；书页 130 第 117 条） */
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

  /**
   * @param a.sc       SanChuan.compute 的结果（含 ke、chuan、name、why、liuren 天地盘）
   * @param a.riZhu    日柱（如「丁丑」）
   * @param a.yueZhi   月建地支（月柱之支），用来定旺相休囚；不给就不看
   * @param a.xunKong  六壬日旬空 [支, 支]
   * @param a.nianMing 年命干支（只有天干或空 → 变体一项不看）
   */
  function analyze(a) {
    const sc = a.sc, ln = sc.liuren, riGan = a.riZhu[0], riZhi = a.riZhu[1];
    const kong = new Set(a.xunKong || []), dun = TDP.dunGan(a.riZhu);
    const R = (z) => readZhi(ln, z, riGan, dun, kong);
    const ke = sc.ke, [c1, c2, c3] = sc.chuan.map(R);
    const steps = [];

    // 大局·课体
    {
      const k = KETI[sc.name], items = [];
      if (k) items.push(L(`${sc.name}：${k.text}`, k.p));
      if (sc.name === '涉害') {
        const di = ln.diUnder(sc.chuan[0]);
        const lv = MENG.includes(di) ? '孟（见机）：害深，机已成、事已露' : ZHONG.includes(di) ? '仲（察微）：害浅，只微有征兆' : '季：只有害之意而无害之行';
        items.push(L(`初传临${di}，在${lv}。`, 9));
        items.push(L('以初传所临地盘支定孟仲季。', '', true));
      }
      if (QISHU[sc.name]) items.push(L(`气数${QISHU[sc.name]}（四课全如贼克、比用、涉害气数强；别责、八专、返吟、伏吟弱；遥克、昴星居中）。气数强则吉凶信号都强，弱则减弱。`, 122));
      steps.push({ key: 'keti', title: '大局·课体', items });
    }

    // 1 先锋·占时
    {
      const t = ln.tianOver(ln.shiZhi), r = R(t);
      steps.push({ key: 'xianfeng', title: '先锋·占时', items: [
        L(`正时为先锋，是事情已露的先兆。占时${ln.shiZhi}，上神${zhiLine(r)}。`, 13),
      ] });
    }
    // 2 值事·月将
    steps.push({ key: 'zhishi', title: '值事·月将', items: [
      L(`月将${ln.yueJiang}加时${ln.shiZhi}：某事在此时辰出现，其状况就反映在天地盘上。`, 13),
    ] });

    // 3 外事·日干（我）
    const gs = R(ke[0].shang), gy = R(ke[1].shang);
    steps.push({ key: 'waishi', title: '外事·日干（我）', items: [
      L(`日干${riGan}为我，看我与他人、环境的关系；干上神代表事物主体的气数。干上${zhiLine(gs)}`, '13、75'),
      L(`干阴（第二课）${zhiLine(gy)}`, ''),
    ] });
    // 4 内事·日支（事／对方）
    const zs = R(ke[2].shang), zy = R(ke[3].shang);
    const inner = [
      L(`日支${riZhi}为所针对的人与事、归宿与周围状况；支上神代表其气数。支上${zhiLine(zs)}`, '14、75'),
      L(`支阴（第四课）${zhiLine(zy)}`, ''),
    ];
    const hard = [gs.liuQin === '鬼' ? '干上见鬼' : '', gs.kong ? '干上落空' : '', zs.liuQin === '鬼' ? '支上见鬼' : '', zs.kong ? '支上落空' : ''].filter(Boolean);
    if (hard.length) inner.push(L(`${hard.join('、')}：干支上遇鬼、墓、死、绝、空，事必困难重重。`, 131));
    steps.push({ key: 'neishi', title: '内事·日支（事／对方）', items: inner });

    // 5–7 三传
    const wx = (r) => (a.yueZhi ? wangXiang(r.zhi, a.yueZhi) : '');
    const linGong = (r) => `临地盘${r.di}${r.gong ? '（奇门' + r.gong + '宫）' : ''}`;
    {
      const items = [L(`初传为发端之门，是事物发展的起始；用神吉而得吉神生助则吉，凶而得凶神助则凶。初传${zhiLine(c1)}，${linGong(c1)}。`, 14)];
      const w = wx(c1);
      if (w) {
        const when = w === '旺' ? '现在事' : w === '相' ? '未来事' : '过去事（事虽未了，终归不成气候，好事不成、坏事不凶）';
        items.push(L(`初传${c1.zhi}${ZHI_WX[c1.zhi]}，${a.yueZhi}月${w}：旺气发用为现在事，相气为未来事，休囚等为过去事——此为${when}。`, 22));
      }
      const m = /第(\d)课/.exec(sc.why || '');
      if (m) {
        const n = +m[1];
        const who = n === 1 ? '日上发用：主发用，我方先动，事来得快、结束也快' : n === 2 ? '日阴发用：我方先动，但主要矛盾已转折，明的不行走暗的' : n === 3 ? '支上发用：客发用，对方先动、后发制人' : '支阴发用：对方先动，主要矛盾已转折，影响多是间接、旁敲侧击';
        items.push(L(`初传取自第${n}课，${who}。`, '61、75'));
      }
      steps.push({ key: 'fadian', title: '发端·初传', items });
    }
    steps.push({ key: 'yiyi', title: '移易·中传', items: [
      L(`中传为移易之门，是事情移动、变易的中间状态，由初传发展而来，发展是多向的。中传${zhiLine(c2)}，${linGong(c2)}。`, 14),
    ] });
    steps.push({ key: 'guiji', title: '归计·末传', items: [
      L(`末传为归计之门，是事物发展的归宿和终结。末传${zhiLine(c3)}，${linGong(c3)}。`, 14),
      L('发用看出现的是好事还是坏事，中末传决定事情的最终结局。', 131),
    ] });

    // 8 变体·年命
    {
      const nm = String(a.nianMing || ''), nz = nm[1];
      const items = [];
      if (nz && ZHI.includes(nz)) {
        const r = R(ln.tianOver(nz));
        items.push(L(`年命为变体：事物最终的好坏还要看年命，扶则变危为安，冲克则变吉为凶。年命${nm}，上神${zhiLine(r)}`, 14));
        items.push(L('年命上神如何算「扶」「抑」，书中此处未细说，这里只列出上神，不下扶抑之断。【待核】', '', true));
      } else items.push(L('未给年命地支，此项不看（年命须有年支才定得了位置）。', 14));
      steps.push({ key: 'bianti', title: '变体·年命', items });
    }

    // 合看
    const he = [];
    const mv = moves(sc.chuan);
    if (mv.dir) {
      const kind = mv.lian ? `${mv.dir}茹（连茹）` : mv.jian ? `${mv.dir}间` : `传${mv.dir}`;
      he.push(L(`三传${sc.chuan.join('')}为${kind}：${mv.dir === '进' ? '事物在持续地向前发展' : '事物在向后退引、收缩，处处受阻，有退无进，或曲折迂回、先退后进'}。`, 77));
    } else if (mv.steps.length) {
      const desc = [];
      for (let i = 1; i < 3; i++) {
        const d = ((zi(sc.chuan[i]) - zi(sc.chuan[i - 1])) % 12 + 12) % 12;
        if (d) desc.push(`${sc.chuan[i - 1]}→${sc.chuan[i]}${d === 6 ? '对冲' : d < 6 ? '进' + '一二三四五'[d - 1] + '位' : '退' + '一二三四五'[12 - d - 1] + '位'}`);
      }
      he.push(L(`三传${sc.chuan.join('')}：${desc.join('，')}，进退不一，书中进、退两例都不合，不归入进或退。`, '', true));
    }
    if (mv.lian) he.push(L('传隔得很近，连茹者急：事情连续不断，发展快。', '77、130'));
    else if (mv.sanHe) he.push(L(`三传成${SAN_HE.find((g) => sc.chuan.every((z) => g.includes(z)))}三合局，更缓：事关牵连，缺一不可，必待合足才成，故拖延缠绵。`, '77、130'));
    else if (mv.chong) he.push(L('传见对冲：事情冲荡不定，不可定论，拖得时间更长。', 78));
    else if (mv.gaps.length && mv.gaps.every((g) => g >= 2)) he.push(L('传隔得较远，间隔者缓：地支间隔越大，时间间隔也越大，事情走走停停。', '77、130'));
    he.push(L(`贵人${ln.guiRen}临${ln.guiRenOverDi}，${ln.shun ? '顺行：事易，发展较快' : '逆行：事难，发展较慢、办事受阻'}。`, '47、130'));
    const lq = [c1, c2, c3].map((r) => r.liuQin);
    const tag = (q) => (q === '财' || q === '父母' ? '成' : q === '官' || q === '鬼' ? '否' : '不明');
    he.push(L(`三传六亲 ${lq.join('、')}：见财、父母者成，见官鬼者否，见子孙、兄弟者结果不明（须待生日方成）。逐传为 ${lq.map(tag).join('、')}。`, 130));
    he.push(L('书中未说成否看哪一传，故三传逐一列出，不合成一句。', '', true));
    const shangs = new Set(ke.map((k) => k.shang));
    if (sc.chuan.every((z) => shangs.has(z))) he.push(L('三传都在四课之内，传不离课为「回环」：事情只在周围已知的事物或几个人中间转圈。', 75));
    else if (!ke.some((k) => sc.chuan.includes(k.shang))) he.push(L('四课上神都没上传，课不上传为「外应」：出乎意料的外来事物起了作用，四课之事暂成潜在因素。', '75–76'));

    return {
      appliesTo: APPLIES_TO, source: SOURCE, keTi: sc.name,
      steps, heKan: he, moves: mv,
      chuan: [c1, c2, c3],
      caution: L('书中原话：十二神吉凶要看全局结构——课格是总体概括，其次是四课三传上下结构、旺相休囚，「更次才是吉神凶神」，还要看与日干的六亲关系。本面板只把书上的要素逐条摆出，不合成总吉凶。', '96–97'),
    };
  }

  /**
   * 给 AI 提示词用的几行：与面板同一份内容，每句后注〔书页 N〕或〔本 app 取法〕。
   * 书中无逐字规定的句子标出来，让模型引用时分得清哪句是书、哪句是本 app 自定。
   */
  function toPromptLines(r) {
    const tag = (it) => (it.own ? '〔本 app 取法〕' : it.src ? `〔${it.src}〕` : '');
    const out = [`六壬推理（照${r.source}「六壬判断的基本要素」八项；只作旁证，不投票）：`];
    for (const st of r.steps) out.push(`  ${st.title}：` + st.items.map((it) => it.text + tag(it)).join(' '));
    out.push('  合看：' + r.heKan.map((it) => it.text + tag(it)).join(' '));
    out.push(`  ${r.caution.text}〔${r.caution.src}〕`);
    return out;
  }

  return { APPLIES_TO, SOURCE, KETI, QISHU, analyze, wangXiang, moves, toPromptLines };
});
