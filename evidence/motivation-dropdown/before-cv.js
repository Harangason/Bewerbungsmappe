const sections = [...document.querySelectorAll('main section[id]')];
const links = [...document.querySelectorAll('.nav-item')];
const breadcrumb = document.querySelector('#breadcrumb');
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

document.querySelector('#print-button').addEventListener('click', () => window.print());

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
