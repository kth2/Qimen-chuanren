/**
 * 奇门穿壬 · 书中同课案例。纯函数：给当前六壬课，列出书中案例库里相同或相近的例子。
 *
 * 分三级（同一例只归最高一级）：
 *   · 全同：日柱、月将、占时都同 → 天地盘、四课、三传、天将全同（昼夜另看）。
 *   · 同课：日柱同，天地盘位差同（月将减占时）→ 四课三传全同，天将可能因占时昼夜不同。
 *   · 同三传：日柱不同，三传相同（按本 app 引擎所得，或书中所写）。
 * 案例数据见 knowledge/liuren-cases.json（scripts/gen-cases.js 生成）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LiurenCaseMatch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ZHI = '子丑寅卯辰巳午未申酉戌亥';
  const zi = (z) => ZHI.indexOf(z);
  const diffOf = (yueJiang, shiZhi) => (zi(yueJiang) - zi(shiZhi) + 12) % 12;
  const LEVELS = [
    { key: 'quanTong', label: '全同', note: '日柱、月将、占时全同' },
    { key: 'tongKe', label: '同课', note: '日柱同、天地盘同，四课三传全同' },
    { key: 'tongChuan', label: '同三传', note: '日柱不同，三传相同' },
  ];

  /**
   * @param cases  knowledge/liuren-cases.json 的 cases
   * @param cur    { riZhu, yueJiang, shiZhi, chuan: ['子','丑','寅'] 或 '子丑寅' }
   * @returns { quanTong:[], tongKe:[], tongChuan:[], total }
   */
  function match(cases, cur) {
    const res = { quanTong: [], tongKe: [], tongChuan: [], total: 0 };
    if (!cases || !cur || !cur.riZhu || !cur.yueJiang || !cur.shiZhi) return res;
    const d = diffOf(cur.yueJiang, cur.shiZhi);
    const ch = Array.isArray(cur.chuan) ? cur.chuan.join('') : String(cur.chuan || '');
    for (const c of cases) {
      if (c.riZhu === cur.riZhu && c.diff === d) {
        if (c.yueJiang === cur.yueJiang && c.shiZhi === cur.shiZhi) res.quanTong.push(c);
        else res.tongKe.push(c);
      } else if (ch && (c.chuanEngine === ch || c.chuanBook === ch)) {
        res.tongChuan.push(c);
      }
    }
    res.total = res.quanTong.length + res.tongKe.length + res.tongChuan.length;
    return res;
  }

  /** 书中案例按占类分组（浏览用），组内按书、例号排 */
  function byCategory(cases) {
    const g = {};
    for (const c of cases || []) (g[c.cat || '其他'] = g[c.cat || '其他'] || []).push(c);
    return g;
  }

  return { match, byCategory, diffOf, LEVELS };
});
