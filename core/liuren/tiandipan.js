/**
 * 奇门穿壬 · 第一层：六壬天地盘与十二天将（纯函数，无副作用）
 *
 * 规格：《奇门穿壬 v1 · 冻结规格》第一层。
 * 贵人表、昼夜分界、贵人顺逆：袁树珊《大六壬探原》卷上推演篇。
 * 天将吉凶二分：本规格自定，非《探原》原文。
 *
 * 本模块只依时间，不碰奇门的转盘／飞盘规则；月将由调用方传入
 * （月将切换时刻待核原文，见规格「未决事项」）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiurenTianDiPan = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const JIANG = ['贵人', '螣蛇', '朱雀', '六合', '勾陈', '青龙', '天空', '白虎', '太常', '玄武', '太阴', '天后'];
  // 本规格自定的吉凶二分
  const JI_JIANG = new Set(['贵人', '六合', '青龙', '太常', '太阴', '天后']);

  // 《探原》日贵人歌：甲羊戊庚牛，乙猴己鼠求，丙鸡丁猪位，壬兔癸蛇游，六辛逢虎上
  const DAY_GUI = { 甲: '未', 乙: '申', 丙: '酉', 丁: '亥', 戊: '丑', 己: '子', 庚: '丑', 辛: '寅', 壬: '卯', 癸: '巳' };
  // 《探原》夜贵人歌：甲牛戊庚羊，乙鼠己猴乡，丙猪丁鸡位，壬蛇癸兔藏，六辛逢午马
  const NIGHT_GUI = { 甲: '丑', 乙: '子', 丙: '亥', 丁: '酉', 戊: '未', 己: '申', 庚: '未', 辛: '午', 壬: '巳', 癸: '卯' };
  // 《探原》：占时卯辰巳午未申用日贵，酉戌亥子丑寅用夜贵
  const ZHOU_SHI = '卯辰巳午未申';
  // 《探原》：贵人加地盘亥子丑寅卯辰顺行，加戌酉申未午巳逆行
  const SHUN_DI = '亥子丑寅卯辰';

  // 九宫地盘支（中五无支）
  const GONG_ZHI = { 1: ['子'], 8: ['丑', '寅'], 3: ['卯'], 4: ['辰', '巳'], 9: ['午'], 2: ['未', '申'], 7: ['酉'], 6: ['戌', '亥'], 5: [] };
  const ZHI_GONG = {};
  for (const g in GONG_ZHI) for (const z of GONG_ZHI[g]) ZHI_GONG[z] = Number(g);

  const XUN_SHOU_GAN = '甲乙丙丁戊己庚辛壬癸';

  function idx(z) {
    const i = ZHI.indexOf(z);
    if (i < 0 || z.length !== 1) throw new Error('不是地支：' + z);
    return i;
  }
  const at = (i) => ZHI[((i % 12) + 12) % 12];

  /**
   * @param {{riGan:string, yueJiang:string, shiZhi:string}} p
   *   riGan 日干；yueJiang 月将（地支）；shiZhi 占时时支（与奇门盘同一时辰）
   */
  function build(p) {
    const { riGan, yueJiang, shiZhi } = p;
    if (!DAY_GUI[riGan]) throw new Error('不是天干：' + riGan);
    const offset = (((idx(yueJiang) - idx(shiZhi)) % 12) + 12) % 12;
    const tianOver = (diZhi) => at(idx(diZhi) + offset); // 地盘某支之上的天盘支
    const diUnder = (tianZhi) => at(idx(tianZhi) - offset); // 天盘某支所加的地盘支

    const zhou = ZHOU_SHI.includes(shiZhi);
    const guiRen = zhou ? DAY_GUI[riGan] : NIGHT_GUI[riGan];
    const guiRenOverDi = diUnder(guiRen);
    const shun = SHUN_DI.includes(guiRenOverDi);

    const jiangByTian = {};
    for (let k = 0; k < 12; k++) jiangByTian[at(idx(guiRen) + (shun ? k : -k))] = JIANG[k];

    function readGong(gong) {
      const readings = GONG_ZHI[gong].map((di) => {
        const tian = tianOver(di);
        const jiang = jiangByTian[tian];
        return { di, tian, jiang, ji: JI_JIANG.has(jiang) };
      });
      let verdict = null; // 中五无支
      if (readings.length) {
        const ji = readings.every((r) => r.ji);
        const xiong = readings.every((r) => !r.ji);
        verdict = ji ? '吉' : xiong ? '凶' : '混';
      }
      return { gong, readings, verdict };
    }

    /** 规则 5：事宫地盘支在天盘上所加的地盘支之宫（第二方位），可能一或两宫 */
    function secondDirection(gong) {
      const gs = GONG_ZHI[gong].map((x) => ZHI_GONG[diUnder(x)]);
      return [...new Set(gs)];
    }

    return {
      yueJiang, shiZhi, riGan, offset,
      zhouYe: zhou ? '昼' : '夜',
      guiRen, guiRenOverDi, shun,
      tianOver, diUnder,
      jiangOf: (tianZhi) => jiangByTian[tianZhi],
      readGong, secondDirection,
    };
  }

  /** 六壬日旬空：日柱所在旬的两个空支 */
  function xunKong(riZhu) {
    const g = XUN_SHOU_GAN.indexOf(riZhu[0]);
    const z = idx(riZhu[1]);
    if (g < 0 || (g - z) % 2 !== 0) throw new Error('不是干支：' + riZhu);
    const xunShouZhi = z - g; // 旬首（甲）所临之支
    return [at(xunShouZhi + 10), at(xunShouZhi + 11)];
  }

  return { ZHI, JIANG, JI_JIANG, DAY_GUI, NIGHT_GUI, GONG_ZHI, ZHI_GONG, build, xunKong };
});
