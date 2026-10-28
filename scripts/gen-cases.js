/**
 * 书中案例库：由 data/cases/*.json（逐例手录）生成 knowledge/liuren-cases.json。
 *
 * 手录只记书上有的：日柱、月将、占时、书中三传、课体、四课所示位差（diff）等，加我写的简短摘要。
 * 本脚本补上可推的：
 *   · diff（天盘相对地盘顺移几位，＝月将减占时）：手录有 diff 就用；否则书给了将与时就算；
 *     再不然，以书中三传在 12 种位差里反推，唯一解才收。
 *   · 由 diff 与占时推回月将（书中未明写月将者标 yueJiangDerived）。
 *   · 本 app 引擎所得三传与课体（chuanEngine、keTiEngine），与书不同者加 flag。
 *   · 书记公历日与日柱不合者：伍剑虹书标「活动时」（书中说明代人占多以抽签取干支）；
 *     王雷之书抽签只取时辰、日柱照实，不合即报出待核。
 * 用法：npm run gen:cases
 */
'use strict';
const fs = require('fs');
const path = require('path');
const SC = require('../core/liuren/sanchuan.js');

const ROOT = path.join(__dirname, '..');
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const zi = (z) => ZHI.indexOf(z);
const BOOKS = {
  wang: { file: 'wang.json', title: '王雷之《大六壬实占百例精解》', short: '王雷之' },
  wu: { file: 'wu.json', title: '伍剑虹《大六壬精义讲解》', short: '伍剑虹' },
};
let T = null;
try { T = require('tyme4ts'); } catch (e) { /* 无历法库则不核公历 */ }

function engine(riZhu, diff, opts) {
  return SC.compute({ riGan: riZhu[0], riZhi: riZhu[1], yueJiang: ZHI[diff], shiZhi: '子' }, opts);
}

function build() {
  const out = [];
  const problems = [];
  for (const [bk, meta] of Object.entries(BOOKS)) {
    const f = path.join(ROOT, 'data/cases', meta.file);
    if (!fs.existsSync(f)) continue;
    for (const c of JSON.parse(fs.readFileSync(f, 'utf8'))) {
      const flags = [];
      let diff = c.diff;
      if (diff == null && c.yueJiang && c.shiZhi) diff = (zi(c.yueJiang) - zi(c.shiZhi) + 12) % 12;
      if (diff == null && c.chuan) {
        let sol = [...Array(12).keys()].filter((k) => engine(c.riZhu, k).chuan.join('') === c.chuan);
        if (!sol.length) {
          sol = [...Array(12).keys()].filter((k) => engine(c.riZhu, k, { sheHai: 'mengzhong' }).chuan.join('') === c.chuan);
        }
        if (sol.length === 1) diff = sol[0];
      }
      if (diff == null) { problems.push(`${c.id}：定不出天地盘位差`); continue; }
      let yueJiang = c.yueJiang || null, derived = false;
      if (!yueJiang && c.shiZhi) { yueJiang = ZHI[(zi(c.shiZhi) + diff) % 12]; derived = true; }
      if (c.yueJiang && c.shiZhi && (zi(c.yueJiang) - zi(c.shiZhi) + 12) % 12 !== diff) {
        flags.push('书中将时与课图不合');
      }
      const r = engine(c.riZhu, diff);
      const chuanEngine = r.chuan.join('');
      if (c.chuan && c.chuan !== chuanEngine) flags.push('书中三传与本 app 不同');
      if (c.date && T && /^\d{4}-\d{2}-\d{2}$/.test(c.date)) {
        const [y, m, d] = c.date.split('-').map(Number);
        const day = T.SolarDay.fromYmd(y, m, d).getSixtyCycleDay().getSixtyCycle().getName();
        if (day !== c.riZhu) {
          if (bk === 'wu') flags.push('活动时');
          else problems.push(`${c.id}：公历 ${c.date} 为 ${day} 日，书中日柱 ${c.riZhu}，请核对`);
        }
      }
      out.push({
        id: c.id, book: bk, page: c.page, src: c.src || '', cat: c.cat || '',
        q: c.q, read: c.read || '', out: c.out || '',
        date: c.date || '', ganzhiNote: c.ganzhiNote || '',
        riZhu: c.riZhu, diff, yueJiang, yueJiangDerived: derived, shiZhi: c.shiZhi || null, zhouYe: c.zhouYe || '',
        chuanBook: c.chuan || '', keTiBook: c.keTi || '',
        chuanEngine, keTiEngine: r.name,
        bookNote: c.bookNote || '', flags,
      });
    }
  }
  return { out, problems };
}

if (require.main === module) {
  const { out, problems } = build();
  const doc = {
    _what: '书中六壬案例：盘式照录，问事、断法、应验为摘要（非原文），注书名页码。用于排盘时列出书中同课案例。',
    _books: Object.fromEntries(Object.entries(BOOKS).map(([k, v]) => [k, v.title])),
    _count: out.length,
    cases: out,
  };
  fs.writeFileSync(path.join(ROOT, 'knowledge/liuren-cases.json'), JSON.stringify(doc, null, 1) + '\n');
  console.log(`书中案例 ${out.length} 例；书与本 app 三传不同 ${out.filter((c) => c.flags.includes('书中三传与本 app 不同')).length} 例`);
  for (const p of problems) console.log('未收：' + p);
}
module.exports = { build, BOOKS };
