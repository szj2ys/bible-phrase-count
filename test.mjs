import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { countMatches, normalize, run, parseCsv, countByRule, loadCorpus } from './count.mjs';

// --- normalisation: CJK must survive, punctuation must not become glue -----
assert.equal(normalize('Fear not.'), 'FEAR NOT');
assert.equal(normalize('fear   not'), 'FEAR NOT');
assert.equal(normalize('不要惧怕'), '不要惧怕');           // not deleted

// --- substring matches must NOT count --------------------------------------
assert.equal(countMatches('Be not fearful.', 'fear'), 0);
assert.equal(countMatches('God-fearing', 'fear'), 0);
assert.equal(countMatches('I fear God.', 'fear'), 1);
assert.equal(countMatches('fear thou not', 'fear not'), 0); // 'thou' breaks it

// --- punctuation is a clause break, not glue (the 1 Peter 2:18 case) -------
assert.equal(countMatches('with all fear; not only to the good', 'fear not'), 0);
assert.equal(countMatches('fear not, for I am with thee', 'fear not'), 1);

// --- CJK phrases ------------------------------------------------------------
assert.equal(countMatches('你不要惧怕', '不要惧怕'), 1);
assert.equal(countMatches('你不要惧怕', '不要怕'), 0);      // 不要惧怕 != 不要怕

// --- verses vs occurrences are different units -----------------------------
const r = run([
  { reference: 'A 1:1', text: 'Fear not, for I am with thee.' },
  { reference: 'A 1:2', text: 'fear not. Fear not!' },
], 'fear not');
assert.equal(r.verses, 2);
assert.equal(r.occurrences, 3);

// --- the published audit trail reproduces the published numbers ------------
const rows = parseCsv(readFileSync(new URL('./data/fear-not-counts.csv', import.meta.url), 'utf8'));
const en = countByRule(rows, 'en');
assert.equal(en['fear not'], 62);
assert.equal(en['be not afraid'], 26);
assert.equal(en['fear thou not'], 4);
assert.equal(en['be not dismayed'], 4);
assert.equal(en['fear not OR be not afraid'], 88);
assert.equal(countByRule(rows, 'zh')['不要怕 OR 不要惧怕 OR 不要害怕 OR 不要恐惧'], 102);

// --- and the tool, run over the WHOLE KJV, agrees with the audit trail -----
// This is the check that caught a false positive (1 Peter 2:18) during build.
const kjv = loadCorpus(new URL('./data/kjv.jsonl.gz', import.meta.url));
assert.equal(kjv.length, 31102);
for (const [phrase, expected] of [['fear not', 62], ['be not afraid', 26], ['fear thou not', 4], ['be not dismayed', 4]]) {
  assert.equal(run(kjv, phrase).verses, expected, `${phrase} over the full KJV`);
}
const cuv = loadCorpus(new URL('./data/cuv-simplified.jsonl.gz', import.meta.url));
for (const [phrase, expected] of [['不要怕', 33], ['不要惧怕', 49], ['不要害怕', 19], ['不要恐惧', 3]]) {
  assert.equal(run(cuv, phrase).verses, expected, `${phrase} over the full CUV`);
}

console.log('ok — tool and audit trail agree over the full KJV (31,102 v) and CUV (31,100 v)');
