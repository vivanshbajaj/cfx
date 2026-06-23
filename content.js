(function () {
  'use strict';

  var STORAGE_KEYS = {
    darkMode: 'cfb_darkMode',
    zenMode: 'cfb_zenMode',
    timer: 'cfb_timer',
    timerPos: 'cfb_timer_pos',
    bookmarks: 'cfb_bookmarks'
  };

  var settings = {
    darkMode: true,
    zenMode: false,
    timer: true
  };

  var timerInterval = null;
  var timerSeconds = 0;
  var timerRunning = false;
  var problemKey = 'cfb_timer_' + window.location.pathname;
  var currentUserHandle = null;

  function init() {
    chrome.storage.sync.get(null, function(stored) {
      settings.darkMode = stored[STORAGE_KEYS.darkMode] !== false;
      settings.zenMode  = stored[STORAGE_KEYS.zenMode] === true;
      settings.timer    = stored[STORAGE_KEYS.timer]    !== false;

      detectHandle();
      applyAllFeatures();
      injectDashboardButton();
    });

    chrome.storage.onChanged.addListener(function(changes) {
      for (var key in changes) {
        var newValue = changes[key].newValue;
        if (key === STORAGE_KEYS.darkMode) { settings.darkMode = newValue; applyDarkMode(); }
        if (key === STORAGE_KEYS.zenMode)  { settings.zenMode = newValue;  applyZenMode(); }
        if (key === STORAGE_KEYS.timer)    { settings.timer = newValue;    applyTimer(); }
      }
    });
  }

  function applyAllFeatures() {
    applyDarkMode();
    applyZenMode();
    applyTimer();
    applyBookmarkButton();
    fadeSolvedProblems();
  }

  function detectHandle() {
    var profileLink = document.querySelector('#header a[href^="/profile/"]');
    if (profileLink && profileLink.textContent.trim() !== 'Register') {
      currentUserHandle = profileLink.textContent.trim();
    }
  }

  function fadeSolvedProblems() {
    if (!currentUserHandle || !document.querySelector('table.problems')) return;
    var cacheKey = 'cfx_solved_' + currentUserHandle;
    var cached = sessionStorage.getItem(cacheKey);

    if (cached) {
      applyFade(new Set(JSON.parse(cached)));
    } else {
      fetch('https://codeforces.com/api/user.status?handle=' + currentUserHandle)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.status !== 'OK') return;
          var ids = [];
          data.result.forEach(function(sub) {
            if (sub.verdict === 'OK') {
              ids.push(String(sub.problem.contestId) + sub.problem.index);
            }
          });
          sessionStorage.setItem(cacheKey, JSON.stringify(ids));
          applyFade(new Set(ids));
        })
        .catch(function() {});
    }
  }

  function applyFade(solvedIds) {
    document.querySelectorAll('table.problems tr').forEach(function(row) {
      var idCell = row.querySelector('td.id a');
      if (idCell && solvedIds.has(idCell.textContent.trim())) {
        row.style.opacity = '0.35';
        row.style.background = 'rgba(0, 0, 0, 0.2)';
      }
    });
  }

  var darkStyleEl = null;
  function applyDarkMode() {
    if (settings.darkMode) {
      if (!darkStyleEl) {
        fetch(chrome.runtime.getURL('darkmode.css'))
          .then(function(res) { return res.text(); })
          .then(function(css) {
            darkStyleEl = document.createElement('style');
            darkStyleEl.id = 'cfb-dark-style';
            darkStyleEl.textContent = css;
            document.head.appendChild(darkStyleEl);
          })
          .catch(function(e) { console.error('[CFx]', e); });
      } else { darkStyleEl.disabled = false; }
    } else {
      if (darkStyleEl) darkStyleEl.disabled = true;
    }
  }

  function applyZenMode() {
    if (settings.zenMode) {
      document.body.classList.add('cfb-zen-mode');
    } else {
      document.body.classList.remove('cfb-zen-mode');
    }
  }

  var isProblemPage = /\/problem\//.test(window.location.pathname);

  function applyTimer() {
    var existing = document.getElementById('cfb-timer');
    if (!settings.timer) {
      if (existing) existing.remove();
      clearInterval(timerInterval);
      timerRunning = false;
      return;
    }
    if (!isProblemPage || existing) return;

    var saved = localStorage.getItem(problemKey);
    timerSeconds = saved ? parseInt(saved, 10) : 0;

    var widget = document.createElement('div');
    widget.id = 'cfb-timer';
    widget.innerHTML =
      '<div id="cfb-timer-header">' +
        '<span id="cfb-timer-label">' + String.fromCodePoint(9889) + ' CFx Timer</span>' +
        '<button id="cfb-timer-collapse" title="Minimize">' + String.fromCharCode(8722) + '</button>' +
      '</div>' +
      '<div id="cfb-timer-display">' + formatTime(timerSeconds) + '</div>' +
      '<div id="cfb-timer-controls">' +
        '<button class="cfb-timer-btn" id="cfb-timer-start">' + String.fromCharCode(9654) + ' Start</button>' +
        '<button class="cfb-timer-btn" id="cfb-timer-stop">' + String.fromCharCode(9208) + ' Pause</button>' +
        '<button class="cfb-timer-btn" id="cfb-timer-reset">' + String.fromCharCode(8634) + '</button>' +
      '</div>';

    var pos = localStorage.getItem(STORAGE_KEYS.timerPos);
    if (pos) {
      var coords = JSON.parse(pos);
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';
      widget.style.left = coords.x + 'px';
      widget.style.top = coords.y + 'px';
    }

    document.body.appendChild(widget);

    var header = document.getElementById('cfb-timer-header');
    var isDragging = false;
    var startX, startY, startLeft, startTop;

    header.addEventListener('mousedown', function(e) {
      if (e.target.id === 'cfb-timer-collapse') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      var rect = widget.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      widget.classList.add('cfb-dragging');
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';
      widget.style.left = startLeft + 'px';
      widget.style.top = startTop + 'px';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      widget.style.left = (startLeft + dx) + 'px';
      widget.style.top = (startTop + dy) + 'px';
    });

    document.addEventListener('mouseup', function(e) {
      if (!isDragging) return;
      isDragging = false;
      widget.classList.remove('cfb-dragging');
      var rect = widget.getBoundingClientRect();
      localStorage.setItem(STORAGE_KEYS.timerPos, JSON.stringify({ x: rect.left, y: rect.top }));
    });

    var display = document.getElementById('cfb-timer-display');
    var minimized = false;

    document.getElementById('cfb-timer-start').addEventListener('click', function() {
      if (timerRunning) return;
      timerRunning = true;
      display.classList.add('cfb-timer-running');
      timerInterval = setInterval(function() {
        timerSeconds++;
        display.textContent = formatTime(timerSeconds);
        localStorage.setItem(problemKey, timerSeconds);
      }, 1000);
    });

    document.getElementById('cfb-timer-stop').addEventListener('click', function() {
      if (!timerRunning) return;
      timerRunning = false;
      display.classList.remove('cfb-timer-running');
      clearInterval(timerInterval);
    });

    document.getElementById('cfb-timer-reset').addEventListener('click', function() {
      clearInterval(timerInterval);
      timerRunning = false;
      timerSeconds = 0;
      display.textContent = formatTime(0);
      display.classList.remove('cfb-timer-running');
      localStorage.removeItem(problemKey);
    });

    document.getElementById('cfb-timer-collapse').addEventListener('click', function() {
      minimized = !minimized;
      widget.classList.toggle('cfb-minimized', minimized);
      document.getElementById('cfb-timer-collapse').textContent = minimized ? '+' : String.fromCharCode(8722);
    });
  }

  function formatTime(secs) {
    var h = Math.floor(secs / 3600);
    var m = Math.floor((secs % 3600) / 60);
    var s = secs % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  function applyBookmarkButton() {
    if (!isProblemPage || document.getElementById('cfb-bookmark-btn')) return;
    var titleEl = document.querySelector('.problem-statement .title');
    if (!titleEl) return;

    var btn = document.createElement('button');
    btn.id = 'cfb-bookmark-btn';
    var problemName = titleEl.textContent.trim();
    var problemUrl = window.location.href.split('?')[0];

    chrome.storage.sync.get(STORAGE_KEYS.bookmarks, function(data) {
      var b = data[STORAGE_KEYS.bookmarks] || [];
      updateBtnState(btn, b.some(function(x) { return x.url === problemUrl; }));
    });

    btn.addEventListener('click', function() {
      chrome.storage.sync.get(STORAGE_KEYS.bookmarks, function(data) {
        var b = data[STORAGE_KEYS.bookmarks] || [];
        var idx = b.findIndex(function(x) { return x.url === problemUrl; });
        if (idx === -1) {
          b.push({ name: problemName, url: problemUrl });
          showToast('Bookmarked!');
        } else {
          b.splice(idx, 1);
          showToast('Removed bookmark');
        }
        var obj = {};
        obj[STORAGE_KEYS.bookmarks] = b;
        chrome.storage.sync.set(obj);
        updateBtnState(btn, idx === -1);
      });
    });

    var headerSection = document.querySelector('.problem-statement .header');
    if (headerSection) headerSection.appendChild(btn);
  }

  function updateBtnState(btn, saved) {
    btn.classList.toggle('cfb-bookmarked', saved);
    btn.textContent = saved ? 'Bookmarked' : 'Bookmark';
  }

  function showToast(msg) {
    var existing = document.getElementById('cfb-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'cfb-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.animation = 'cfb-toast-out 0.3s forwards';
      setTimeout(function() { toast.remove(); }, 300);
    }, 2000);
  }

  function injectDashboardButton() {
    var langChooser = document.querySelector('.lang-chooser');
    if (!langChooser || document.getElementById('cfx-nav-btn')) return;

    var btn = document.createElement('a');
    btn.id = 'cfx-nav-btn';
    btn.href = '#';
    btn.textContent = String.fromCodePoint(9889) + ' CFx Settings';
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      openDashboard();
    });

    langChooser.insertBefore(btn, langChooser.firstChild);
    createDashboardModal();
  }

  function createDashboardModal() {
    var overlay = document.createElement('div');
    overlay.id = 'cfx-dashboard-overlay';

    var togglesHTML =
      renderToggle('darkMode', 'Dark Theme', 'A clean, dark UI for Codeforces') +
      renderToggle('zenMode', 'Zen Mode', 'Hide sidebars, nav, and footer for deep focus') +
      renderToggle('timer', 'Problem Timer', 'Floating stopwatch for practice');

    overlay.innerHTML =
      '<div id="cfx-dashboard">' +
        '<div class="cfx-dash-header">' +
          '<div class="cfx-dash-title">' + String.fromCodePoint(9889) + ' CFx Dashboard</div>' +
          '<button class="cfx-dash-close">X</button>' +
        '</div>' +
        '<div class="cfx-dash-tabs">' +
          '<button class="cfx-dash-tab active" data-target="cfx-tab-settings">Settings</button>' +
          '<button class="cfx-dash-tab" data-target="cfx-tab-practice">Practice</button>' +
          '<button class="cfx-dash-tab" data-target="cfx-tab-bookmarks">Bookmarks</button>' +
          '<button class="cfx-dash-tab" data-target="cfx-tab-contests">Contests</button>' +
        '</div>' +
        '<div class="cfx-dash-content">' +
          '<div class="cfx-dash-panel active" id="cfx-tab-settings">' + togglesHTML + '</div>' +
          '<div class="cfx-dash-panel" id="cfx-tab-practice"><div id="cfx-practice-container">Loading recommendations...</div></div>' +
          '<div class="cfx-dash-panel" id="cfx-tab-bookmarks"><div id="cfx-bookmarks-container">Loading...</div></div>' +
          '<div class="cfx-dash-panel" id="cfx-tab-contests">' +
            '<div id="cfx-contest-filters">' +
              '<button class="cfx-filter-btn cfx-filter-active" data-platform="all">All</button>' +
              '<button class="cfx-filter-btn" data-platform="codeforces">CF</button>' +
              '<button class="cfx-filter-btn" data-platform="codechef">CC</button>' +
              '<button class="cfx-filter-btn" data-platform="atcoder">AC</button>' +
              '<button class="cfx-filter-btn" data-platform="leetcode">LC</button>' +
            '</div>' +
            '<div id="cfx-contests-container"><div class="cfx-loading">Loading contests...</div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.cfx-dash-close').addEventListener('click', function() {
      overlay.classList.remove('cfx-open');
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('cfx-open');
    });

    var tabs = overlay.querySelectorAll('.cfx-dash-tab');
    var panels = overlay.querySelectorAll('.cfx-dash-panel');
    tabs.forEach(function(t) {
      t.addEventListener('click', function() {
        tabs.forEach(function(x) { x.classList.remove('active'); });
        panels.forEach(function(x) { x.classList.remove('active'); });
        t.classList.add('active');
        document.getElementById(t.dataset.target).classList.add('active');
        if (t.dataset.target === 'cfx-tab-practice') loadRecommendations();
        if (t.dataset.target === 'cfx-tab-bookmarks') loadBookmarks();
        if (t.dataset.target === 'cfx-tab-contests') loadContests();
      });
    });

    Object.keys(settings).forEach(function(k) {
      var inp = overlay.querySelector('#cfx-toggle-' + k);
      if (inp) {
        inp.checked = settings[k];
        inp.addEventListener('change', function(e) {
          var obj = {};
          obj[STORAGE_KEYS[k]] = e.target.checked;
          chrome.storage.sync.set(obj);
        });
      }
    });

    var filterBtns = overlay.querySelectorAll('.cfx-filter-btn');
    filterBtns.forEach(function(fb) {
      fb.addEventListener('click', function() {
        filterBtns.forEach(function(x) { x.classList.remove('cfx-filter-active'); });
        fb.classList.add('cfx-filter-active');
        filterContests(fb.dataset.platform);
      });
    });
  }

  function renderToggle(id, label, desc) {
    return '<div class="cfx-setting-row">' +
      '<div class="cfx-setting-info">' +
        '<strong>' + label + '</strong>' +
        '<span>' + desc + '</span>' +
      '</div>' +
      '<label class="cfx-toggle">' +
        '<input type="checkbox" id="cfx-toggle-' + id + '">' +
        '<div class="cfx-toggle-slider"></div>' +
      '</label>' +
    '</div>';
  }

  function openDashboard() {
    document.getElementById('cfx-dashboard-overlay').classList.add('cfx-open');
  }

  function loadBookmarks() {
    var container = document.getElementById('cfx-bookmarks-container');
    chrome.storage.sync.get(STORAGE_KEYS.bookmarks, function(data) {
      var b = data[STORAGE_KEYS.bookmarks] || [];
      if (b.length === 0) {
        container.innerHTML = '<div class="cfx-empty">No bookmarks saved yet.</div>';
        return;
      }
      var html = '';
      b.forEach(function(item, i) {
        html += '<div class="cfx-bookmark-item">' +
          '<a href="' + escapeHtml(item.url) + '">' + escapeHtml(item.name) + '</a>' +
          '<button class="cfx-bookmark-del" data-index="' + i + '">X</button>' +
        '</div>';
      });
      container.innerHTML = html;

      container.querySelectorAll('.cfx-bookmark-del').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          var idx = parseInt(e.currentTarget.dataset.index, 10);
          b.splice(idx, 1);
          var obj = {};
          obj[STORAGE_KEYS.bookmarks] = b;
          chrome.storage.sync.set(obj, loadBookmarks);
        });
      });
    });
  }

  function loadRecommendations() {
    var container = document.getElementById('cfx-practice-container');
    if (!currentUserHandle) {
      container.innerHTML = '<div class="cfx-empty">Please log in to Codeforces to get recommendations.</div>';
      return;
    }

    var today = new Date().toDateString();
    var cachedDate = localStorage.getItem('cfx_rec_date_' + currentUserHandle);
    if (cachedDate === today) {
      var cachedRecs = localStorage.getItem('cfx_recs_' + currentUserHandle);
      if (cachedRecs) {
        renderRecommendations(JSON.parse(cachedRecs));
        return;
      }
    }

    container.innerHTML = '<div class="cfx-loading">Finding perfect problems for ' + escapeHtml(currentUserHandle) + '...</div>';

    fetch('https://codeforces.com/api/user.info?handles=' + currentUserHandle)
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (data.status !== 'OK') throw new Error('API Error');
        var rating = data.result[0].rating || 1000;
        var minR = rating + 100;
        var maxR = rating + 300;

        var solvedCache = sessionStorage.getItem('cfx_solved_' + currentUserHandle);
        var solvedIds = solvedCache ? new Set(JSON.parse(solvedCache)) : new Set();

        return fetch('https://codeforces.com/api/problemset.problems')
          .then(function(res) { return res.json(); })
          .then(function(probData) {
            if (probData.status !== 'OK') throw new Error('Problems Error');
            var problems = probData.result.problems;
            var valid = problems.filter(function(p) {
              return p.rating >= minR && p.rating <= maxR && !solvedIds.has(String(p.contestId) + p.index);
            });

            if (valid.length === 0) {
              container.innerHTML = '<div class="cfx-empty">No unsolved problems found in range ' + minR + '-' + maxR + '.</div>';
              return;
            }

            valid.sort(function() { return 0.5 - Math.random(); });
            var picked = valid.slice(0, 3).map(function(p) {
              return {
                id: String(p.contestId) + p.index,
                name: p.name,
                rating: p.rating,
                tags: p.tags,
                url: 'https://codeforces.com/problemset/problem/' + p.contestId + '/' + p.index
              };
            });

            localStorage.setItem('cfx_rec_date_' + currentUserHandle, today);
            localStorage.setItem('cfx_recs_' + currentUserHandle, JSON.stringify(picked));
            renderRecommendations(picked);
          });
      })
      .catch(function(e) {
        container.innerHTML = '<div class="cfx-empty">Failed to load recommendations. Please try again later.</div>';
      });
  }

  function renderRecommendations(recs) {
    var container = document.getElementById('cfx-practice-container');
    var html = '<button id="cfx-refresh-recs" class="cfx-refresh-btn">Get New Recommendations</button>';
    
    recs.forEach(function(r) {
      var tagsHtml = '';
      if (r.tags) {
        r.tags.slice(0, 3).forEach(function(t) { tagsHtml += '<span class="cfx-practice-tag">' + escapeHtml(t) + '</span>'; });
        if (r.tags.length > 3) tagsHtml += '<span class="cfx-practice-tag">+' + (r.tags.length - 3) + '</span>';
      }
      
      html += '<a href="' + escapeHtml(r.url) + '" class="cfx-practice-card" target="_blank">' +
        '<div class="cfx-practice-header">' +
          '<span class="cfx-practice-title">' + escapeHtml(r.id + ' - ' + r.name) + '</span>' +
          '<span class="cfx-practice-rating">' + r.rating + '</span>' +
        '</div>' +
        '<div class="cfx-practice-tags">' + tagsHtml + '</div>' +
      '</a>';
    });
    
    container.innerHTML = html;
    
    var refreshBtn = document.getElementById('cfx-refresh-recs');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        localStorage.removeItem('cfx_rec_date_' + currentUserHandle);
        loadRecommendations();
      });
    }
  }

  var allContestsCache = [];

  function loadContests() {
    var container = document.getElementById('cfx-contests-container');
    container.innerHTML = '<div class="cfx-loading">Loading contests...</div>';

    chrome.runtime.sendMessage({ type: 'GET_ALL_CONTESTS' }, function(response) {
      if (response && response.contests) {
        allContestsCache = response.contests;
        renderContests(allContestsCache);
      } else {
        container.innerHTML = '<div class="cfx-empty">Failed to load contests. Try again later.</div>';
      }
    });
  }

  function filterContests(platform) {
    if (platform === 'all') {
      renderContests(allContestsCache);
    } else {
      renderContests(allContestsCache.filter(function(c) { return c.platform === platform; }));
    }
  }

  function renderContests(contests) {
    var container = document.getElementById('cfx-contests-container');
    if (!contests || contests.length === 0) {
      container.innerHTML = '<div class="cfx-empty">No upcoming contests found.</div>';
      return;
    }

    var upcoming = contests.filter(function(c) {
      return c.status && c.status.trim().toUpperCase() === 'BEFORE';
    });

    if (upcoming.length === 0) {
      container.innerHTML = '<div class="cfx-empty">No upcoming contests right now.</div>';
      return;
    }

    var html = '';
    upcoming.forEach(function(c) {
      var startDate = new Date(c.startTime);
      var now = new Date();
      var diffMs = startDate.getTime() - now.getTime();
      var diffH = Math.floor(diffMs / 3600000);
      var diffD = Math.floor(diffH / 24);

      var timeStr = '';
      if (diffD > 0) {
        timeStr = 'In ' + diffD + 'd ' + (diffH % 24) + 'h';
      } else if (diffH > 0) {
        timeStr = 'In ' + diffH + 'h';
      } else {
        var diffM = Math.floor(diffMs / 60000);
        timeStr = diffM > 0 ? 'In ' + diffM + 'm' : 'Starting now!';
      }

      var durationH = Math.floor(parseInt(c.duration) / 3600);
      var durationM = Math.floor((parseInt(c.duration) % 3600) / 60);
      var durStr = durationH > 0 ? durationH + 'h' : '';
      if (durationM > 0) durStr += (durStr ? ' ' : '') + durationM + 'm';

      var platformLabel = getPlatformLabel(c.platform);
      var platformClass = 'cfx-platform-' + c.platform;

      var dateStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ', ' + startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      html += '<a href="' + escapeHtml(c.url) + '" target="_blank" class="cfx-contest-item">' +
        '<div class="cfx-contest-top">' +
          '<span class="cfx-contest-platform ' + platformClass + '">' + platformLabel + '</span>' +
          '<span class="cfx-contest-countdown">' + timeStr + '</span>' +
        '</div>' +
        '<div class="cfx-contest-name">' + escapeHtml(c.name) + '</div>' +
        '<div class="cfx-contest-meta">' +
          '<span>' + dateStr + '</span>' +
          (durStr ? '<span>' + durStr + '</span>' : '') +
        '</div>' +
      '</a>';
    });

    container.innerHTML = html;
  }

  function getPlatformLabel(p) {
    var map = { codeforces: 'CF', codechef: 'CC', atcoder: 'AC', leetcode: 'LC' };
    return map[p] || p.toUpperCase();
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.type === 'TOGGLE_DASHBOARD') {
      var overlay = document.getElementById('cfx-dashboard-overlay');
      if (overlay) {
        overlay.classList.toggle('cfx-open');
      } else {
        createDashboardModal();
        document.getElementById('cfx-dashboard-overlay').classList.add('cfx-open');
      }
    }
  });

  init();
})();
