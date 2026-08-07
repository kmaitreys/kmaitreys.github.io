/**
 * Main JavaScript Engine for S. Maitrey Personal Website
 * Handles: Theme switching (Dark/Light mode), client-side search (Cmd+K), and email obfuscation.
 */

(function () {
  'use strict';

  // ==========================================
  // 1. Theme Switcher (Dark / Light Mode)
  // ==========================================
  function initTheme() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      document.documentElement.classList.add('theme-' + savedTheme);
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('theme-dark') || 
                       (!document.documentElement.classList.contains('theme-light') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        if (isDark) {
          document.documentElement.classList.remove('theme-dark');
          document.documentElement.classList.add('theme-light');
          localStorage.setItem('theme', 'light');
        } else {
          document.documentElement.classList.remove('theme-light');
          document.documentElement.classList.add('theme-dark');
          localStorage.setItem('theme', 'dark');
        }
      });
    }
  }

  // ==========================================
  // 2. Client-Side Instant Search (Cmd+K / /)
  // ==========================================
  let searchIndex = null;

  function initSearch() {
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const searchTriggers = document.querySelectorAll('.search-trigger');

    if (!searchModal || !searchInput || !searchResults) return;

    function openSearch() {
      searchModal.classList.add('active');
      searchInput.value = '';
      searchResults.innerHTML = '';
      setTimeout(() => searchInput.focus(), 50);

      if (!searchIndex) {
        fetch('/index.json')
          .then(res => res.json())
          .then(data => {
            searchIndex = data;
          })
          .catch(err => console.error('Failed to load search index', err));
      }
    }

    function closeSearch() {
      searchModal.classList.remove('active');
    }

    searchTriggers.forEach(btn => btn.addEventListener('click', openSearch));

    // Shortcut bindings
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchModal.classList.contains('active')) closeSearch();
        else openSearch();
      } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        openSearch();
      } else if (e.key === 'Escape' && searchModal.classList.contains('active')) {
        closeSearch();
      }
    });

    searchModal.addEventListener('click', (e) => {
      if (e.target === searchModal) closeSearch();
    });

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim().toLowerCase();
      if (!query || !searchIndex) {
        searchResults.innerHTML = '';
        return;
      }

      const matches = searchIndex.filter(item => {
        const inTitle = item.title && item.title.toLowerCase().includes(query);
        const inContent = item.content && item.content.toLowerCase().includes(query);
        const inSummary = item.summary && item.summary.toLowerCase().includes(query);
        return inTitle || inContent || inSummary;
      }).slice(0, 8);

      if (matches.length === 0) {
        searchResults.innerHTML = '<li style="padding: 1rem 1.25rem; color: var(--text-muted);">No matching posts or pages found.</li>';
        return;
      }

      searchResults.innerHTML = matches.map(item => `
        <li>
          <a href="${item.permalink}">
            <div class="res-title">${item.title}</div>
            <div class="res-snippet">${item.summary || (item.content ? item.content.substring(0, 100) + '...' : '')}</div>
          </a>
        </li>
      `).join('');
    });
  }

  // ==========================================
  // 3. Email Obfuscation Decoder (Anti-Scraper)
  // ==========================================
  function initEmailObfuscation() {
    document.querySelectorAll('.email-obfuscated').forEach(el => {
      if (el.dataset.user && el.dataset.domain) {
        const email = el.dataset.user + '@' + el.dataset.domain;
        el.href = 'mailto:' + email;
        el.textContent = email;
      }
    });
  }

  // ==========================================
  // 4. Interactive Footnote Details Tag Transform
  // ==========================================
  function initFootnotes() {
    const footnotesContainer = document.querySelector('.footnotes');
    if (!footnotesContainer) return;

    const footnoteItems = footnotesContainer.querySelectorAll('li[id^="fn:"]');
    if (!footnoteItems.length) return;

    const footnoteMap = {};
    footnoteItems.forEach(item => {
      const fnId = item.id.replace(/^fn:/, '');
      const clone = item.cloneNode(true);

      // Remove backref links (e.g. ↩)
      const backlinks = clone.querySelectorAll('.footnote-backref, a[href^="#fnref:"]');
      backlinks.forEach(el => el.remove());

      let html = clone.innerHTML.trim();
      // Remove outer <p> tag wrapper if it's a single paragraph
      html = html.replace(/^<p>(.*?)<\/p>$/is, '$1');
      footnoteMap[fnId] = html;
    });

    const isDesktop = window.innerWidth >= 900;
    const fnRefs = document.querySelectorAll('sup[id^="fnref:"]');

    fnRefs.forEach(sup => {
      const fnId = sup.id.replace(/^fnref:/, '');
      const content = footnoteMap[fnId];

      if (content) {
        const details = document.createElement('details');
        details.className = 'footnote-details';
        if (isDesktop) {
          details.setAttribute('open', '');
        }

        const summary = document.createElement('summary');
        summary.className = 'footnote-summary';
        summary.setAttribute('title', 'Toggle footnote');
        summary.setAttribute('aria-label', `Footnote ${fnId}`);
        summary.innerHTML = `<sup class="footnote-ref-num">${fnId}</sup>`;

        const body = document.createElement('span');
        body.className = 'footnote-body';
        body.innerHTML = `<sup class="footnote-num">${fnId}</sup> ${content}`;

        details.appendChild(summary);
        details.appendChild(body);

        sup.parentNode.replaceChild(details, sup);
      }
    });

    footnotesContainer.style.display = 'none';
  }

  // ==========================================
  // 5. Right Side Footnotes Layout & Stacking
  // ==========================================
  function adjustMarginElements() {
    const container = document.querySelector('.post-content');
    if (!container) return;

    if (window.innerWidth < 900) {
      // Reset inline top styles on mobile/tablet
      const fnBodies = container.querySelectorAll('.footnote-body');
      fnBodies.forEach(el => { el.style.top = ''; });
      return;
    }

    const containerRect = container.getBoundingClientRect();

    // Right Margin Footnotes (.footnote-body inside details)
    const rightElements = [];
    container.querySelectorAll('details.footnote-details > .footnote-body').forEach(el => {
      rightElements.push(el);
    });

    rightElements.forEach(el => { el.style.top = ''; });
    rightElements.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    let prevRightBottom = 0;
    const gap = 14; // Vertical gap in px

    rightElements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const naturalTop = rect.top - containerRect.top;
      const height = rect.height;

      let actualTop = naturalTop;
      if (actualTop < prevRightBottom) {
        actualTop = prevRightBottom;
      }

      el.style.top = actualTop + 'px';
      prevRightBottom = actualTop + height + gap;
    });
  }

  function initMarginLayout() {
    adjustMarginElements();

    window.addEventListener('load', adjustMarginElements);
    window.addEventListener('resize', adjustMarginElements);

    // Re-adjust layout on <details> toggle
    document.addEventListener('toggle', (e) => {
      if (e.target && e.target.classList.contains('footnote-details')) {
        adjustMarginElements();
      }
    }, true);
  }

  // ==========================================
  // 6. Auto-transform Images & Videos to Styled Figure Containers (.fig-bar)
  // ==========================================
  function initFigBars() {
    const postContent = document.querySelector('.post-content');
    if (!postContent) return;

    // 1. Convert standard markdown <img> elements to <figure class="fig-bar">
    const images = Array.from(postContent.querySelectorAll('img')).filter(img => {
      return !img.closest('.badge') &&
             !img.closest('.fig-bar') &&
             !img.classList.contains('no-fig-bar');
    });

    images.forEach((img, idx) => {
      const figNum = idx + 1;
      const figure = img.closest('figure');
      const figcaption = figure ? figure.querySelector('figcaption') : null;
      const captionText = figcaption ? figcaption.textContent.trim() : (img.alt || '').trim();
      const src = img.src;

      const figBar = document.createElement('figure');
      figBar.className = 'fig-bar';
      figBar.innerHTML = `
        <div class="fig-bar-content">
          <div class="fig-bar-media">
            <img src="${src}" alt="${captionText}">
            ${captionText ? `<figcaption>${captionText}</figcaption>` : ''}
          </div>
        </div>
      `;

      const targetElement = figure || img;
      targetElement.parentNode.replaceChild(figBar, targetElement);
    });

    // 2. Convert standard <video> elements to <figure class="fig-bar vid-bar">
    const videos = Array.from(postContent.querySelectorAll('video')).filter(vid => {
      return !vid.closest('.fig-bar');
    });

    videos.forEach((vid) => {
      const source = vid.querySelector('source');
      const src = vid.src || (source ? source.src : '');
      if (!src) return;

      const figure = vid.closest('figure');
      const figcaption = figure ? figure.querySelector('figcaption') : null;
      const captionText = figcaption ? figcaption.textContent.trim() : (vid.getAttribute('data-caption') || vid.getAttribute('title') || '').trim();

      const figBar = document.createElement('figure');
      figBar.className = 'fig-bar vid-bar';
      figBar.innerHTML = `
        <div class="fig-bar-content">
          <div class="fig-bar-media">
            <video width="100%" controls preload="metadata">
              <source src="${src}">
            </video>
            ${captionText ? `<figcaption>${captionText}</figcaption>` : ''}
          </div>
        </div>
      `;

      const targetElement = figure || vid;
      targetElement.parentNode.replaceChild(figBar, targetElement);
    });
  }

  // Initialize all features on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSearch();
    initEmailObfuscation();
    initFootnotes();
    initMarginLayout();
    initFigBars();
  });
})();




