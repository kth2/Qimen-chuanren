/**
 * 奇门穿壬 · 月将
 *
 * 默认规则 'zhongqi'：太阳过中气即换月将（雨水后亥将……冬至后丑将、大寒后子将）。
 * 【待核】《大六壬探原》推演篇的原文还没核过；冻结规格「未决事项」第一条。
 * 原文核定之前，本模块的结果只用于开发和影子计算，不作定论。
 *
 * 时间以北京时间（UTC+8）比较，与 tyme4ts（寿星天文历）一致。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('tyme4ts'));
  else root.LiurenYueJiang = factory(root.tyme4ts);
})(typeof self !== 'undefined' ? self : this, function (T) {
  'use strict';

  const STATUS = '待核';
  // tyme4ts 节气序：0 冬至、2 大寒、4 雨水……20 霜降、22 小雪（偶数为中气）
  const ZHONGQI_JIANG = { 0: '丑', 2: '子', 4: '亥', 6: '戌', 8: '酉', 10: '申', 12: '未', 14: '午', 16: '巳', 18: '辰', 20: '卯', 22: '寅' };

  /** Date → 北京时间的儒略日 */
  function julianBeijing(date) {
    const b = new Date(date.getTime() + 8 * 3600 * 1000);
    return T.JulianDay.fromYmdHms(b.getUTCFullYear(), b.getUTCMonth() + 1, b.getUTCDate(),
      b.getUTCHours(), b.getUTCMinutes(), b.getUTCSeconds()).getDay();
  }

  /**
   * @param {Date} date 起局时刻（绝对时间）
   * @returns {{ yueJiang:string, zhongQi:string, since:string, rule:string, status:string }}
   */
  function of(date, rule) {
    rule = rule || 'zhongqi';
    if (rule !== 'zhongqi') throw new Error('未知月将规则：' + rule);
    const jd = julianBeijing(date);
    const b = new Date(date.getTime() + 8 * 3600 * 1000);
    // 从下一年的冬至往回找，取最近一个已过的中气
    for (let y = b.getUTCFullYear() + 1; y >= b.getUTCFullYear() - 1; y--) {
      for (let i = 22; i >= 0; i -= 2) {
        const t = T.SolarTerm.fromIndex(y, i);
        const tj = t.getJulianDay();
        if (tj.getDay() <= jd) {
          return { yueJiang: ZHONGQI_JIANG[i], zhongQi: t.getName(), since: tj.getSolarTime().toString(), rule, status: STATUS };
        }
      }
    }
    throw new Error('找不到中气');
  }

  return { of, STATUS, ZHONGQI_JIANG };
});
