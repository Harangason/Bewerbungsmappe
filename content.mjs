import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const definitions = [
  ['LEHRPLAN.md', 'Dein Lernplan', 'plan'],
  ['HR_VORBEREITUNG.md', 'HR & Selbstvorstellung', 'hr'],
  ['AI_KONZEPTE_ANTWORTEN.md', 'AI & GenAI', 'ai'],
  ['SYSTEM_DESIGN_SZENERIEN.md', 'System Design', 'design'],
  ['CODING_TEXTLOESUNGEN.md', 'Python & Coding', 'coding'],
  ['coding_aufgaben_loesungen.py', 'Python-Musterlösungen', 'code'],
  ['TEXT', 'Originaler Interviewauftrag', 'original'],
];

export function splitSections(text, level = 2) {
  const pattern = new RegExp(`^#{${level}} (.+)$`, 'gm');
  const matches = [...text.matchAll(pattern)];
  return matches.map((match, i) => ({
    title: match[1].trim(),
    body: text.slice(match.index + match[0].length, matches[i + 1]?.index ?? text.length).trim(),
  }));
}

export async function loadContent() {
  const documents = await Promise.all(definitions.map(async ([file, title, category]) => ({
    file, title, category, text: await readFile(path.join(sourceRoot, file), 'utf8'),
  })));
  const lessons = documents.filter(d => ['hr', 'ai', 'design', 'coding'].includes(d.category))
    .flatMap(d => splitSections(d.text).map((section, index) => ({
      id: `${d.category}-${index}`, category: d.category, source: d.file, ...section,
      minutes: Math.max(3, Math.min(15, Math.ceil(section.body.length / 700))),
    })));
  const days = splitSections(documents.find(d => d.category === 'plan').text, 3)
    .filter(s => /^Tag \d+:/.test(s.title))
    .map((s, i) => ({ id: `day-${i + 1}`, number: i + 1, ...s }));
  const python = documents.find(d => d.category === 'code').text;
  const functions = Object.fromEntries([...python.matchAll(/^def (\w+)\(([^\n]*)\):[\s\S]*?(?=^def |^if __name__|$(?![\s\S]))/gm)]
    .map(match => [match[1], { signature: `def ${match[1]}(${match[2]}):`, code: match[0].trim() }]));
  return { documents, lessons, days, functions };
}
