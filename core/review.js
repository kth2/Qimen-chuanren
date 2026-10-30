/**
 * 奇门穿壬 · AI 复盘（纯函数：条目怎样列、提示词怎样组、模型输出怎样校验、复盘怎样汇总）。
 *
 * 照 Qimen-pwa 的「AI 代标·断错分析」（core/casebook.js reviewPrompt/parseReview）与
 * 「复盘反推」（core/revise.js correctionPrompt/parseCorrection）的纪律，合成一次调用：
 *   ① 断错分析：从当时 AI 解读里照抄与实况不符的原句，指出它依据哪一条、实际如何、为何读偏；
 *   ② 复盘反推：已知结果，回看当时那一盘，只用盘上已有条目，本该怎么断；断不出就如实说；
 *   ③ 偏差所在：哪条被高估、低估、漏看；④ 单案心得。
 * 规则对错不交给模型：规则票对实况，确定性地算（ruleCheck）。
 * 校验：条目 id 必须是本案真实存在的；断错原句必须真在当时解读里；档位、枚举不合法的一律丢弃。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChuanRenReview = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const ANSWER_CHARS = 4000;
  const VERDICTS = ['derivable', 'partly_derivable', 'not_derivable'];
  const HOWS = ['overrated', 'underrated', 'missed'];
  const RULE_NAME = { 1: '用神天将', 2: '五行推理·天盘支', 3: '末传落宫', 4: '空亡互检', 5: '方位第二意见', 6: '命干',
    7: '应期融合·穿壬', 8: '类神入传', 9: '贵人互参', 10: '我彼双读' };

  const norm = (s) => String(s || '').replace(/[\s*_`#>|]/g, '');

  /** 一条规则票 → 一行文字（照案例本存下的字段） */
  function voteText(v) {
    const name = '规则' + v.rule + ' ' + (RULE_NAME[v.rule] || '');
    if (v.rule === 5) return name + '：' + (v.applicable ? '奇门方位' + (v.qimenGong || '') + '宫，第二方位 ' + (v.secondGongs || []).join('、') + ' 宫' : '弃权');
    if (v.rule === 7) return name + '：' + (v.picks && v.picks.length ? '应期日支 ' + v.picks.join('、') : '不给应期');
    if (v.verdict === '混') return name + '：混（奇门与六壬相反，未投票）';
    if (!v.applicable) return name + '：弃权';
    return name + '：' + (v.vote > 0 ? '+1' : '−1') + (v.relation ? '（' + v.relation + '）' : '') + (v.verdict ? '（' + v.verdict + '）' : '');
  }

  /**
   * 本案的条目清单（id 唯一，断错与偏差只许引这些）。
   * @param rec        案例记录
   * @param chartText  引擎 serializeChart 的盘面文字（重排出来、且四柱与存档一致时才有）
   * @param liurenLines 六壬层事实行：[{ id, text }]（四课、三传、贵人、旬空），由界面按存档重算
   */
  function items(rec, chartText, liurenLines) {
    const out = [];
    const lines = String(chartText || '').split('\n');
    for (const l of lines) {
      let m;
      if ((m = l.match(/^\s*(\d)宫\((.+?)\):\s*(.*)$/))) out.push({ id: 'g' + m[1], text: m[1] + '宫(' + m[2] + ')：' + m[3].trim() });
      else if (/^【值符】/.test(l)) out.push({ id: 'zf', text: l.trim() });
      else if (/^【空亡宫】/.test(l)) out.push({ id: 'kw', text: '奇门' + l.trim() });
      else if (/^【驿马】/.test(l)) out.push({ id: 'ma', text: l.trim() });
      else if (/^【引擎·用神】/.test(l)) out.push({ id: 'yong', text: l.trim() });
      else if (/^【引擎·总体】/.test(l)) out.push({ id: 'zt', text: l.trim() });
    }
    for (const x of liurenLines || []) if (x && x.id && x.text) out.push({ id: x.id, text: x.text });
    for (const v of rec.votes || []) out.push({ id: 'r' + v.rule, text: voteText(v) });
    if (rec.wuxing) out.push({ id: 'wx', text: '五行推理 v1：' + (rec.wuxing.verdict || '') + '（得分 ' + rec.wuxing.score + '）' });
    return out;
  }

  /** 标注（新版 labels，旧版 type/want/happened）——与 casebook.labels 同口径；这里不依赖它，免循环 */
  function labelsOf(rec) {
    const f = rec.feedback || {};
    return f.labels || (f.type ? { type: f.type, want: f.want, happened: f.happened } : null);
  }
  /** 实况是否如愿、是否发生 */
  function truthOf(rec) {
    const l = labelsOf(rec) || {};
    const happened = l.type === 'yesno' ? (l.happened === 'yes' ? true : l.happened === 'no' ? false : null) : null;
    const want = l.want;
    const wish = happened == null || !want || want === '?' ? null : want === 'hope' ? happened : !happened;
    return { happened, wish };
  }
  /** AI 结论的方向：旧版取勾选，新版由应验程度推出 */
  function aiPredOf(rec, t) {
    const f = rec.feedback || {};
    if (f.aiVerdict === 'wish') return true;
    if (f.aiVerdict === 'unwish') return false;
    if (!rec.ai || t.wish == null) return null;
    if (f.verdict === 'happened') return t.wish;
    if (f.verdict === 'not_happened' || f.verdict === 'opposite') return !t.wish;
    return null;
  }

  /**
   * 规则对错：确定性计算，不交给模型。
   * 规则 8 对「发生」，其余是非规则对「如愿」；规则 5 对实际方位；规则 7 对实际应期日支。
   * @returns [{ id, label, result: '对'|'错'|'—', why }]
   */
  function ruleCheck(rec) {
    const f = rec.feedback || {}, t = truthOf(rec), out = [];
    const VL = { happened: '完全应验', partial: '部分应验', not_happened: '未应验', opposite: '结果相反' };
    if (rec.ai && VL[f.verdict]) {
      out.push({ id: 'ai', label: 'AI 解读', result: f.verdict === 'happened' ? '对' : f.verdict === 'partial' ? '半对' : '错', why: VL[f.verdict] });
    } else {
      const ai = aiPredOf(rec, t);
      out.push({ id: 'ai', label: 'AI 结论', result: ai == null || t.wish == null ? '—' : ai === t.wish ? '对' : '错',
        why: ai == null ? '未断或未标' : t.wish == null ? '实况未定如愿与否' : (ai ? '断如愿' : '断不如愿') + '，实际' + (t.wish ? '如愿' : '不如愿') });
    }
    if (rec.wuxing && rec.wuxing.score) {
      const p = rec.wuxing.score > 0;
      out.push({ id: 'wx', label: '五行推理 v1', result: t.wish == null ? '—' : p === t.wish ? '对' : '错', why: (p ? '断如愿' : '断不如愿') });
    }
    for (const v of rec.votes || []) {
      const id = 'r' + v.rule, label = '规则' + v.rule + ' ' + (RULE_NAME[v.rule] || '');
      if (v.rule === 5) {
        if (!v.applicable || !f.actualGong) { out.push({ id, label, result: '—', why: f.actualGong ? '弃权' : '未填实际方位' }); continue; }
        const g = Number(f.actualGong), hit = (v.secondGongs || []).includes(g);
        out.push({ id, label, result: hit ? '对' : '错', why: '实际 ' + g + ' 宫，第二方位 ' + (v.secondGongs || []).join('、') });
        continue;
      }
      if (v.rule === 7) {
        if (!v.picks || !v.picks.length || !f.actualDayZhi) { out.push({ id, label, result: '—', why: f.actualDayZhi ? '未给应期' : '未填实际应期' }); continue; }
        const hit = v.picks.includes(f.actualDayZhi);
        out.push({ id, label, result: hit ? '对' : '错', why: '实际 ' + f.actualDayZhi + ' 日，所取 ' + v.picks.join('、') });
        continue;
      }
      if (v.verdict === '混') { out.push({ id, label, result: '—', why: '混，未投票' }); continue; }
      if (!v.applicable || !v.vote) { out.push({ id, label, result: '—', why: '弃权' }); continue; }
      const truth = v.rule === 8 ? t.happened : t.wish;
      const what = v.rule === 8 ? (v.vote > 0 ? '断发生' : '断不发生') : (v.vote > 0 ? '+1（作如愿论）' : '−1（作不如愿论）');
      out.push({ id, label, result: truth == null ? '—' : (v.vote > 0) === truth ? '对' : '错',
        why: what + (truth == null ? '，实况未定' : '，实际' + (v.rule === 8 ? (truth ? '发生' : '没发生') : (truth ? '如愿' : '不如愿'))) });
    }
    return out;
  }

  function actualText(rec) {
    const f = rec.feedback || {}, l = labelsOf(rec) || {};
    const VL = { happened: '完全应验', partial: '部分应验', not_happened: '未应验', opposite: '结果相反' };
    const bits = [];
    if (f.note) bits.push(f.note);
    if (VL[f.verdict]) bits.push('（用户标：当时解读' + VL[f.verdict] + '）');
    if (l.type === 'yesno') {
      bits.push('（' + (l.want === 'fear' ? '所问为怕发生之事' : l.want === 'hope' ? '所问为盼发生之事' : '盼怕未定') + '；' +
        (l.happened === 'yes' ? '实际发生了' : l.happened === 'no' ? '实际没发生' : l.happened === 'partial' ? '部分发生' : '是否发生不清楚') + '）');
    }
    if (f.actualGong) bits.push('实际方位：' + f.actualGong + ' 宫');
    if (f.actualDate) bits.push('实际应期：' + f.actualDate + (f.actualDayZhi ? '（' + f.actualDayZhi + '日）' : ''));
    return bits.join('\n');
  }

  /** 交给模型的提示（system, user）。只做比对与反推，不重新断卦、不新造断法。 */
  function prompt(rec, list) {
    const answer = String((rec.ai && rec.ai.answer) || '').slice(0, ANSWER_CHARS);
    const rc = ruleCheck(rec);
    const system = '你是奇门穿壬占例的复盘助手。只做「当时解读」与「实况」的比对，并只用当时盘上已有的条目回推本该怎么断；'
      + '不重新断卦、不新造断法、不引入盘上没有的元素。断不出就如实说断不出。只输出 JSON。';
    const user = [
      '【所问】' + String(rec.question || '').trim(),
      '【问句方向】' + (rec.framing === 'adverse' ? '检出为怕发生之事' : '未检出怕发生之事（不等于盼发生）'),
      '【占类】' + ((rec.input && rec.input.ui) || '') + '　【盘别】' + ((rec.input && rec.input.school) === 'feipan' ? '飞盘' : '转盘'),
      '',
      '【当时盘上的条目（断错依据与偏差只许引这些 id）】',
      list.length ? list.map((x) => '- ' + x.id + ' ｜ ' + x.text).join('\n') : '（无）',
      '',
      '【规则与 AI 结论的对错（已按实况算好，是事实，不必重判）】',
      rc.map((r) => '- ' + r.label + '：' + r.result + '（' + r.why + '）').join('\n'),
      '',
      '【当时的 AI 解读' + (answer.length >= ANSWER_CHARS ? '（节选前 ' + ANSWER_CHARS + ' 字）' : '') + '】',
      answer || '（未记录解读全文——断错分析留空）',
      '',
      '【实况（用户填写）】',
      actualText(rec) || '（未填写）',
      '',
      '【要求——防止事后圆说，务必遵守】',
      '1. 断错分析 misreads：从上面解读里挑出与实况明显不符的论断，最多 5 条。claim 必须照抄解读原句（不得转述，否则作废）；',
      '   basedOn 为它所依据的条目 id（对不上就留空字符串）；actual 写实际如何；why 写读偏在哪（高估了什么、漏看了什么、把什么读反了）。',
      '   断得对的不列；解读没提到的事不算断错（那放 observations）。没有 AI 解读就给空数组。',
      '2. 复盘反推：verdict 三选一——derivable（按当时盘上条目能断出实况）／partly_derivable（部分能）／not_derivable（断不出）。',
      '   correction 写成一份断语（结论＋依据，依据只引上面条目），不是复述实况。断不出就把 verdict 设为 not_derivable，',
      '   whyNotDerivable 说明为何断不出（盘上无相应之象／问法太笼统／此类事纲要未涉及）。强行圆说比承认断不出更有害。',
      '3. misweighted：当时具体偏在哪一条——itemId（必须是上面的 id）、how（overrated 高估／underrated 低估／missed 漏看）、why。指不出具体条目就不写。',
      '4. 规则的对错已算好，不要再判；一则案例不足以说明某条规则好坏，不得据此建议增删规则。',
      '5. lesson：一两句下次遇到同类盘的读法提醒，只能是上面条目的轻重取舍，不得是新断法；写不出就留空。',
      '6. observations：0–3 条实况里出现、当时解读没提到的现象，供参考，不是结论。',
      '7. 只输出 JSON，不要解释文字或代码块标记：',
      '{"misreads":[{"claim":"解读原句","basedOn":"条目id或空","actual":"实际如何","why":"读偏在哪"}],',
      ' "verdict":"derivable|partly_derivable|not_derivable","correction":"当时该怎么断（含依据）","whyNotDerivable":"",',
      ' "misweighted":[{"itemId":"条目id","how":"overrated|underrated|missed","why":"该怎么看"}],',
      ' "lesson":"","observations":[]}',
    ].join('\n');
    return { system, user };
  }

  /** 严格校验模型输出。条目 id 必须真实存在，断错原句必须真在当时解读里；不合格的丢弃并记下原因。 */
  function parse(text, rec, list) {
    const known = new Set((list || []).map((x) => x.id));
    const fail = (error) => ({ ok: false, error, misreads: [], misweighted: [], observations: [], dropped: [] });
    const raw = String(text || '').trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s < 0 || e <= s) return fail('未找到 JSON');
    let o;
    try { o = JSON.parse(raw.slice(s, e + 1)); } catch (err) { return fail('JSON 解析失败'); }
    if (!VERDICTS.includes(o.verdict)) return fail('verdict 不合法：' + o.verdict);
    const dropped = [];
    const ans = norm(rec.ai && rec.ai.answer);
    const str = (x, n) => (typeof x === 'string' ? x.trim().slice(0, n) : '');
    const misreads = [];
    for (const m of (Array.isArray(o.misreads) ? o.misreads : []).slice(0, 5)) {
      const claim = str(m && m.claim, 200);
      if (!claim) continue;
      if (!ans || !ans.includes(norm(claim))) { dropped.push({ what: claim.slice(0, 30), why: '原句不在当时解读里（转述或编造）' }); continue; }
      let basedOn = str(m.basedOn, 20);
      if (basedOn && !known.has(basedOn)) { dropped.push({ what: basedOn, why: '引了本案不存在的条目，已清空依据' }); basedOn = ''; }
      misreads.push({ claim, basedOn, actual: str(m.actual, 200), why: str(m.why, 300) });
    }
    const misweighted = [];
    for (const m of (Array.isArray(o.misweighted) ? o.misweighted : []).slice(0, 6)) {
      const itemId = str(m && m.itemId, 20);
      if (!known.has(itemId)) { dropped.push({ what: itemId || '（空）', why: '偏差条目不存在' }); continue; }
      if (!HOWS.includes(m.how)) { dropped.push({ what: itemId, why: 'how 不合法：' + m.how }); continue; }
      misweighted.push({ itemId, how: m.how, why: str(m.why, 300) });
    }
    const observations = (Array.isArray(o.observations) ? o.observations : [])
      .filter((x) => typeof x === 'string' && x.trim()).slice(0, 3).map((x) => x.trim().slice(0, 200));
    return {
      ok: true, error: '', verdict: o.verdict,
      correction: o.verdict === 'not_derivable' ? '' : str(o.correction, 1500),
      whyNotDerivable: o.verdict === 'not_derivable' ? str(o.whyNotDerivable, 500) : '',
      misreads, misweighted, lesson: str(o.lesson, 200), observations, dropped,
    };
  }

  /** 并入案例：只加 review 一栏，不动实况与计分 */
  function apply(rec, p, meta) {
    const review = Object.assign({ version: VERSION }, meta || {}, {
      verdict: p.verdict, correction: p.correction, whyNotDerivable: p.whyNotDerivable,
      misreads: p.misreads, misweighted: p.misweighted, lesson: p.lesson, observations: p.observations,
      ruleCheck: ruleCheck(rec),
    });
    return Object.assign({}, rec, { review, updatedAt: (meta && meta.at) || rec.updatedAt });
  }

  /** 条目 id → 汇总用的类别（各宫象合为一类，免得九宫各算各的永远攒不起来） */
  function category(id) {
    if (/^g\d$/.test(id)) return '奇门·宫中门星神干';
    if (/^tl-/.test(id)) return '六壬推理';
    return ({ zf: '奇门·值符值使', kw: '奇门·空亡', ma: '奇门·驿马', yong: '奇门·引擎用神', zt: '奇门·引擎总体',
      ke: '六壬·四课', sc: '六壬·三传', gui: '六壬·贵人', xk: '六壬·旬空', wx: '五行推理 v1' })[id]
      || (/^r\d+$/.test(id) ? '规则' + id.slice(1) + ' ' + (RULE_NAME[id.slice(1)] || '') : id || '（未挂依据）');
  }

  /** 复盘汇总：哪类条目最常把解读带偏；反推可断与断不出的比例；单案心得 */
  function summarize(records) {
    const done = (records || []).filter((r) => r.review);
    const by = {}, how = {}, verdict = { derivable: 0, partly_derivable: 0, not_derivable: 0 }, lessons = [];
    for (const r of done) {
      verdict[r.review.verdict] = (verdict[r.review.verdict] || 0) + 1;
      for (const m of r.review.misreads || []) { const k = category(m.basedOn); by[k] = (by[k] || 0) + 1; }
      for (const m of r.review.misweighted || []) { const k = category(m.itemId) + '·' + ({ overrated: '高估', underrated: '低估', missed: '漏看' })[m.how]; how[k] = (how[k] || 0) + 1; }
      if (r.review.lesson) lessons.push({ q: r.question, lesson: r.review.lesson, at: r.review.at || '' });
    }
    const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]);
    lessons.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return { n: done.length, verdict, misreadBy: top(by), misweighted: top(how), lessons: lessons.slice(0, 8) };
  }

  return { VERSION, items, ruleCheck, actualText, prompt, parse, apply, category, summarize, voteText };
});
