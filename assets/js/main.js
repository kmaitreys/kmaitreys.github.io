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

  // Helper functions for search
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ==========================================
  // 2. Client-Side Instant Search (Cmd+K / /)
  // ==========================================
  let searchIndex = null;
  let selectedIndex = -1;

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
      selectedIndex = -1;
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
      selectedIndex = -1;
    }

    searchTriggers.forEach(btn => btn.addEventListener('click', openSearch));

    function updateSelection() {
      const items = searchResults.querySelectorAll('li a');
      items.forEach((item, index) => {
        if (index === selectedIndex) {
          item.classList.add('selected');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('selected');
        }
      });
    }

    // Shortcut & Keyboard bindings
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchModal.classList.contains('active')) closeSearch();
        else openSearch();
      } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        openSearch();
      } else if (searchModal.classList.contains('active')) {
        const items = searchResults.querySelectorAll('li a');
        if (e.key === 'Escape') {
          closeSearch();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (items.length > 0) {
            selectedIndex = (selectedIndex + 1) % items.length;
            updateSelection();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (items.length > 0) {
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateSelection();
          }
        } else if (e.key === 'Enter' && selectedIndex >= 0 && items[selectedIndex]) {
          e.preventDefault();
          items[selectedIndex].click();
          closeSearch();
        }
      }
    });

    searchModal.addEventListener('click', (e) => {
      if (e.target === searchModal) closeSearch();
    });

    searchInput.addEventListener('input', () => {
      const rawQuery = searchInput.value.trim();
      const query = rawQuery.toLowerCase();
      selectedIndex = -1;

      if (!query || !searchIndex) {
        searchResults.innerHTML = '';
        return;
      }

      const queryTokens = query.split(/\s+/).filter(Boolean);

      const scored = [];
      searchIndex.forEach(item => {
        const titleLower = (item.title || '').toLowerCase();
        const contentLower = (item.content || '').toLowerCase();
        const summaryLower = (item.summary || '').toLowerCase();

        const matchesAll = queryTokens.every(token =>
          titleLower.includes(token) || contentLower.includes(token) || summaryLower.includes(token)
        );

        if (matchesAll) {
          let score = 0;
          if (titleLower.includes(query)) score += 100;
          else if (titleLower.startsWith(queryTokens[0])) score += 50;
          
          if (summaryLower.includes(query)) score += 30;
          if (contentLower.includes(query)) score += 20;

          scored.push({ item, score });
        }
      });

      scored.sort((a, b) => b.score - a.score);
      const matches = scored.map(s => s.item).slice(0, 8);

      if (matches.length === 0) {
        searchResults.innerHTML = '<li style="padding: 1rem 1.25rem; color: var(--text-muted);">No matching posts or pages found.</li>';
        return;
      }

      searchResults.innerHTML = matches.map(item => {
        const titleText = item.title || '';
        let snippetText = item.summary || item.content || '';

        const contentLower = snippetText.toLowerCase();
        let matchIdx = -1;
        for (const token of queryTokens) {
          const idx = contentLower.indexOf(token);
          if (idx !== -1) {
            matchIdx = idx;
            break;
          }
        }

        if (matchIdx !== -1 && snippetText.length > 100) {
          const start = Math.max(0, matchIdx - 35);
          const end = Math.min(snippetText.length, matchIdx + 75);
          let rawSnippet = snippetText.substring(start, end);
          if (start > 0) rawSnippet = '...' + rawSnippet;
          if (end < snippetText.length) rawSnippet = rawSnippet + '...';
          snippetText = rawSnippet;
        } else if (snippetText.length > 120) {
          snippetText = snippetText.substring(0, 120) + '...';
        }

        let highlightedTitle = escapeHtml(titleText);
        let highlightedSnippet = escapeHtml(snippetText);

        queryTokens.forEach(token => {
          if (!token) return;
          const regex = new RegExp(`(${escapeRegExp(token)})`, 'gi');
          highlightedTitle = highlightedTitle.replace(regex, '<mark>$1</mark>');
          highlightedSnippet = highlightedSnippet.replace(regex, '<mark>$1</mark>');
        });

        return `
          <li>
            <a href="${item.permalink}">
              <div class="res-title">${highlightedTitle}</div>
              <div class="res-snippet">${highlightedSnippet}</div>
            </a>
          </li>
        `;
      }).join('');

      if (matches.length > 0) {
        selectedIndex = 0;
        updateSelection();
      }
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
            <video width="100%" controls playsinline preload="metadata">
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

  // ==========================================
  // 7. Image Lightbox / Zoom Modal with Scroll & Pan Zoom
  // ==========================================
  function initImageZoom() {
    const postContent = document.querySelector('.post-content');
    if (!postContent) return;

    let overlay = document.querySelector('.image-zoom-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'image-zoom-overlay';
      overlay.innerHTML = `
        <button class="image-zoom-close" aria-label="Close">&times;</button>
        <div class="image-zoom-container">
          <img class="image-zoom-img" src="" alt="">
          <div class="image-zoom-caption"></div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    const zoomImg = overlay.querySelector('.image-zoom-img');
    const zoomCaption = overlay.querySelector('.image-zoom-caption');
    const closeBtn = overlay.querySelector('.image-zoom-close');

    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    function updateTransform() {
      zoomImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      if (scale > 1) {
        zoomImg.style.cursor = isDragging ? 'grabbing' : 'grab';
      } else {
        zoomImg.style.cursor = 'zoom-out';
      }
    }

    function resetZoom() {
      scale = 1;
      translateX = 0;
      translateY = 0;
      isDragging = false;
      updateTransform();
    }

    function openZoom(src, alt, caption) {
      zoomImg.src = src;
      zoomImg.alt = alt || '';
      zoomCaption.textContent = caption || '';
      zoomCaption.style.display = caption ? 'block' : 'none';
      resetZoom();
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeZoom() {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      resetZoom();
    }

    // Scroll wheel zoom (desktop / trackpad)
    overlay.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newScale = Math.min(Math.max(scale * zoomFactor, 1), 8);

      if (newScale === 1) {
        translateX = 0;
        translateY = 0;
      } else {
        const rect = zoomImg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;
        const scaleRatio = newScale / scale;
        translateX -= mouseX * (scaleRatio - 1);
        translateY -= mouseY * (scaleRatio - 1);
      }

      scale = newScale;
      updateTransform();
    }, { passive: false });

    // Click & Drag / Pan when zoomed in
    zoomImg.addEventListener('mousedown', (e) => {
      if (scale <= 1) return;
      isDragging = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
      zoomImg.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        updateTransform();
      }
    });

    // Double click to toggle 2.5x zoom or reset
    zoomImg.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (scale > 1) {
        resetZoom();
      } else {
        scale = 2.5;
        updateTransform();
      }
    });

    // Mobile touch pinch zoom & pan
    let touchStartDist = 0;
    let initialScale = 1;

    overlay.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialScale = scale;
      } else if (e.touches.length === 1 && scale > 1) {
        isDragging = true;
        startX = e.touches[0].clientX - translateX;
        startY = e.touches[0].clientY - translateY;
      }
    }, { passive: true });

    overlay.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchStartDist > 0) {
          scale = Math.min(Math.max(initialScale * (dist / touchStartDist), 1), 8);
          updateTransform();
        }
      } else if (e.touches.length === 1 && isDragging && scale > 1) {
        translateX = e.touches[0].clientX - startX;
        translateY = e.touches[0].clientY - startY;
        updateTransform();
      }
    }, { passive: true });

    overlay.addEventListener('touchend', () => {
      isDragging = false;
      if (scale <= 1) resetZoom();
    });

    closeBtn.addEventListener('click', closeZoom);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('image-zoom-container')) {
        closeZoom();
      } else if (e.target === zoomImg && scale === 1) {
        closeZoom();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) {
        closeZoom();
      }
    });

    postContent.addEventListener('click', (e) => {
      const img = e.target.closest('img');
      if (!img) return;
      if (img.closest('.no-zoom') || img.classList.contains('no-zoom')) return;

      const figbar = img.closest('.fig-bar');
      const figcaption = figbar ? figbar.querySelector('figcaption') : img.closest('figure')?.querySelector('figcaption');
      const captionText = figcaption ? figcaption.textContent.trim() : (img.alt || '').trim();

      openZoom(img.src, img.alt, captionText);
    });
  }

  // ==========================================
  // 8. Chinese Name Tooltip (Touch / Tap to Peek)
  // ==========================================
  function initChineseNameTooltip() {
    const wrap = document.querySelector('.chinese-name-wrapper');
    if (!wrap) return;

    let hideTimer = null;

    wrap.addEventListener('click', (e) => {
      // Prevent parent <a> tag navigation when tapping specifically on the Chinese name
      e.preventDefault();
      e.stopPropagation();

      const isVisible = wrap.classList.contains('is-visible');
      if (isVisible) {
        wrap.classList.remove('is-visible');
        if (hideTimer) clearTimeout(hideTimer);
      } else {
        wrap.classList.add('is-visible');
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
          wrap.classList.remove('is-visible');
        }, 2500);
      }
    });

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        wrap.classList.remove('is-visible');
        if (hideTimer) clearTimeout(hideTimer);
      }
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
    initImageZoom();
    initChineseNameTooltip();
  });
})();




