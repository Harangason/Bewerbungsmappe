import { escapeHTML as esc, markdown, shuffle, freshState, restoreState, localDate, codingCases, runReference, equalJSON } from './engine.js';

const $ = selector => document.querySelector(selector);
const main = $('#main');
document.querySelector('a.skip-link').addEventListener('click', event => {
  event.preventDefault(); main.focus(); main.scrollIntoView({ block: 'start' });
});
const STORAGE = 'mockup2-lernstudio-v1';
let data;
let state;
let storageAvailable = true;
try { state = restoreState(localStorage.getItem(STORAGE)); } catch { state = freshState(); storageAvailable = false; }
let libraryFilter = 'all', librarySearch = '', planDay = 1;
let flash = null, activeQuiz = null, interview = null;
let focusEnd = null, focusRemaining = 25 * 60, focusRunning = false;
let toastTimeout;
let backupURL;

const iconPaths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  plan: '<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-12 4h3m3 0h2"/>',
  library: '<path d="M3 5c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Zm9 2v15"/>',
  cards: '<rect x="5" y="3" width="15" height="17" rx="3"/><path d="M5 7H3v13a2 2 0 0 0 2 2h11M9 9h7m-7 4h5"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  coding: '<path d="m7 6-5 6 5 6m10-12 5 6-5 6M14 4l-4 16"/>',
  interview: '<rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
  progress: '<path d="M4 20V10m8 10V4m8 16V7m-18 15h20"/>',
  ai: '<path d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5ZM20 2v4m-2-2h4"/>',
  design: '<rect x="8" y="2" width="8" height="6" rx="1"/><rect x="1" y="16" width="8" height="6" rx="1"/><rect x="15" y="16" width="8" height="6" rx="1"/><path d="M12 8v4m-7 4v-4h14v4"/>',
  hr: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.library}</svg>`;
const categories = {
  ai: { title: 'AI & GenAI', subtitle: 'Verstehe die Ideen hinter den Modellen.', icon: 'ai' },
  coding: { title: 'Python & Coding', subtitle: 'Erst den Ansatz erklären. Dann lösen.', icon: 'coding' },
  design: { title: 'System Design', subtitle: 'Von einer Idee zu einer klaren Architektur.', icon: 'design' },
  hr: { title: 'HR & Vorstellung', subtitle: 'Zeige deinen Weg und deine Stärken.', icon: 'hr' },
};
const nav = [ ['home', 'Übersicht'], ['plan', 'Mein Lernplan'], ['library', 'Lernbibliothek'], ['cards', 'Lernkarten'], ['quiz', 'Wissensquiz'], ['coding', 'Coding-Werkstatt'], ['interview', 'Interview üben'], ['progress', 'Mein Fortschritt'] ];
$('#navigation').innerHTML = nav.map(([id, label]) => `<a class="nav-item" href="#${id}" data-nav="${id}">${icon(id)}<span>${label}</span></a>`).join('');
const badge = category => `<span class="badge ${category}">${esc(categories[category]?.title || 'Unterlagen')}</span>`;
const button = (label, action, cls = 'primary', attrs = '') => `<button class="button ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const intro = (eyebrow, title, description, extra = '') => `<div class="page-intro"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${extra}</div>`;
const getLesson = id => data.lessons.find(l => l.id === id);
const learned = id => state.completed.includes(id);
const categoryLessons = category => data.lessons.filter(l => l.category === category);
const completedCount = list => list.filter(l => learned(l.id)).length;
const percent = (n, total) => total ? Math.round(n / total * 100) : 0;
const shortTitle = title => title.replace(/^Aufgabe \d+: /, '').replace(/^Zusatz-Szenario /, 'Szenario ');
const snippet = body => body.replace(/[#*`]/g, '').replace(/\s+/g, ' ').slice(0, 180);
const track = value => `<div class="progress-track"><div class="progress-fill" style="width:${value}%"></div></div>`;
const clockText = seconds => `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;

function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('visible');
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'), 3600);
}
function save(active = true) {
  if (active && !state.activity.includes(localDate())) state.activity.push(localDate());
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
  catch { storageAvailable = false; toast('Der Browser kann den Fortschritt nicht speichern. Bitte nutze den Export.'); }
}
function toggleComplete(id) {
  state.completed = learned(id) ? state.completed.filter(x => x !== id) : [...state.completed, id];
  save(); toast(learned(id) ? 'Ein weiterer Schritt geschafft. Gut gemacht!' : 'Lektion wieder zum Üben vorgemerkt.'); render();
}
function go(hash) { if (location.hash === `#${hash}`) render(); else location.hash = hash; }

function home() {
  const count = completedCount(data.lessons);
  const latestQuiz = state.quizHistory.at(-1);
  const next = getLesson(state.lastLesson) || data.lessons.find(l => !learned(l.id)) || data.lessons[0];
  const nextDay = data.days.find(d => !state.days.includes(d.id)) || data.days.at(-1);
  const date = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  return intro('WILLKOMMEN IN DEINEM LERNSTUDIO', 'Bereit für deinen nächsten Schritt?', 'Mach es dir gemütlich. Hier wächst dein Wissen fürs GenAI- und Python-Interview.', `<span class="date-pill">${esc(date)}</span>`)
    + `<section class="hero"><div class="hero-copy"><span class="eyebrow">KLEINE SCHRITTE. GROSSE FORTSCHRITTE.</span><h2>Dein Interview beginnt<br>mit einem guten Gefühl.</h2><p>Lernen, ausprobieren und laut erklären.<br>Alles an einem Ort – in deinem Tempo.</p><a class="button primary" href="#lesson/${next.id}">${state.lastLesson ? 'Weiterlernen' : 'Jetzt loslernen'} <span aria-hidden="true">→</span></a></div><div class="hero-art" aria-hidden="true"><svg viewBox="0 0 300 260"><ellipse cx="161" cy="239" rx="111" ry="13" fill="#d6dfc7"/><circle cx="178" cy="107" r="89" fill="#f3f5eb"/><path d="M185 218c-3-42 0-90 31-132" fill="none" stroke="#819772" stroke-width="4"/><path d="M190 171c-33-4-51-24-43-44 28 0 42 18 43 44M193 148c33-1 55-22 47-41-25 2-41 14-47 41M209 105c-26-7-35-24-29-42 24 3 33 19 29 42M214 98c24-1 43-15 36-34-25 0-33 17-36 34" fill="#a4b38e"/><path d="M163 210h61l-9 29h-43Z" fill="#c7b19a"/><rect x="39" y="204" width="120" height="27" rx="5" fill="#b6c3a2"/><rect x="45" y="184" width="112" height="21" rx="4" fill="#d6c3a4"/><path d="m53 192 47-13 46 13v-75c-16-6-31-3-46 3-15-6-32-9-47-3Z" fill="#fffdf2" stroke="#d3d9c3" stroke-width="2"/><path d="M100 120v59m-36-47 25-1m-25 12h25m-25 11 25 2m23-25h23m-23 11h23m-23 11 23-2" stroke="#b2bc9d" stroke-width="2" stroke-linecap="round"/><path d="m65 71 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="#bdab7e"/><circle cx="240" cy="175" r="4" fill="#bdab7e"/></svg></div></section>`
    + `<div class="stats">${stat('library', count, `von ${data.lessons.length} Lektionen gelernt`)}${stat('plan', state.days.length, 'von 15 Lerntagen geschafft')}${stat('quiz', latestQuiz ? `${percent(latestQuiz.correct, latestQuiz.total)}%` : '–', 'Ergebnis im letzten Quiz')}${stat('cards', Object.values(state.ratings).filter(v => v === 'good').length, 'Lernkarten sitzen sicher')}</div>`
    + `<div class="section-heading"><div><h2>Deine Lernwelten</h2><p>Vier Bereiche, ein Ziel: sicher ins Interview.</p></div><a class="text-link" href="#library">Alle Lektionen →</a></div><div class="modules">${Object.entries(categories).map(([id, c]) => {
      const list = categoryLessons(id), done = completedCount(list);
      return `<a class="module-card ${id}" href="#library/${id}"><div class="module-top"><span class="module-icon">${icon(c.icon)}</span><span class="badge">${list.length} Lektionen</span></div><h3>${c.title}</h3><p>${c.subtitle}</p>${track(percent(done, list.length))}<div class="module-foot"><span>${done} / ${list.length} gelernt</span><span>Entdecken ↗</span></div></a>`;
    }).join('')}</div>`
    + `<div class="home-bottom"><section class="panel"><span class="mini-label">DEIN NÄCHSTER LERNTAG</span><h3 style="margin-top:10px">${esc(nextDay.title)}</h3><div class="today-row"><span class="circle-number">1</span><div><strong>Den heutigen Schwerpunkt entdecken</strong><small>Dein Plan gibt dir eine klare Richtung.</small></div></div><div class="today-row"><span class="circle-number">2</span><div><strong>Aktiv üben statt nur lesen</strong><small>Quiz, Karten oder ein Coding-Testfall.</small></div></div><div class="today-row"><span class="circle-number">3</span><div><strong>In eigenen Worten laut erklären</strong><small>Das macht dich sicher für dein Interview.</small></div></div><a class="button ghost" href="#plan/${nextDay.number}">Zum Lernplan <span>→</span></a></section><section class="panel tip-panel"><span class="quote-flower" aria-hidden="true">✳</span><span class="eyebrow">DEIN KLEINER LERNIMPULS</span><h3>Verstehen zeigt sich<br>beim Erklären.</h3><p>Schließe nach einer Lektion kurz die Unterlagen. Kannst du die Idee in 60 Sekunden erklären? Genau das trainierst du hier.</p><a class="button secondary" href="#interview">Eine Interviewfrage üben →</a></section></div>`;
}
function stat(symbol, value, label) { return `<div class="stat"><div class="stat-icon">${icon(symbol)}</div><div><strong>${value}</strong><span>${label}</span></div></div>`; }
function lessonCard(lesson) { return `<a class="lesson-card" href="#lesson/${lesson.id}"><div>${badge(lesson.category)}</div><h3>${esc(shortTitle(lesson.title))}</h3><p>${esc(snippet(lesson.body))}</p><div class="lesson-card-bottom"><span>${lesson.minutes} Min. Lesezeit</span><span class="${learned(lesson.id) ? 'completed-mark' : ''}">${learned(lesson.id) ? '✓ Gelernt' : 'Entdecken →'}</span></div></a>`; }
function filteredLessons() {
  const query = librarySearch.toLocaleLowerCase('de');
  return data.lessons.filter(l => (libraryFilter === 'all' || l.category === libraryFilter || (libraryFilter === 'open' && !learned(l.id))) && `${l.title} ${l.body}`.toLocaleLowerCase('de').includes(query));
}
function library(category) {
  if (categories[category]) libraryFilter = category;
  const lessons = filteredLessons();
  return intro('DEIN WISSEN ZUM ENTDECKEN', 'Die Lernbibliothek', 'Deine Unterlagen, in überschaubare Lektionen aufgeteilt. Wähle, was du heute lernen möchtest.')
    + `<div class="toolbar"><label class="search-wrap">${icon('search')}<input id="lesson-search" type="search" aria-label="Lektionen durchsuchen" placeholder="Thema suchen, z. B. RAG oder two_sum …" value="${esc(librarySearch)}"></label></div><div class="toolbar chips">${[['all','Alle Themen'], ...Object.entries(categories).map(([id,c]) => [id,c.title]), ['open','Noch offen']].map(([id,label]) => `<button class="chip ${libraryFilter === id ? 'selected' : ''}" aria-pressed="${libraryFilter === id}" data-action="filter" data-value="${id}">${label}</button>`).join('')}</div><p class="muted font-small" id="search-count">${lessons.length} Lektionen</p><div class="lesson-grid" id="lesson-grid">${lessons.map(lessonCard).join('') || '<div class="empty">Kein passendes Thema gefunden. Versuche einen anderen Suchbegriff.</div>'}</div><div class="section-heading"><h2>Deine Originalunterlagen</h2></div><div class="source-list">${data.documents.map((d,i) => `<a href="#document/${i}">${icon('library')} ${esc(d.title)} <span class="muted">· ${esc(d.file)}</span></a>`).join('')}</div>`;
}
function lessonPage(id) {
  const lesson = getLesson(id);
  if (!lesson) return missingPage();
  if (state.lastLesson !== id) { state.lastLesson = id; save(false); }
  const list = categoryLessons(lesson.category), index = list.findIndex(l => l.id === id);
  return intro('EIN THEMA. EIN GUTER SCHRITT.', esc(shortTitle(lesson.title)), categories[lesson.category].subtitle)
    + `<div class="lesson-layout"><section class="panel"><div>${badge(lesson.category)} <span class="muted font-small"> · ${lesson.minutes} Min. Lesezeit</span></div><article class="article">${markdown(lesson.body)}</article><div class="source">Quelle: ${esc(lesson.source)} · Originalinhalt aus deinen Unterlagen</div></section><aside class="panel sticky"><h3>Aktiv lernen</h3><p class="muted font-small">Lies die Idee. Schließe kurz die Antwort. Erkläre sie dann in deinen eigenen Worten.</p>${button(learned(id) ? '✓ Als gelernt markiert' : 'Als gelernt markieren', 'complete', learned(id) ? 'secondary' : 'primary', `data-id="${id}"`)}<label class="note-label" for="lesson-note">Meine Notizen & offene Fragen</label><textarea id="lesson-note" data-note="${id}" placeholder="Was ist die Kernidee? Was möchte ich wiederholen?">${esc(state.notes[id] || '')}</textarea><span class="code-status">Wird automatisch in diesem Browser gespeichert.</span><div class="button-row" style="margin-top:18px"><a href="#${lesson.category === 'coding' ? `coding/${id}` : 'cards'}" class="button secondary">${lesson.category === 'coding' ? 'In der Werkstatt üben' : 'Mit Lernkarten üben'}</a><a href="#library/${lesson.category}" class="button ghost">Zur Themenübersicht →</a></div></aside></div><div class="lesson-navigation">${index > 0 ? `<a class="button secondary" href="#lesson/${list[index-1].id}">← Vorherige Lektion</a>` : '<span></span>'}${index < list.length-1 ? `<a class="button primary" href="#lesson/${list[index+1].id}">Nächste Lektion →</a>` : `<a class="button primary" href="#quiz">Wissen testen →</a>`}</div>`;
}
function documentPage(value) {
  const document = data.documents[Number(value)]; if (!document) return missingPage();
  return intro('DEINE ORIGINALQUELLE', esc(document.title), 'Die vollständige Datei aus Mockup 2. Modellnamen, Preise und API-Beispiele sind aus den Unterlagen übernommen und nicht als aktuelle Angaben geprüft.')
    + `<section class="panel"><div class="source-doc-header"><a class="text-link" href="#library">← Zur Lernbibliothek</a><div class="source">${esc(document.file)}</div></div><article class="article">${document.category === 'code' ? `<pre><code>${esc(document.text)}</code></pre>` : markdown(document.text)}</article></section>`;
}
function planPage(value) {
  if (Number(value) >= 1 && Number(value) <= data.days.length) planDay = Number(value);
  const day = data.days[planDay-1];
  return intro('EIN KLARER WEG ZUM INTERVIEW', 'Dein 15-Tage-Lernplan', 'Plane nach deinen Unterlagen 90 bis 120 Minuten pro Tag. Du bestimmst das Tempo – der Plan gibt Orientierung.')
    + `<div class="toolbar"><span class="pill">${state.days.length} von ${data.days.length} Tagen abgeschlossen</span><a class="text-link" href="#document/0">Gesamten Lehrplan lesen →</a></div><div class="plan-layout"><div class="day-list">${data.days.map(d => `<button class="day-button ${planDay === d.number ? 'active' : ''} ${state.days.includes(d.id) ? 'done' : ''}" data-action="day" data-value="${d.number}" aria-pressed="${planDay === d.number}"><span class="circle-number">${state.days.includes(d.id) ? '✓' : d.number}</span><span class="day-text">${esc(d.title.replace(/^Tag \d+: /,''))}<small>Tag ${d.number}${d.number === 15 ? ' · optional' : ''}</small></span></button>`).join('')}</div><section class="panel plan-article"><span class="eyebrow">DEIN SCHWERPUNKT FÜR TAG ${day.number}</span><h2>${esc(day.title.replace(/^Tag \d+: /,''))}</h2><article class="article">${markdown(day.body)}</article><div class="notice">Zum Abschluss: Erkläre mindestens eine Idee laut, ohne die Lösung abzulesen.</div><div class="button-row">${button(state.days.includes(day.id) ? '✓ Lerntag abgeschlossen' : 'Lerntag abschließen', 'day-complete', state.days.includes(day.id) ? 'secondary' : 'primary', `data-id="${day.id}"`)}${day.number < 15 ? `<a class="button secondary" href="#plan/${day.number+1}">Nächster Tag →</a>` : ''}<a class="button ghost" href="#library">Lektionen entdecken →</a></div><label class="note-label" for="day-note">Meine Erkenntnisse heute</label><textarea id="day-note" data-note="${day.id}" placeholder="Was sitzt schon? Was möchte ich morgen noch einmal üben?">${esc(state.notes[day.id] || '')}</textarea></section></div>`;
}

function cardsPage() {
  if (!flash) return intro('ERINNERN STATT NUR LESEN', 'Deine Lernkarten', 'Versuche zuerst selbst zu antworten. Vergleiche dann mit deinen Unterlagen und bewerte deine Sicherheit.')
    + `<section class="practice-card practice-layout"><span class="eyebrow">DEINE NÄCHSTE WIEDERHOLUNG</span><h2>Was möchtest du festigen?</h2><p class="muted">Unsichere Karten kommen zuerst. Deine Bewertung hilft dir, gezielt zu wiederholen.</p><label class="note-label" for="card-category">Themenbereich</label><select id="card-category"><option value="all">Alle Themen</option>${Object.entries(categories).map(([id,c]) => `<option value="${id}">${c.title}</option>`).join('')}</select><label class="note-label" for="card-mode">Welche Karten?</label><select id="card-mode"><option value="all">Alle Karten</option><option value="weak">Noch nicht sicher / noch nicht geübt</option></select><div class="button-row" style="margin-top:25px">${button('Lernkarten starten →','cards-start')}</div></section>`;
  if (flash.index >= flash.deck.length) return intro('EIN SCHRITT WEITER', 'Wiederholung geschafft.', 'Deine Selbsteinschätzungen sind gespeichert. Unsichere Themen kannst du gezielt wiederholen.')
    + `<section class="practice-card practice-layout center"><div class="score-circle"><strong>${flash.deck.length}</strong><span>Karten wiederholt</span></div><h2>Gut investierte Lernzeit.</h2><p class="muted">Erkläre eine der Ideen jetzt noch einmal laut, ganz ohne Hilfe.</p><div class="button-row" style="justify-content:center">${button('Neue Runde', 'cards-reset')}<a class="button secondary" href="#progress">Fortschritt ansehen</a></div></section>`;
  const card = flash.deck[flash.index];
  return intro('ERINNERN STATT NUR LESEN', 'Deine Lernkarten', 'Nimm dir Zeit für deine eigene Erklärung. Es geht um Verständnis.')
    + `<div class="practice-layout"><div class="card-progress"><span>Karte ${flash.index+1} von ${flash.deck.length}</span><button class="text-link" data-action="cards-reset">Runde beenden</button></div>${track(percent(flash.index, flash.deck.length))}<section class="practice-card" style="margin-top:18px">${badge(card.category)}<h2>${esc(shortTitle(card.title))}</h2><p class="muted font-small">Wie würdest du das im Interview erklären?</p>${flash.revealed ? `<div class="answer-panel article">${markdown(card.body)}</div><div class="ratings"><button class="rating again" data-action="card-rate" data-value="again">↻ Noch üben</button><button class="rating ok" data-action="card-rate" data-value="ok">◷ Fast sicher</button><button class="rating good" data-action="card-rate" data-value="good">✓ Sitzt gut</button></div>` : `<div style="margin-top:35px">${button('Antwort aufdecken', 'card-reveal')}</div>`}<div class="source">Quelle: ${esc(card.source)}</div></section></div>`;
}
function quizPage() {
  if (!activeQuiz) return intro('DEIN WISSEN AUSPROBIEREN', 'Ein kleines Wissensquiz', 'Teste dein Verständnis mit Fragen aus deinen Unterlagen. Zu jeder Antwort bekommst du eine Erklärung.')
    + `<section class="practice-card practice-layout"><span class="eyebrow">VERSTEHEN. TESTEN. FESTIGEN.</span><h2>Bereit für eine kleine Runde?</h2><p class="muted">Wähle ein Thema. Bis zu acht zufällig ausgewählte Fragen helfen dir, Lücken zu entdecken.</p><label class="note-label" for="quiz-category">Themenbereich</label><select id="quiz-category"><option value="all">Alle Themen gemischt</option>${Object.entries(categories).map(([id,c]) => { const count=data.quiz.filter(q => q.category === id).length; return `<option value="${id}">${c.title} (${count} ${count === 1 ? 'Frage' : 'Fragen'})</option>`; }).join('')}</select><div class="button-row" style="margin-top:26px">${button('Quiz starten →','quiz-start')}</div><p class="source">${data.quiz.length} Fragen insgesamt · Kein Zeitdruck · Erklärung nach jeder Antwort</p></section>`;
  if (activeQuiz.index >= activeQuiz.questions.length) {
    const wrong = activeQuiz.responses.filter(r => !r.correct);
    const correct = activeQuiz.responses.length - wrong.length;
    return intro('DEIN QUIZ-ERGEBNIS', 'Jede Antwort bringt dich weiter.', wrong.length ? 'Hier findest du die Themen, die sich für eine Wiederholung lohnen.' : 'Alle Fragen richtig beantwortet. Eine gute Grundlage für dein Interview!')
      + `<section class="practice-card practice-layout center"><div class="score-circle"><strong>${percent(correct, activeQuiz.questions.length)}%</strong><span>${correct} von ${activeQuiz.questions.length} richtig</span></div><h2>${wrong.length ? 'Du weißt jetzt, wo du ansetzen kannst.' : 'Das sitzt schon richtig gut.'}</h2><div class="button-row" style="justify-content:center">${button('Noch ein Quiz', 'quiz-reset')}<a class="button secondary" href="#cards">Mit Lernkarten festigen</a></div>${wrong.length ? `<div class="review-list">${wrong.map(r => { const q = activeQuiz.questions.find(q => q.id === r.id); return `<div class="review-item"><strong>${esc(q.question)}</strong><p style="margin:8px 0">Richtig: ${esc(q.options[q.answer])}</p><span class="muted">${esc(q.explanation)}</span><a href="#lesson/${q.lesson}">Passende Lektion wiederholen →</a></div>`; }).join('')}</div>` : ''}</section>`;
  }
  const q = activeQuiz.questions[activeQuiz.index];
  const response = activeQuiz.responses[activeQuiz.index];
  return intro('DEIN WISSEN AUSPROBIEREN', 'Ein kleines Wissensquiz', 'Lies die Frage in Ruhe. Wähle die Antwort, die am besten passt.')
    + `<div class="practice-layout"><div class="card-progress"><span>Frage ${activeQuiz.index+1} von ${activeQuiz.questions.length}</span><button class="text-link" data-action="quiz-reset">Quiz beenden</button></div>${track(percent(activeQuiz.index, activeQuiz.questions.length))}<section class="practice-card" style="margin-top:18px">${badge(q.category)}<h2>${esc(q.question)}</h2><div>${q.options.map((option,i) => `<button class="quiz-option ${response && i === q.answer ? 'correct' : response && response.chosen === i ? 'wrong' : ''}" data-action="quiz-answer" data-value="${i}" ${response ? 'disabled' : ''}><span class="option-letter">${'ABCD'[i]}</span><span>${esc(option)}</span>${response && i === q.answer ? '<span aria-label="Richtige Antwort">✓</span>' : response && response.chosen === i ? '<span aria-label="Falsche Antwort">×</span>' : ''}</button>`).join('')}</div>${response ? `<div class="feedback ${response.correct ? '' : 'wrong'}" role="status"><strong>${response.correct ? '✓ Genau richtig.' : 'Noch ein guter Lernmoment.'}</strong><br>${esc(q.explanation)}<a class="text-link" href="#lesson/${q.lesson}" style="display:block;margin-top:9px">In der Lektion nachlesen →</a></div>${button(activeQuiz.index === activeQuiz.questions.length-1 ? 'Ergebnis ansehen →' : 'Nächste Frage →', 'quiz-next')}` : ''}</section></div>`;
}

function codingPage(id) {
  const list = categoryLessons('coding').filter(l => /^Aufgabe \d+:/.test(l.title));
  const lesson = list.find(l => l.id === id) || list[0];
  const name = /Aufgabe \d+: (\w+)/.exec(lesson.title)?.[1];
  const fn = data.functions[name];
  const cases = codingCases[name];
  const prompt = lesson.body.split('**Textlösung:**')[0];
  return intro('ERST DENKEN. DANN CODEN.', 'Deine Coding-Werkstatt', 'Erkläre deinen Ansatz, schreibe einen Entwurf und trainiere Beispiele und Randfälle.')
    + `<div class="toolbar"><label class="font-small" for="coding-select">Aufgabe</label><select id="coding-select">${list.map(l => `<option value="${l.id}" ${l.id === lesson.id ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}</select><span class="pill">Python · 10 Aufgaben</span></div><div class="coding-layout"><section class="panel"><span class="eyebrow">DEINE AUFGABE</span><h2 style="font-size:24px">${esc(name)}</h2><article class="article">${markdown(prompt)}</article><div class="notice">Deine Routine: Aufgabe → Randbedingungen → Ansatz → Code → Testfälle.</div><label class="note-label" for="coding-note">Mein Ansatz in eigenen Worten</label><textarea id="coding-note" data-note="approach-${lesson.id}" placeholder="Welche Datenstruktur hilft? Welche Randfälle sollte ich prüfen?">${esc(state.notes[`approach-${lesson.id}`] || '')}</textarea><details><summary>Hinweis & Textlösung aufdecken</summary><div class="article">${markdown(lesson.body.slice(lesson.body.indexOf('**Textlösung:**')))}</div></details><div class="button-row" style="margin-top:19px">${button(learned(lesson.id) ? '✓ Aufgabe gelernt' : 'Als gelernt markieren', 'complete', 'secondary', `data-id="${lesson.id}"`)}</div><div class="source">Quelle: ${esc(lesson.source)}</div></section><div><section class="panel code-panel"><div class="code-toolbar">mein_entwurf.py <span id="draft-status">Lokal gespeichert</span></div><label class="skip-link" for="code-editor">Mein Python-Codeentwurf</label><textarea id="code-editor" class="code-editor" data-draft="${lesson.id}" spellcheck="false" aria-label="Mein Python-Codeentwurf">${esc(state.drafts[lesson.id] || `${fn.signature}\n    # Schreibe hier deinen eigenen Ansatz.\n    pass\n`)}</textarea><div class="code-bottom"><p>Codeentwurf: wird gespeichert, aber hier nicht als Python ausgeführt. Lade ihn herunter und führe ihn in PyCharm aus.</p><div class="button-row">${button('Entwurf herunterladen', 'download-code', 'secondary', `data-id="${lesson.id}" data-name="${name}"`)}</div></div></section><details><summary>Python-Musterlösung vergleichen</summary><div class="article"><pre><code>${esc(fn.code)}</code></pre></div><div class="source">Quelle: coding_aufgaben_loesungen.py</div></details><section class="panel simulator"><span class="eyebrow">TESTFÄLLE AKTIV VERSTEHEN</span><h3>Was kommt heraus?</h3><p class="muted font-small">Sage das Ergebnis voraus. Der Trainer vergleicht mit einer Umsetzung der Referenzlogik im Browser.</p><label class="note-label" for="case-input">Funktionsargumente als JSON-Liste</label><textarea id="case-input" spellcheck="false">${esc(JSON.stringify(cases.args))}</textarea><label class="note-label" for="prediction">Deine erwartete Ausgabe (JSON)</label><textarea id="prediction" spellcheck="false" placeholder="z. B. [2,3], true, 2 oder ein Dictionary"></textarea><div class="button-row" style="margin:14px 0">${button('Vorhersage prüfen', 'predict', 'primary', `data-name="${name}"`)}${button('Referenzergebnis zeigen', 'reference', 'secondary', `data-name="${name}"`)}</div><div id="case-result" aria-live="polite"></div><div class="notice">Auch leere Eingaben, Duplikate und ungültige Fälle ausprobieren. JSON nutzt true / false statt True / False.</div></section></div></div>`;
}

function interviewPage() {
  if (!interview) return intro('SICHERER WERDEN DURCH SPRECHEN', 'Deine kleine Generalprobe', 'Antworte laut, halte deinen Ansatz in Notizen fest und vergleiche danach mit deinen Unterlagen.')
    + `<section class="practice-card practice-layout"><span class="eyebrow">DEIN PERSÖNLICHER ÜBUNGSRAUM</span><h2>Üben, als wäre es das Interview.</h2><p class="muted">Bis zu sechs Fragen, passend zu deinem Themenbereich. Der Timer gibt Orientierung. Die Bewertung übernimmst du selbst.</p><label class="note-label" for="interview-category">Themenbereich</label><select id="interview-category"><option value="all">Gemischtes Mock Interview</option>${Object.entries(categories).map(([id,c]) => `<option value="${id}">${c.title}</option>`).join('')}</select><div class="notice">Pro Frage: 2 Min. für AI / HR, 5 Min. für Design, 10 Min. für Coding. Keine Aufnahme und keine automatische KI-Bewertung.</div>${button('Generalprobe starten →', 'interview-start')}</section>`;
  if (interview.index >= interview.questions.length) return intro('DEINE GENERALPROBE IST GESCHAFFT', 'Ein bisschen mehr Sicherheit.', 'Deine Notizen sind gespeichert. Wiederhole als Nächstes die Themen, die noch unsicher waren.')
    + `<section class="practice-card practice-layout center"><div class="score-circle"><strong>${interview.questions.length}</strong><span>Fragen geübt</span></div><h2>Du hast dir Zeit zum Erklären genommen.</h2><p class="muted">Das ist eine gute Vorbereitung. Deine Selbstbewertung findest du im Fortschritt.</p><div class="button-row" style="justify-content:center">${button('Neue Generalprobe', 'interview-reset')}<a class="button secondary" href="#progress">Mein Fortschritt</a></div></section>`;
  const q = interview.questions[interview.index];
  return intro('DEINE KLEINE GENERALPROBE', 'Du bist dran.', 'Erkläre deine Antwort laut. Nutze Notizen, um deinen roten Faden festzuhalten.')
    + `<div class="practice-layout"><div class="card-progress"><span>Frage ${interview.index+1} von ${interview.questions.length}</span><button class="text-link" data-action="interview-reset">Generalprobe beenden</button></div>${track(percent(interview.index, interview.questions.length))}<section class="practice-card" style="margin-top:18px"><div class="interview-meta">${badge(q.category)}<span class="interview-clock" id="interview-clock" role="timer">${clockText(interview.remaining)}</span></div><h2>${esc(shortTitle(q.title))}</h2><div class="button-row">${button(interview.running ? 'Timer pausieren' : 'Antwortzeit starten', 'interview-timer', 'secondary')}</div><label class="note-label" for="interview-note">Mein roter Faden</label><textarea id="interview-note" data-note="interview-${q.id}" placeholder="Kernidee, Beispiel, Grenzen …">${esc(state.notes[`interview-${q.id}`] || '')}</textarea>${interview.revealed ? `<details open><summary>Mit den Unterlagen vergleichen</summary><article class="article">${markdown(q.body)}</article></details><div class="interview-checks"><label><input type="checkbox"> Ich habe die Frage klar beantwortet.</label><label><input type="checkbox"> Ich habe ein konkretes Beispiel genannt.</label><label><input type="checkbox"> Ich habe Randbedingungen oder Risiken erklärt.</label></div><p class="font-small muted">Wie sicher war deine Antwort?</p><div class="ratings"><button class="rating again" data-action="interview-rate" data-value="again">Noch üben →</button><button class="rating ok" data-action="interview-rate" data-value="ok">Fast sicher →</button><button class="rating good" data-action="interview-rate" data-value="good">Sitzt gut →</button></div>` : `<div style="margin-top:23px">${button('Antwort vergleichen', 'interview-reveal')}</div>`}</section></div>`;
}
function setInterviewTime() {
  const q = interview.questions[interview.index];
  interview.remaining = q?.category === 'coding' ? 600 : q?.category === 'design' ? 300 : 120;
  interview.running = false; interview.end = null; interview.revealed = false;
}

function progressPage() {
  const complete = completedCount(data.lessons), best = state.quizHistory.length ? Math.max(...state.quizHistory.map(q => percent(q.correct, q.total))) : null;
  const weak = data.lessons.filter(l => state.ratings[l.id] === 'again');
  const days = Array.from({length:14},(_,i) => { const date = new Date(); date.setDate(date.getDate()-13+i); return { date: localDate(date), label: date.toLocaleDateString('de-DE',{day:'numeric',month:'numeric'}) }; });
  return intro('DEIN WISSEN WÄCHST', 'Sieh, was du schon geschafft hast.', 'Lernstatus und Karten sind deine Selbsteinschätzung. Quiz-Ergebnisse zeigen deine Antworten auf konkrete Wissensfragen.')
    + `<div class="stats">${stat('library', `${percent(complete,data.lessons.length)}%`, 'der Lektionen gelernt')}${stat('cards', Object.values(state.ratings).filter(v => v === 'good').length, 'Themen selbst als sicher bewertet')}${stat('quiz', best === null ? '–' : `${best}%`, 'dein bestes Quiz-Ergebnis')}${stat('clock', state.focusSessions, 'abgeschlossene Fokusmomente')}</div><div class="progress-layout"><section class="panel"><h3>Deine vier Lernwelten</h3>${Object.entries(categories).map(([id,c]) => { const list = categoryLessons(id), done = completedCount(list); return `<div class="bar-row"><a class="text-link" href="#library/${id}" style="text-align:left">${c.title}</a>${track(percent(done,list.length))}<span class="muted">${done}/${list.length}</span></div>`; }).join('')}<div class="section-heading"><h3>Lernen in den letzten 14 Tagen</h3></div><div class="activity-grid">${days.map(d => `<div class="activity-day"><span class="activity-square ${state.activity.includes(d.date) ? 'active' : ''}" title="${d.date}: ${state.activity.includes(d.date) ? 'Lernaktivität gespeichert' : 'keine Lernaktivität gespeichert'}"></span><span>${d.label}</span></div>`).join('')}</div><p class="muted font-small">Ein grünes Feld bedeutet: An diesem Tag hast du geübt, etwas markiert oder Notizen gespeichert.</p><div class="section-heading"><h3>Diese Themen brauchen noch Übung</h3></div>${weak.length ? `<div class="source-list">${weak.map(l => `<a href="#lesson/${l.id}">↻ ${esc(shortTitle(l.title))}</a>`).join('')}</div>` : '<p class="muted font-small">Noch keine Themen als unsicher markiert. Bewerte deine Antworten bei den Lernkarten oder im Interviewtraining.</p>'}</section><div><section class="panel"><h3>Deine Quiz-Runden</h3>${state.quizHistory.length ? `<table class="quiz-history"><thead><tr><th>DATUM</th><th>THEMA</th><th>ERGEBNIS</th></tr></thead><tbody>${[...state.quizHistory].reverse().slice(0,10).map(q => `<tr><td>${esc(new Date(q.date).toLocaleDateString('de-DE'))}</td><td>${esc(categories[q.category]?.title || 'Gemischt')}</td><td>${q.correct}/${q.total} · ${percent(q.correct,q.total)}%</td></tr>`).join('')}</tbody></table>` : '<p class="muted font-small">Dein erstes Quiz wartet auf dich. Ergebnisse erscheinen nach einer vollständigen Runde.</p><a class="button primary" href="#quiz">Quiz starten →</a>'}</section><section class="panel" style="margin-top:20px"><h3>Dein Fortschritt gehört dir.</h3><p class="muted font-small">Notizen, Codeentwürfe und Ergebnisse liegen in diesem Browser. Sichere sie als JSON-Datei oder stelle eine Sicherung wieder her.</p>${!storageAvailable ? '<div class="notice warning">Browser-Speicher nicht verfügbar. Bitte Fortschritt exportieren.</div>' : ''}<div class="button-row">${button('Fortschritt exportieren', 'export', 'secondary')}${button('Sicherung importieren', 'import', 'secondary')}</div><input type="file" id="import-file" accept="application/json,.json" hidden><button class="text-link" style="margin-top:20px;color:#aa7966" data-action="reset">Fortschritt zurücksetzen</button></section></div></div>`;
}
function missingPage() { return intro('DAS THEMA GIBT ES HIER NICHT', 'Zurück in deinen Lernraum.', 'Wähle eine Lektion in deiner Bibliothek.') + '<a class="button primary" href="#library">Zur Lernbibliothek</a>'; }
function render() {
  if (!data) return;
  const [page = 'home', arg] = (location.hash.slice(1) || 'home').split('/');
  const navPage = ['lesson','document'].includes(page) ? 'library' : page;
  document.querySelectorAll('[data-nav]').forEach(a => { a.classList.toggle('active',a.dataset.nav === navPage); if (a.dataset.nav === navPage) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  $('#breadcrumb').textContent = nav.find(([id]) => id === navPage)?.[1] || 'Dein Lernraum';
  const pages = { home, library: () => library(arg), lesson: () => lessonPage(arg), document: () => documentPage(arg), plan: () => planPage(arg), cards: cardsPage, quiz: quizPage, coding: () => codingPage(arg), interview: interviewPage, progress: progressPage };
  main.innerHTML = (pages[page] || missingPage)();
  document.title = `${nav.find(([id]) => id === navPage)?.[1] || 'Lernen'} · Lernstudio`;
}

function download(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content],{type}));
  const a = document.createElement('a'); a.href=url; a.download=name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),60000);
}

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) document.getElementById(close.dataset.close).close();
  const target = event.target.closest('[data-action]'); if (!target || !data) return;
  const {action, id, value, name} = target.dataset;
  if (action === 'complete') toggleComplete(id);
  else if (action === 'filter') { libraryFilter = value; if (location.hash !== '#library') go('library'); else render(); }
  else if (action === 'day') go(`plan/${value}`);
  else if (action === 'day-complete') { state.days = state.days.includes(id) ? state.days.filter(x => x !== id) : [...state.days,id]; save(); render(); toast(state.days.includes(id) ? 'Dein Lerntag ist geschafft.' : 'Lerntag wieder geöffnet.'); }
  else if (action === 'cards-start') {
    const category = $('#card-category').value, mode = $('#card-mode').value;
    let deck = shuffle(data.lessons.filter(l => (category === 'all' || l.category === category) && (mode !== 'weak' || state.ratings[l.id] !== 'good')));
    if (!deck.length) { toast('Alle Themen in dieser Auswahl sitzen schon sicher. Wähle alle Karten.'); return; }
    deck.sort((a,b) => (state.ratings[a.id] === 'again' ? -1 : 0) - (state.ratings[b.id] === 'again' ? -1 : 0));
    flash = { deck, index:0, revealed:false }; render();
  }
  else if (action === 'card-reveal') { flash.revealed = true; render(); }
  else if (action === 'card-rate') { state.ratings[flash.deck[flash.index].id] = value; flash.index++; flash.revealed=false; save(); render(); main.focus({preventScroll:true}); }
  else if (action === 'cards-reset') { flash=null; render(); }
  else if (action === 'quiz-start') {
    const category = $('#quiz-category').value;
    activeQuiz = { category, questions:shuffle(data.quiz.filter(q => category === 'all' || q.category === category)).slice(0,8), index:0, responses:[], saved:false }; render();
  }
  else if (action === 'quiz-answer' && !activeQuiz.responses[activeQuiz.index]) { const q = activeQuiz.questions[activeQuiz.index]; activeQuiz.responses.push({id:q.id, chosen:Number(value), correct:q.answer === Number(value)}); save(); render(); }
  else if (action === 'quiz-next') {
    activeQuiz.index++;
    if (activeQuiz.index === activeQuiz.questions.length && !activeQuiz.saved) {
      state.quizHistory.push({date:new Date().toISOString(), category:activeQuiz.category, correct:activeQuiz.responses.filter(r => r.correct).length,total:activeQuiz.questions.length});
      state.quizHistory=state.quizHistory.slice(-50); activeQuiz.saved=true; save();
    }
    render(); main.focus({preventScroll:true});
  }
  else if (action === 'quiz-reset') { activeQuiz=null; render(); }
  else if (action === 'download-code') download(`${name}_entwurf.py`,state.drafts[id] || $('#code-editor').value,'text/x-python');
  else if (['predict','reference'].includes(action)) {
    const result = $('#case-result');
    try {
      const args = JSON.parse($('#case-input').value), output = runReference(name,args);
      if (action === 'predict') {
        const prediction = JSON.parse($('#prediction').value);
        result.innerHTML = `<div class="feedback ${equalJSON(prediction,output) ? '' : 'wrong'}"><strong>${equalJSON(prediction,output) ? '✓ Deine Vorhersage stimmt.' : 'Die Referenz liefert ein anderes Ergebnis.'}</strong><br>Referenzergebnis:</div><div class="result-output">${esc(JSON.stringify(output,null,2))}</div>`;
      } else result.innerHTML = `<div class="result-output">${esc(JSON.stringify(output,null,2))}</div>`;
      save();
    } catch(error) { result.innerHTML = `<div class="notice warning">${error instanceof SyntaxError ? 'Bitte gültiges JSON eingeben. Für die Vorhersage wird auch eine erwartete Ausgabe benötigt.' : esc(error.message)}</div>`; }
  }
  else if (action === 'interview-start') {
    const category = $('#interview-category').value;
    let candidates = data.lessons.filter(l => category === 'all' || l.category === category);
    if (category === 'all') {
      const selected = Object.keys(categories).map(c => shuffle(categoryLessons(c))[0]);
      candidates = [...selected,...shuffle(candidates.filter(l => !selected.includes(l))).slice(0,2)];
    } else candidates = shuffle(candidates).slice(0,6);
    interview={ questions:candidates,index:0 }; setInterviewTime(); render();
  }
  else if (action === 'interview-timer') {
    if (interview.running) { interview.remaining=Math.max(0,Math.ceil((interview.end-Date.now())/1000)); interview.running=false; }
    else if (interview.remaining > 0) { interview.end=Date.now()+interview.remaining*1000; interview.running=true; }
    render();
  }
  else if (action === 'interview-reveal') { interview.revealed=true; interview.running=false; render(); }
  else if (action === 'interview-rate') { state.ratings[interview.questions[interview.index].id]=value; interview.index++; setInterviewTime(); save(); render(); main.focus({preventScroll:true}); }
  else if (action === 'interview-reset') { interview=null; render(); }
  else if (action === 'export') {
    const content=JSON.stringify(state,null,2);
    if (backupURL) URL.revokeObjectURL(backupURL);
    backupURL=URL.createObjectURL(new Blob([content],{type:'application/json'}));
    $('#backup-download').href=backupURL;
    $('#backup-download').download=`lernstudio-fortschritt-${localDate()}.json`;
    $('#backup-content').value=content;
    $('#backup-dialog').showModal();
  }
  else if (action === 'import') $('#import-file').click();
  else if (action === 'reset') $('#reset-dialog').showModal();
});

document.addEventListener('input',event => {
  const element = event.target;
  if (element.id === 'lesson-search') {
    librarySearch=element.value; const list=filteredLessons(); $('#lesson-grid').innerHTML=list.map(lessonCard).join('') || '<div class="empty">Kein passendes Thema gefunden.</div>'; $('#search-count').textContent=`${list.length} Lektionen`;
  } else if (element.dataset.note) { state.notes[element.dataset.note]=element.value; save(); }
  else if (element.dataset.draft) { state.drafts[element.dataset.draft]=element.value; save(); $('#draft-status').textContent=storageAvailable ? 'Lokal gespeichert' : 'Nur im Arbeitsspeicher'; }
});
document.addEventListener('keydown',event => {
  if (event.target.id === 'code-editor' && event.key === 'Tab') {
    event.preventDefault(); const editor=event.target; editor.setRangeText('    ',editor.selectionStart,editor.selectionEnd,'end'); editor.dispatchEvent(new Event('input',{bubbles:true}));
  }
});
document.addEventListener('change', async event => {
  if (event.target.id === 'coding-select') go(`coding/${event.target.value}`);
  if (event.target.id === 'import-file' && event.target.files[0]) {
    const file=event.target.files[0];
    if (file.size > 2_000_000) { toast('Die Sicherungsdatei ist zu groß (maximal 2 MB).'); return; }
    try {
      const raw=await file.text(), parsed=JSON.parse(raw);
      if (parsed.version !== 1 || !Array.isArray(parsed.completed) || !parsed.notes || !parsed.drafts || !Array.isArray(parsed.quizHistory)) throw new Error('invalid');
      const imported=restoreState(raw);
      state.completed=[...new Set([...state.completed,...imported.completed])]; state.days=[...new Set([...state.days,...imported.days])]; state.activity=[...new Set([...state.activity,...imported.activity])];
      state.notes={...state.notes,...imported.notes}; state.drafts={...state.drafts,...imported.drafts}; state.ratings={...state.ratings,...imported.ratings};
      state.quizHistory=[...new Map([...state.quizHistory,...imported.quizHistory].map(q => [JSON.stringify(q),q])).values()].sort((a,b) => a.date.localeCompare(b.date)).slice(-50);
      state.focusSessions=Math.max(state.focusSessions,imported.focusSessions); save(false); render(); toast('Deine Sicherung wurde mit dem aktuellen Fortschritt zusammengeführt.');
    } catch { toast('Diese Datei ist keine gültige Lernstudio-Sicherung.'); }
  }
});
$('#confirm-reset').addEventListener('click',() => { state=freshState(); save(false); flash=null; activeQuiz=null; interview=null; $('#reset-dialog').close(); render(); toast('Du kannst mit einem frischen Lernraum beginnen.'); });
$('#focus-button').addEventListener('click',() => $('#focus-dialog').showModal());
$('#focus-toggle').addEventListener('click',() => {
  if (focusRunning) { focusRemaining=Math.max(0,Math.ceil((focusEnd-Date.now())/1000)); focusRunning=false; }
  else { if (focusRemaining === 0) focusRemaining=1500; focusEnd=Date.now()+focusRemaining*1000; focusRunning=true; }
  updateFocus();
});
$('#focus-reset').addEventListener('click',() => { focusRemaining=1500; focusRunning=false; updateFocus(); });
function updateFocus() {
  $('#focus-clock').textContent=clockText(focusRemaining); $('#focus-toggle').textContent=focusRunning ? 'Pausieren' : focusRemaining === 0 ? 'Neuer Fokusmoment' : 'Fokus starten'; $('#focus-label').textContent=focusRunning ? `${clockText(focusRemaining)} Fokus` : '25 Min. Fokus';
}
setInterval(() => {
  if (focusRunning) {
    focusRemaining=Math.max(0,Math.ceil((focusEnd-Date.now())/1000));
    if (focusRemaining === 0) { focusRunning=false; state.focusSessions++; save(); toast('Dein Fokusmoment ist geschafft. Zeit für eine Pause!'); }
    updateFocus();
  }
  if (interview?.running) {
    interview.remaining=Math.max(0,Math.ceil((interview.end-Date.now())/1000));
    if ($('#interview-clock')) { $('#interview-clock').textContent=clockText(interview.remaining); $('#interview-clock').classList.toggle('expired',interview.remaining === 0); }
    if (interview.remaining === 0) { interview.running=false; toast('Die Antwortzeit ist vorbei. Vergleiche jetzt mit den Unterlagen.'); if (location.hash.startsWith('#interview')) render(); }
  }
},1000);
window.addEventListener('hashchange',() => { render(); window.scrollTo({top:0,behavior:'instant'}); main.focus({preventScroll:true}); });

try {
  const response=await fetch('/api/content'); if (!response.ok) throw new Error(`HTTP ${response.status}`);
  data=await response.json(); render();
  if (!storageAvailable) toast('Browser-Speicher nicht verfügbar. Sichere deinen Fortschritt über den Export.');
} catch(error) {
  main.innerHTML=`<section class="loading-error"><h1>Die Lerninhalte konnten nicht geladen werden.</h1><p>Bitte prüfe, ob der lokale Server läuft und die Originaldateien im Ordner Mockup 2 vorhanden sind.</p><p>${esc(error.message)}</p><a class="button secondary" href="/">Erneut laden</a></section>`;
}
