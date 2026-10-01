#!/usr/bin/env node
// Reproducible phrase counting for verse-indexed public-domain Bible text.
//
// Two jobs, because a published count needs both:
//   1. count.mjs --file <corpus.json> --phrase "fear not"
//        Count a phrase across a verse-indexed corpus, on WORD BOUNDARIES.
//   2. count.mjs --audit <matched-verses.csv> [--rule "fear not"]
//        Read back a published audit trail (one row per matched verse, with the
//        rule that put it there) and report per-rule counts.
//
// The rule is part of the output, not a footnote — a count you cannot audit is
// a rumor with a decimal point.

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// --- normalisation ---------------------------------------------------------
// Uppercase and collapse whitespace. \p{L}/\p{N} keep non-ASCII letters (CJK)
// intact — a \w class would silently delete every Chinese character.
export function normalize(s) {
  return String(s)
    .toUpperCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- the one rule that matters most ---------------------------------------
// Two failure modes to avoid, and both are silent:
//
//   1. Substrings. A bare "fear" also matches "fearful", "fearfulness" and
//      "God-fearing", inflating a raw count by ~15%. Guard with lookarounds,
//      not \b — \b is ASCII-only, so it never fires around CJK.
//
//   2. Punctuation as glue. "with all fear; not only to the good" is not the
//      phrase "fear not"; the semicolon is a clause break. So words must be
//      separated by whitespace, never by stripped punctuation. (Normalising
//      punctuation away turns this verse into a false positive.)
//
// Apostrophes and hyphens stay inside the guard, so "God-fearing" is one word
// and does not contain "fear".
export function countMatches(text, phrase) {
  const hay = String(text).toUpperCase();
  const p = String(phrase).toUpperCase().trim();
  if (!p) return 0;
  const body = p.split(/\s+/).map(escapeRe).join('[\\s]+');
  const re = new RegExp('(?<![A-Z0-9])' + body + '(?![A-Z0-9])', 'g');
  return (hay.match(re) || []).length;
}

// --- corpus shapes ---------------------------------------------------------
// Accept a bare array of verses, or the published wrapper { verses: { en, zh } }.
export function unwrapCorpus(raw, lang = 'en') {
  if (Array.isArray(raw)) return raw;
  if (raw && raw.verses) {
    if (Array.isArray(raw.verses)) return raw.verses;
    if (raw.verses[lang]) return raw.verses[lang];
  }
  throw new Error('unrecognised corpus: expected an array or { verses: { en, zh } }');
}

// Load a verse-indexed corpus from .json, .jsonl or .jsonl.gz, in canonical
// book order. A full public-domain KJV (31,101 verses) ships in data/.
export function loadCorpus(path) {
  const file = path instanceof URL ? fileURLToPath(path) : String(path);
  const buf = readFileSync(file);
  const text = file.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
  if (file.endsWith('.jsonl') || file.endsWith('.jsonl.gz')) {
    return text.split('\n').filter(Boolean).map(l => JSON.parse(l));
  }
  return unwrapCorpus(JSON.parse(text));
}

export function run(corpus, phrase) {
  const matches = [];
  let occurrences = 0;
  for (const v of corpus) {
    const n = countMatches(v.text || '', phrase);
    if (n > 0) {
      occurrences += n;
      matches.push({ reference: v.reference, count: n });
    }
  }
  return { phrase, verses: matches.length, occurrences, matches };
}

// --- audit trail -----------------------------------------------------------
// Minimal RFC-4180 CSV reader (handles quoted fields containing commas).
export function parseCsv(text) {
  const rows = [];
  let field = '', row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() || [];
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

export function countByRule(rows, lang = 'en') {
  const out = {};
  for (const r of rows) {
    if (lang && r.lang && r.lang !== lang) continue;
    const k = r.rule || '(no rule)';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

// --- CLI -------------------------------------------------------------------
function args(argv) {
  const o = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { o[a.slice(2)] = argv[i + 1]; i++; }
  }
  return o;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const o = args(process.argv);
  if (o.audit) {
    const rows = parseCsv(readFileSync(o.audit, 'utf8'));
    const byRule = countByRule(rows, o.lang || 'en');
    if (o.rule) console.log(`${o.rule}: ${byRule[o.rule] ?? 0} verses`);
    else console.log(JSON.stringify({ rows: rows.length, byRule }, null, 2));
  } else if (o.file && o.phrase) {
    const corpus = loadCorpus(o.file);
    console.log(JSON.stringify(run(corpus, o.phrase), null, 2));
  } else {
    console.error('usage:\n  count.mjs --file <corpus.json> --phrase "<phrase>"\n  count.mjs --audit <matched-verses.csv> [--rule "<rule>"]');
    process.exit(2);
  }
}
