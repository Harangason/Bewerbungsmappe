export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function markdown(text) {
  const inline = value => escapeHTML(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  let result = '', paragraph = [], list = null, inCode = false, code = [];
  const flush = () => { if (paragraph.length) { result += `<p>${inline(paragraph.join(' '))}</p>`; paragraph = []; } };
  const endList = () => { if (list) { result += `</${list}>`; list = null; } };
  for (const line of String(text).split(/\r?\n/)) {
    if (/^```/.test(line)) {
      flush(); endList();
      if (inCode) { result += `<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`; code = []; }
      inCode = !inCode; continue;
    }
    if (inCode) { code.push(line); continue; }
    if (!line.trim()) { flush(); endList(); continue; }
    const heading = /^(#{1,6}) (.*)/.exec(line);
    const item = /^\s*(?:([-*])|(\d+)\.)\s+(.*)/.exec(line);
    if (heading) { flush(); endList(); const level = Math.min(heading[1].length + 1, 6); result += `<h${level}>${inline(heading[2])}</h${level}>`; }
    else if (item) { flush(); const kind = item[1] ? 'ul' : 'ol'; if (list !== kind) { endList(); result += `<${kind}>`; list = kind; } result += `<li>${inline(item[3])}</li>`; }
    else if (/^---+$/.test(line)) { flush(); endList(); result += '<hr>'; }
    else { endList(); paragraph.push(line.trim()); }
  }
  flush(); endList();
  if (inCode) result += `<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`;
  return result;
}

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

export function freshState() { return { version: 1, completed: [], days: [], ratings: {}, notes: {}, drafts: {}, quizHistory: [], activity: [], lastLesson: null, focusSessions: 0 }; }
export function restoreState(raw) {
  const result = freshState();
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== 1) return result;
    for (const key of ['completed', 'days', 'activity']) if (Array.isArray(saved[key])) result[key] = [...new Set(saved[key].filter(v => typeof v === 'string'))];
    for (const key of ['notes', 'drafts']) if (saved[key] && typeof saved[key] === 'object' && !Array.isArray(saved[key])) result[key] = Object.fromEntries(Object.entries(saved[key]).filter(([,v]) => typeof v === 'string'));
    if (saved.ratings && typeof saved.ratings === 'object') result.ratings = Object.fromEntries(Object.entries(saved.ratings).filter(([,v]) => ['again', 'ok', 'good'].includes(v)));
    if (Array.isArray(saved.quizHistory)) result.quizHistory = saved.quizHistory.filter(v => Number.isInteger(v.correct) && Number.isInteger(v.total) && v.total > 0 && v.correct >= 0 && v.correct <= v.total && typeof v.date === 'string').slice(-50);
    if (typeof saved.lastLesson === 'string') result.lastLesson = saved.lastLesson;
    if (Number.isInteger(saved.focusSessions) && saved.focusSessions >= 0) result.focusSessions = saved.focusSessions;
  } catch { /* Corrupt browser data does not prevent starting. */ }
  return result;
}
export function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }

export const codingCases = {
  find_duplicates: { args: [[1, 2, 2, 3, 3, 3, 4]], edge: [[], [2, 2, 2], [-1, -1, 0, 0]], result: [2, 3] },
  count_occurrences: { args: [['ai', 'python', 'ai']], edge: [[]], result: { ai: 2, python: 1 } },
  two_sum: { args: [[2, 7, 11, 15], 9], edge: [[[-3, 4, 3, 90], 0], [[3, 3], 6]], result: [0, 1] },
  find_missing_number: { args: [[3, 0, 1]], edge: [[], [0, 1], [1]], result: 2 },
  second_largest: { args: [[5, 1, 5, 3]], edge: [[-5, -1, -3], [5, 5], []], result: 3 },
  remove_duplicates_keep_order: { args: [[3, 1, 3, 2, 1, 4]], edge: [[], ['a', 'b', 'a']], result: [3, 1, 2, 4] },
  three_consecutive_odds: { args: [[2, 1, 3, 5]], edge: [[], [1, 3, 2, 5], [-1, -3, -5]], result: true },
  can_make_recipe: { args: [{ flour: 500, eggs: 4 }, { flour: 300, eggs: 2 }], edge: [[{}, { eggs: 1 }], [{}, {}]], result: true },
  is_anagram: { args: ['triangle', 'integral'], edge: [['', ''], ['AI', 'ai'], ['aab', 'abb']], result: true },
  filter_valid_students: { args: [[{ name: 'Lizi', age: 20 }, { age: 22 }, { name: '' }, { name: 'D' }, { name: 'Eve', age: 26 }]], edge: [[], [{ name: '  A  ' }, { name: '  Ada  ' }, { name: 42 }]], result: [{ name: 'Lizi', age: 20 }, { name: 'Eve', age: 26 }] },
};

const integers = list => Array.isArray(list) && list.every(Number.isSafeInteger);
export function runReference(name, args) {
  if (!Array.isArray(args)) throw new Error('Die Argumente müssen als JSON-Liste angegeben werden.');
  const [a, b] = args;
  const arity = ['two_sum', 'can_make_recipe', 'is_anagram'].includes(name) ? 2 : 1;
  if (args.length !== arity) throw new Error(`Diese Funktion erwartet ${arity} Argument${arity === 1 ? '' : 'e'}.`);
  if (['find_duplicates', 'two_sum', 'find_missing_number', 'second_largest', 'three_consecutive_odds'].includes(name) && !integers(a)) throw new Error('Erwartet wird eine Liste sicher darstellbarer Ganzzahlen.');
  switch (name) {
    case 'find_duplicates': { const seen = new Set(), duplicates = new Set(); a.forEach(n => seen.has(n) ? duplicates.add(n) : seen.add(n)); return [...duplicates]; }
    case 'count_occurrences': {
      if (!Array.isArray(a) || !a.every(v => typeof v === 'string')) throw new Error('Erwartet wird eine Liste von Strings.');
      const counts = Object.create(null); for (const word of a) counts[word] = (counts[word] ?? 0) + 1; return counts;
    }
    case 'two_sum': {
      if (!Number.isSafeInteger(b)) throw new Error('target muss eine Ganzzahl sein.');
      const seen = new Map(); for (let i = 0; i < a.length; i++) { if (seen.has(b - a[i])) return [seen.get(b - a[i]), i]; seen.set(a[i], i); }
      throw new Error('Die Aufgabenannahme ist verletzt: Es gibt keine Lösung.');
    }
    case 'find_missing_number': {
      if (new Set(a).size !== a.length || a.some(n => n < 0 || n > a.length)) throw new Error('Erwartet werden unterschiedliche Zahlen im Bereich 0 bis n mit genau einer fehlenden Zahl.');
      return a.length * (a.length + 1) / 2 - a.reduce((sum, n) => sum + n, 0);
    }
    case 'second_largest': { const sorted = [...new Set(a)].sort((x, y) => y - x); if (sorted.length < 2) throw new Error('ValueError: mindestens zwei unterschiedliche Werte erforderlich.'); return sorted[1]; }
    case 'remove_duplicates_keep_order': {
      if (!Array.isArray(a) || !a.every(v => typeof v === 'string' || Number.isFinite(v))) throw new Error('Erwartet wird eine Liste von Zahlen oder Strings.');
      return [...new Set(a)];
    }
    case 'three_consecutive_odds': { let count = 0; for (const n of a) { count = n % 2 !== 0 ? count + 1 : 0; if (count === 3) return true; } return false; }
    case 'can_make_recipe': {
      const valid = v => v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(x => typeof x === 'number' && Number.isFinite(x) && x >= 0);
      if (!valid(a) || !valid(b)) throw new Error('Erwartet werden zwei Dictionaries mit nichtnegativen Mengen.');
      return Object.entries(b).every(([key, amount]) => (Object.hasOwn(a, key) ? a[key] : 0) >= amount);
    }
    case 'is_anagram': { if (typeof a !== 'string' || typeof b !== 'string') throw new Error('Beide Argumente müssen Strings sein.'); return [...a].sort().join('') === [...b].sort().join(''); }
    case 'filter_valid_students': {
      if (!Array.isArray(a) || !a.every(v => v && typeof v === 'object' && !Array.isArray(v))) throw new Error('Erwartet wird eine Liste von Dictionaries.');
      return a.filter(v => typeof v.name === 'string' && [...v.name.trim()].length > 1);
    }
    default: throw new Error('Unbekannte Aufgabe.');
  }
}

export function equalJSON(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a); return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && equalJSON(a[k], b[k]));
}
