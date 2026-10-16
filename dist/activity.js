(() => {
  if (window.location.origin !== 'https://application-martin-drexler.vercel.app') return;
  try {
    if (localStorage.getItem('portfolio-activity-exclude') === 'true') return;
  } catch { /* Tracking does not require browser storage. */ }
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;

  const sections = new Set(['profil', 'kompetenzen', 'berufserfahrung', 'ausbildung', 'kenntnisse']);
  function section() {
    if (/^\/motivation\/?$/.test(location.pathname) || location.hash === '#motivation') return 'motivation';
    const hash = location.hash.slice(1);
    return sections.has(hash) ? hash : 'start';
  }
  function send(type, target) {
    // Only fixed event labels leave the browser, never link URLs or page queries.
    const body = JSON.stringify({ type, target, section: section(), language: document.documentElement.lang === 'en' ? 'en' : 'de' });
    fetch('/api/activity', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      credentials: 'omit', keepalive: true,
    }).catch(() => { /* Analytics must never interrupt the portfolio. */ });
  }
  let previous;
  function view() {
    const current = section();
    if (current !== previous) { previous = current; send('pageview', 'view'); }
  }
  view();
  window.addEventListener('hashchange', view);
  document.addEventListener('click', event => {
    const element = event.target.closest?.('a, button');
    if (!element) return;
    if (element.matches('[data-language]')) { send('language', element.dataset.language); return; }
    if (element.matches('#print-button, [data-print-page]')) { send('print', 'pdf'); return; }
    if (element.matches('[data-workflow-step]')) { send('workflow', element.dataset.workflowStep); return; }
    if (element.tagName !== 'A') return;
    const url = new URL(element.href, location.href);
    if (url.protocol === 'mailto:') send('contact', 'email');
    else if (url.protocol === 'tel:') send('contact', 'phone');
    else if (url.hostname === 'www.linkedin.com' || url.hostname === 'linkedin.com') send('contact', 'linkedin');
    else if (url.hostname === 'portfolio-martin-drexler.vercel.app') {
      const project = /^\/projects\/([1245])\/?$/.exec(url.pathname);
      send('portfolio', project ? `project-${project[1]}` : 'portfolio');
    }
  });
})();
