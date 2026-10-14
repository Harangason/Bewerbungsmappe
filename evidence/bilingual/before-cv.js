const sections = [...document.querySelectorAll('main section[id]')];
const links = [...document.querySelectorAll('.nav-item')];
const breadcrumb = document.querySelector('#breadcrumb');

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
  breadcrumb.textContent = active?.textContent.trim() || 'Lebenslauf';
}, { rootMargin: '-18% 0px -68% 0px', threshold: [0, 0.15, 0.4] });

sections.forEach(section => observer.observe(section));
