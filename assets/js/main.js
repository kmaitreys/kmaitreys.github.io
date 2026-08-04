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

  // Initialize all features on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSearch();
    initEmailObfuscation();
  });
})();
