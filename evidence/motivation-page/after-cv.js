const sections = [...document.querySelectorAll('main section[id]')];
const links = [...document.querySelectorAll('.nav-item')];
const breadcrumb = document.querySelector('#breadcrumb');
const coverHashes = new Set(['', '#start', '#cover-main']);

function showCurrentView() {
  const motivationVisible = /^\/motivation\/?$/.test(window.location.pathname) || window.location.hash === '#motivation';
  const coverVisible = !motivationVisible && coverHashes.has(window.location.hash);
  const changed = document.body.classList.contains('cover-view') !== coverVisible
    || document.body.classList.contains('motivation-view') !== motivationVisible;
  document.body.classList.toggle('cover-view', coverVisible);
  document.body.classList.toggle('motivation-view', motivationVisible);
  document.querySelector('.skip-link').setAttribute('href', coverVisible ? '#cover-main' : motivationVisible ? '#motivation-main' : '#main');
  updateDocumentTitle();
  if (changed) {
    if (coverVisible || motivationVisible) window.scrollTo({ top: 0, behavior: 'instant' });
    else document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }
}

showCurrentView();
window.addEventListener('hashchange', showCurrentView);
const languageButtons = [...document.querySelectorAll('[data-language]')];
const textTranslations = [...document.querySelectorAll('[data-en]')].map(element => ({
  element, de: element.textContent, en: element.dataset.en,
}));
const attributeTranslations = ['aria-label', 'content'].flatMap(attribute =>
  [...document.querySelectorAll(`[data-en-${attribute}]`)].map(element => ({
    element, attribute, de: element.getAttribute(attribute),
    en: element.getAttribute(`data-en-${attribute}`),
  }))
);
let currentLanguage = 'de';

function updateDocumentTitle() {
  const english = document.documentElement.lang === 'en';
  const motivation = document.body.classList.contains('motivation-view');
  document.title = `Martin Drexler · ${motivation ? (english ? 'My Motivation' : 'Meine Motivation') : (english ? 'E/E Systems Architect' : 'E/E-Systemarchitekt')}`;
}

function updateBreadcrumb() {
  const active = links.find(link => link.classList.contains('active'));
  breadcrumb.textContent = active?.textContent.trim() || (currentLanguage === 'en' ? 'CV' : 'Lebenslauf');
}

function setLanguage(language, remember = false) {
  currentLanguage = language === 'en' ? 'en' : 'de';
  document.documentElement.lang = currentLanguage;
  textTranslations.forEach(translation => {
    translation.element.textContent = translation[currentLanguage];
  });
  attributeTranslations.forEach(translation => {
    translation.element.setAttribute(translation.attribute, translation[currentLanguage]);
  });
  languageButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === currentLanguage));
  });
  document.querySelectorAll('[data-local-page]').forEach(link => {
    const url = new URL(link.dataset.localPage, window.location.origin);
    url.searchParams.set('lang', currentLanguage);
    link.setAttribute('href', `${url.pathname}${url.search}${url.hash}`);
  });
  updateDocumentTitle();
  updateBreadcrumb();
  if (remember) {
    try { localStorage.setItem('portfolio-language', currentLanguage); } catch { /* Optional preference storage. */ }
    const url = new URL(window.location.href);
    url.searchParams.set('lang', currentLanguage);
    window.history.replaceState(null, '', url);
  }
}

const requestedLanguage = new URL(window.location.href).searchParams.get('lang');
let savedLanguage;
try { savedLanguage = localStorage.getItem('portfolio-language'); } catch { /* German remains the default. */ }
setLanguage(['de', 'en'].includes(requestedLanguage) ? requestedLanguage : savedLanguage);
languageButtons.forEach(button => {
  button.addEventListener('click', () => setLanguage(button.dataset.language, true));
});

document.querySelectorAll('#print-button, [data-print-page]').forEach(button => {
  button.addEventListener('click', () => window.print());
});

const workflowButtons = [...document.querySelectorAll('[data-workflow-step]')];
const workflowPanels = [...document.querySelectorAll('.workflow-panel')];
workflowButtons.forEach(button => {
  button.addEventListener('click', () => {
    workflowButtons.forEach(candidate => candidate.setAttribute('aria-pressed', String(candidate === button)));
    workflowPanels.forEach(panel => { panel.hidden = panel.id !== button.getAttribute('aria-controls'); });
  });
});

const observer = new IntersectionObserver(entries => {
  const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  const active = links.find(link => link.hash === `#${visible.target.id}`);
  links.forEach(link => {
    const selected = link === active;
    link.classList.toggle('active', selected);
    if (selected) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  updateBreadcrumb();
}, { rootMargin: '-18% 0px -68% 0px', threshold: [0, 0.15, 0.4] });

sections.forEach(section => observer.observe(section));
