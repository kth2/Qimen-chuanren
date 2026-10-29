/**
 * 奇门穿壬 · 案例本（纯函数：记录怎样组、准确率怎样算）。存取交给 Qimen-pwa 的 CaseStore。
 *
 * 记分口径照《奇门穿壬 v1 · 冻结规格》「验证」一节：
 *   · 用户只填：实况描述＋应验程度（完全应验／部分应验／未应验／结果相反，同奇门 app）＋选填的实际日期、方位。
 *   · 是非题、盼怕、是否发生三项由 AI 标注员只看「问句＋实况」代标（看不到盘与任何断语），可手改（feedback.labels）。
 *     旧版记录的 type/want/happened 字段照旧认。AI 结论的方向由「应验程度」推出：应验＝断对，未应验或相反＝断反。
 *   · 是非题：如愿＝盼的发生了，或怕的没发生。主指标为平衡准确率（如愿题判对率与不如愿题判对率的平均，瞎猜恒为 50%）。
 *   · 各规则分开记，弃权不计；同题重录（问题加实况相同）只算一次。
 *   · 评估点只看两次：≥40 题且两类各 ≥10；≥100 题且两类各 ≥25。未到评估点只报数，不下结论。
 *   · 比较基准：AI 解读的结论（奇门为主），由用户回填时照 AI 原文勾选。
 *   · 规则 5 只在方位题、且第二方位与奇门方位不同时计命中。
 *   · v2（规则 7–10）：规则 8 判「事是否发生」，对「实况发生／没发生」计分，不对如愿；规则 7 只计应期日支命中。
 *   · 规则账本按规则版本主号分开：v1 的账本不沿用到 v2（项目规则），故各规则只计与当前版本主号相同的记录；
 *     AI 基准与五行 v1 不受规则版本影响，照旧全计。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChuanRenCasebook = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FORMAT = 'qimen-chuanren-casebook';
  const VERSION = '1.0.0';
  const EVAL = [{ n: 40, each: 10, label: '第一次评估' }, { n: 100, each: 25, label: '第二次（最后一次）评估' }];

  /** 排盘与穿壬结果 → 一条案例（只存复算和计分需要的，不存整张盘） */
  function makeRecord(o) {
    const { id, now, ctx, question, ai, framing } = o;
    const pan = ctx.pan, res = ctx.res;
    return {
      id, createdAt: now, updatedAt: now, app: 'qimen-chuanren', rulesVersion: res.version,
      question: String(question || '').trim(),
      framing: framing || '',   // Qimen-pwa Framing：'adverse'＝检出怕发生之事；回填时据此预选「怕」
      input: { date: ctx.dateStr, school: ctx.school, ui: ctx.ui, domainSource: ctx.domainSource || '', nianMing: ctx.nianMing || '' },
      chart: { siZhu: pan.siZhu, juShu: pan.juShu && pan.juShu.fullName },
      liuren: { yueJiang: res.yueJiang.yueJiang, xunKong: res.liuren.xunKong, sanChuan: res.sanChuan.chuan, keTi: res.sanChuan.name },
      quYong: res.quYong,
      votes: res.rules.map((r) => ({ rule: r.rule, applicable: !!r.applicable, vote: r.vote || 0, relation: r.relation || '',
        secondGongs: r.secondGongs, qimenGong: r.qimenGong, yingQi: r.yingQi || null, mo: r.mo,
        picks: r.picks, method: r.method || '', verdict: r.verdict || '', lr: r.lr, qm: r.qm })),
      wuxing: res.wuxing && res.wuxing.applicable ? { score: res.wuxing.score, verdict: res.wuxing.verdict } : null,
      ai: ai ? { answer: String(ai.answer || '').slice(0, 8000), model: ai.model || '' } : null,
      feedback: null,
    };
  }

  const VERDICT_LABEL = { happened: '完全应验', partial: '部分应验', not_happened: '未应验', opposite: '结果相反' };
  const VERDICT_SCORE = { happened: 1, partial: 0.5, not_happened: 0, opposite: 0 };

  /** 是非题／盼怕／是否发生：新版取 AI 标注员代标（可手改）的 labels，旧版记录取用户当时勾的 type/want/happened */
  function labels(rec) {
    const f = rec.feedback;
    if (!f) return null;
    if (f.labels) return f.labels;
    if (f.type) return { type: f.type, want: f.want, happened: f.happened, by: 'legacy' };
    return null;
  }

  /** 回填后：是否如愿。不是是非题或标「?」返回 null */
  function outcome(rec) {
    const l = labels(rec);
    if (!l || l.type !== 'yesno' || !l.want || l.want === '?' || !l.happened || l.happened === '?') return null;
    if (l.happened === 'partial') return null;
    const happened = l.happened === 'yes';
    return l.want === 'hope' ? happened : !happened;
  }

  /** AI 结论断的是如愿还是不如愿：旧版取用户勾的 aiVerdict；新版由应验程度推出（应验＝与实况同向，未应验或相反＝反向，部分不计） */
  function aiPred(rec) {
    const f = rec.feedback || {};
    if (f.aiVerdict === 'wish') return true;
    if (f.aiVerdict === 'unwish') return false;
    if (!rec.ai || !f.verdict) return null;
    const o = outcome(rec);
    if (o == null) return null;
    if (f.verdict === 'happened') return o;
    if (f.verdict === 'not_happened' || f.verdict === 'opposite') return !o;
    return null;
  }

  /** 标注员提示：只给问句与实况，不给盘与任何断语（同奇门 app 的盲标口径） */
  function labelPrompt(question, actual) {
    return {
      system: '你是占例标注员。只根据问句与实况文字做标注，看不到盘，也看不到任何断语，不得猜测吉凶。只输出 JSON。',
      user: [
        '【问句】' + String(question || '').trim(),
        '【实况】' + String(actual || '').trim(),
        '',
        '标三项：',
        '1. isYesNo：主问是不是「某件事会不会发生／能不能成」的是非题。问何时、在哪里、多少、是什么、选哪个的为 false；一问兼有几问，只看主问。',
        '2. want：求测人盼这件事发生填 hope，怕它发生填 fear，看不出填 ?。注意问句是否问「会不会被……」「会不会出事」这类怕发生之事。',
        '3. happened：照实况，这件事发生了填 yes，没发生填 no，只发生一部分填 partial，实况没说清填 ?。不要推测。',
        '只输出 JSON：{"isYesNo":true,"event":"所问之事（十字内）","want":"hope|fear|?","happened":"yes|no|partial|?"}',
      ].join('\n'),
    };
  }
  function parseLabel(text) {
    const raw = String(text || ''), s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s < 0 || e <= s) return { ok: false, error: '未找到 JSON' };
    let o; try { o = JSON.parse(raw.slice(s, e + 1)); } catch (err) { return { ok: false, error: 'JSON 解析失败' }; }
    if (typeof o.isYesNo !== 'boolean') return { ok: false, error: 'isYesNo 不合法' };
    if (!['hope', 'fear', '?'].includes(o.want)) return { ok: false, error: 'want 不合法：' + o.want };
    if (!['yes', 'no', 'partial', '?'].includes(o.happened)) return { ok: false, error: 'happened 不合法：' + o.happened };
    return { ok: true, labels: { type: o.isYesNo ? 'yesno' : 'other', want: o.want, happened: o.happened,
      event: typeof o.event === 'string' ? o.event.slice(0, 20) : '' } };
  }

  function dedupe(recs) {
    const seen = new Set(), out = [];
    for (const r of recs) {
      const k = (r.question || '').replace(/\s+/g, '') + '|' + ((r.feedback && r.feedback.note) || '').replace(/\s+/g, '');
      if (seen.has(k)) continue;
      seen.add(k); out.push(r);
    }
    return out;
  }

  function score(rows) {   // rows: [{pred:bool, truth:bool}]
    const pos = rows.filter((r) => r.truth), neg = rows.filter((r) => !r.truth);
    const tp = pos.filter((r) => r.pred).length, tn = neg.filter((r) => !r.pred).length;
    const rp = pos.length ? tp / pos.length : null, rn = neg.length ? tn / neg.length : null;
    return { n: rows.length, pos: pos.length, neg: neg.length,
      acc: rows.length ? (tp + tn) / rows.length : null,
      balanced: rp != null && rn != null ? (rp + rn) / 2 : null };
  }

  function stage(n, pos, neg) {
    let reached = null;
    for (const e of EVAL) if (n >= e.n && pos >= e.each && neg >= e.each) reached = e;
    const next = EVAL.find((e) => !(n >= e.n && pos >= e.each && neg >= e.each)) || null;
    return { reached, next };
  }

  const major = (v) => String(v || '').split('.')[0];
  /** 实况是否发生（规则 8 用）；部分、不清楚返回 null */
  function happened(rec) {
    const l = labels(rec);
    if (!l || l.type !== 'yesno') return null;
    return l.happened === 'yes' ? true : l.happened === 'no' ? false : null;
  }

  /** 统计。返回各路判断的计分与评估点进度；判定（通过/停止/继续）只在到达评估点时给出。
   *  opts.rulesVersion：当前规则版本；给了就只拿同主号的记录给各规则计分 */
  function stats(records, opts) {
    opts = opts || {};
    const done = dedupe(records.filter((r) => r.feedback && r.feedback.archived));
    const yn = done.filter((r) => outcome(r) !== null);
    const sameVer = (r) => !opts.rulesVersion || major(r.rulesVersion) === major(opts.rulesVersion);
    const truthPos = yn.filter((r) => outcome(r)).length, truthNeg = yn.length - truthPos;
    const st = stage(yn.length, truthPos, truthNeg);

    const ai = score(yn.filter((r) => aiPred(r) !== null).map((r) => ({ pred: aiPred(r), truth: outcome(r) })));
    // 应验分（同奇门 app：完全应验 1、部分 0.5、未应验与相反 0），不必标注就能算
    const vs = done.filter((r) => r.ai && VERDICT_SCORE[r.feedback.verdict] != null);
    const aiHit = { n: vs.length, avg: vs.length ? vs.reduce((t, r) => t + VERDICT_SCORE[r.feedback.verdict], 0) / vs.length : null,
      counts: Object.fromEntries(Object.keys(VERDICT_LABEL).map((k) => [k, vs.filter((r) => r.feedback.verdict === k).length])) };
    const unlabeled = done.filter((r) => !labels(r)).length;
    const wx = score(yn.filter((r) => r.wuxing && r.wuxing.score !== 0).map((r) => ({ pred: r.wuxing.score > 0, truth: outcome(r) })));

    const rules = {};
    for (const k of [1, 2, 3, 4, 6, 8, 9, 10]) {
      const truthOf = k === 8 ? happened : outcome;
      const pool = (k === 8 ? done.filter((r) => happened(r) !== null) : yn).filter(sameVer);
      const rows = pool.map((r) => ({ v: (r.votes || []).find((x) => x.rule === k), truth: truthOf(r) }))
        .filter((x) => x.v && x.v.applicable && x.v.vote !== 0).map((x) => ({ pred: x.v.vote > 0, truth: x.truth }));
      const s = score(rows);
      let verdict = null;
      if (st.reached && s.balanced != null && ai.balanced != null) {
        if (s.balanced >= ai.balanced + 0.05 && s.balanced >= 0.55) verdict = '通过';
        else if (s.balanced < ai.balanced) verdict = '停止';
        else verdict = st.reached === EVAL[1] ? '停止' : '继续';
      }
      rules[k] = Object.assign(s, { verdict });
    }

    // 规则 5：方位题，第二方位与奇门方位不同者
    const dir = done.filter((r) => r.feedback.actualGong).filter(sameVer);
    let d5 = { n: 0, second: 0, qimen: 0 };
    for (const r of dir) {
      const v = (r.votes || []).find((x) => x.rule === 5);
      if (!v || !v.applicable || !v.secondGongs || (v.secondGongs.length === 1 && v.secondGongs[0] === v.qimenGong)) continue;
      const g = Number(r.feedback.actualGong);
      d5.n++; if (v.secondGongs.includes(g)) d5.second++; if (v.qimenGong === g) d5.qimen++;
    }
    // 规则 4 应期候选：实际应期之日支与末传相同
    let d4 = { n: 0, hit: 0 };
    for (const r of done.filter(sameVer)) {
      const v = (r.votes || []).find((x) => x.rule === 4);
      if (!v || !v.yingQi || !r.feedback.actualDayZhi) continue;
      d4.n++; if (r.feedback.actualDayZhi === v.mo) d4.hit++;
    }
    // 规则 7 应期：实际应期日支落在所取日支里算命中；瞎猜期望＝各题所取支数／12 之和
    let d7 = { n: 0, hit: 0, expect: 0 };
    for (const r of done.filter(sameVer)) {
      const v = (r.votes || []).find((x) => x.rule === 7);
      // v2.1 起规则 7 改为「奇门为主、六壬决胜」；旧法（四法等权）的记录不混进来
      if (!v || v.method !== 'qimen-first' || !v.picks || !v.picks.length || !r.feedback.actualDayZhi) continue;
      d7.n++; d7.expect += v.picks.length / 12; if (v.picks.includes(r.feedback.actualDayZhi)) d7.hit++;
    }
    d7.expect = +d7.expect.toFixed(2);
    return { total: records.length, archived: done.length, yesno: yn.length, pos: truthPos, neg: truthNeg,
      stage: st, ai, aiHit, unlabeled, wuxing: wx, rules, rule5: d5, rule4YingQi: d4, rule7: d7 };
  }

  return { FORMAT, VERSION, EVAL, VERDICT_LABEL, VERDICT_SCORE, makeRecord, labels, outcome, aiPred, happened,
    labelPrompt, parseLabel, dedupe, score, stats };
});
