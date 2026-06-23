var ALARM_NAME = 'cfx-contest-check';
var CHECK_INTERVAL_MINUTES = 60;

chrome.runtime.onInstalled.addListener(function() {
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: CHECK_INTERVAL_MINUTES });
});

chrome.runtime.onStartup.addListener(function() {
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: CHECK_INTERVAL_MINUTES });
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === ALARM_NAME) {
    fetchAllContests().then(function(contests) {
      chrome.storage.local.set({ allContests: contests, lastFetch: Date.now() });
    });
  }
});

function fetchCodeforces() {
  return fetch('https://codeforces.com/api/contest.list?gym=false')
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.status !== 'OK') return [];
      return data.result
        .filter(function(c) { return c.phase === 'BEFORE'; })
        .map(function(c) {
          return {
            name: c.name,
            url: 'https://codeforces.com/contest/' + c.id,
            platform: 'codeforces',
            startTime: new Date(c.startTimeSeconds * 1000).toISOString(),
            duration: c.durationSeconds,
            status: 'BEFORE'
          };
        });
    })
    .catch(function(e) { return []; });
}

function fetchCodechef() {
  return fetch('https://www.codechef.com/api/list/contests/all?sort_by=START&sorting_order=asc&offset=0&mode=all', {
    headers: { 'Accept': 'application/json' }
  })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var contests = [];
      var lists = [
        (data.future_contests || []),
        (data.present_contests || [])
      ];
      lists.forEach(function(list) {
        list.forEach(function(c) {
          contests.push({
            name: c.contest_name,
            url: 'https://www.codechef.com/' + c.contest_code,
            platform: 'codechef',
            startTime: c.contest_start_date_iso || c.contest_start_date,
            duration: parseInt(c.contest_duration) * 60,
            status: 'BEFORE'
          });
        });
      });
      return contests;
    })
    .catch(function(e) { return []; });
}

function fetchAtcoder() {
  return fetch('https://atcoder.jp/contests/?lang=en', {
    headers: { 'Accept': 'text/html' }
  })
    .then(function(res) { return res.text(); })
    .then(function(html) {
      var contests = [];
      var upcomingMatch = html.match(/id="contest-table-upcoming"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
      if (!upcomingMatch) return contests;

      var rows = upcomingMatch[1].match(/<tr[\s\S]*?<\/tr>/g) || [];
      rows.forEach(function(row) {
        var nameMatch = row.match(/href="(\/contests\/[^"]+)"[^>]*>([^<]+)<\/a>/);
        var timeMatch = row.match(/data-sort="(\d+)"/);
        var durMatch = row.match(/<td[^>]*>\s*(\d+:\d+)\s*<\/td>/g);

        if (nameMatch && timeMatch) {
          var startMs = parseInt(timeMatch[1]) * 1000;
          var durationSecs = 0;
          if (durMatch && durMatch[1]) {
            var dStr = durMatch[1].replace(/<[^>]+>/g, '').trim();
            var parts = dStr.split(':');
            if (parts.length === 2) durationSecs = parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60;
          }
          contests.push({
            name: nameMatch[2].trim(),
            url: 'https://atcoder.jp' + nameMatch[1],
            platform: 'atcoder',
            startTime: new Date(startMs).toISOString(),
            duration: durationSecs,
            status: 'BEFORE'
          });
        }
      });
      return contests;
    })
    .catch(function(e) { return []; });
}

function fetchLeetcode() {
  return fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      query: '{ allContests { title titleSlug startTime duration } }'
    })
  })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (!data.data || !data.data.allContests) return [];
      var now = Math.floor(Date.now() / 1000);
      return data.data.allContests
        .filter(function(c) { return c.startTime > now; })
        .map(function(c) {
          return {
            name: c.title,
            url: 'https://leetcode.com/contest/' + c.titleSlug,
            platform: 'leetcode',
            startTime: new Date(c.startTime * 1000).toISOString(),
            duration: c.duration,
            status: 'BEFORE'
          };
        });
    })
    .catch(function(e) { return []; });
}

function fetchAllContests() {
  return Promise.all([
    fetchCodeforces(),
    fetchCodechef(),
    fetchAtcoder(),
    fetchLeetcode()
  ]).then(function(results) {
    var all = [];
    results.forEach(function(list) { all = all.concat(list); });
    all.sort(function(a, b) {
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
    return all;
  });
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'GET_ALL_CONTESTS') {
    chrome.storage.local.get(['allContests', 'lastFetch'], function(data) {
      var stale = !data.lastFetch || (Date.now() - data.lastFetch) > 30 * 60 * 1000;
      if (data.allContests && data.allContests.length > 0 && !stale) {
        sendResponse({ contests: data.allContests });
      } else {
        fetchAllContests().then(function(contests) {
          chrome.storage.local.set({ allContests: contests, lastFetch: Date.now() });
          sendResponse({ contests: contests });
        });
      }
    });
    return true;
  }
});

chrome.action.onClicked.addListener(function(tab) {
  if (tab.url && tab.url.includes('codeforces.com')) {
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_DASHBOARD' });
  } else {
    chrome.tabs.create({ url: 'https://codeforces.com' });
  }
});