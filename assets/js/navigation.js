/* Keep the live header/canvases while navigating between Hugo HTML pages. */
(() => {
  'use strict';
  if (!window.fetch || !window.DOMParser || !history.pushState) return;

  const positions = new Map();
  let sequence = 0, pending = null;
  let currentKey = history.state?.sitePageKey || makeKey();
  function makeKey() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  history.replaceState({ ...history.state, sitePageKey: currentKey }, '', location.href);
  history.scrollRestoration = 'manual';
  function rememberScroll() {
    positions.set(currentKey, { left: window.scrollX, top: window.scrollY });
  }
  window.addEventListener('scroll', rememberScroll, { passive: true });

  function restorePosition(url, position) {
    if (position) {
      window.scrollTo({ ...position, behavior: 'instant' });
    } else if (url.hash) {
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch { id = url.hash.slice(1); }
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'instant' });
      else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
    // Refresh the portrait's scroll fade immediately, including navigation
    // from an article where it had already faded out.
    window.dispatchEvent(new Event('scroll'));
  }

  async function navigate(url, { traverse = false, key, position } = {}) {
    rememberScroll();
    if (pending) pending.abort();
    const controller = new AbortController();
    pending = controller;
    const request = ++sequence;
    try {
      const response = await fetch(url.href, { signal: controller.signal, headers: { Accept: 'text/html' } });
      if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html')) throw new Error('Non-HTML destination');
      const destination = new URL(response.url || url.href);
      destination.hash = url.hash;
      if (destination.origin !== location.origin) throw new Error('External redirect');
      const next = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (request !== sequence) return;
      const nextMain = next.querySelector('main');
      const main = document.querySelector('main');
      const nextNav = next.querySelector('.main-nav');
      // Script-bearing destinations retain ordinary browser navigation so
      // their scripts execute normally. Current site content needs no scripts.
      if (!nextMain || !main || !nextNav || nextMain.querySelector('script')) throw new Error('Full navigation required');

      document.dispatchEvent(new Event('site:before-navigation'));
      main.replaceChildren(...nextMain.childNodes);
      document.querySelector('.main-nav').replaceChildren(...nextNav.childNodes);
      const oldBar = document.getElementById('sticky-page-title-bar');
      const nextBar = next.getElementById('sticky-page-title-bar');
      if (oldBar) oldBar.remove();
      if (nextBar) document.querySelector('.header-inner').append(nextBar);
      document.title = next.title;
      const description = document.querySelector('meta[name="description"]');
      const nextDescription = next.querySelector('meta[name="description"]');
      if (description && nextDescription) description.content = nextDescription.content;
      document.querySelector('#search-modal')?.classList.remove('active');
      document.querySelector('.image-zoom-overlay')?.classList.remove('active');
      document.body.style.overflow = '';

      currentKey = key || makeKey();
      const state = { ...(traverse ? history.state : {}), sitePageKey: currentKey };
      if (traverse) history.replaceState(state, '', destination.href);
      else history.pushState(state, '', destination.href);
      document.dispatchEvent(new Event('site:page-ready'));
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: true });
      restorePosition(destination, position);
      // Images without explicit dimensions can move an anchor or restored
      // scroll position; correct it once they settle unless the reader scrolls.
      const settledAt = window.scrollY;
      const images = Array.from(main.querySelectorAll('img')).filter(image => !image.complete && image.loading !== 'lazy');
      if (images.length) {
        await Promise.all(images.map(image => new Promise(resolve => {
          image.addEventListener('load', resolve, { once: true, signal: controller.signal });
          image.addEventListener('error', resolve, { once: true, signal: controller.signal });
        })));
        if (request === sequence && Math.abs(window.scrollY - settledAt) < 2 && (position || destination.hash)) restorePosition(destination, position);
      }
    } catch (error) {
      if (controller.signal.aborted || request !== sequence) return;
      if (traverse) location.replace(url.href);
      else location.assign(url.href);
    } finally {
      if (request === sequence) pending = null;
    }
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self') || link.hasAttribute('data-full-navigation')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
    if (url.pathname === location.pathname && url.search === location.search) {
      if (!url.hash) {
        event.preventDefault();
        restorePosition(url);
      }
      return;
    }
    if (!url.pathname.endsWith('/') && !url.pathname.endsWith('.html')) return;
    event.preventDefault();
    navigate(url);
  });
  window.addEventListener('popstate', event => {
    const key = event.state?.sitePageKey;
    navigate(new URL(location.href), { traverse: true, key, position: positions.get(key) });
  });
})();
