/**
 * Shared Relay mesh chat helpers for LiveChat / ChatApp park hosts.
 * Published at relay-web-assets assets/chat/ChatCommon.host.js
 *
 * Repo prefixes (see docs/RELAY_CHAT.md): fb | ct | pt
 */
(function (global) {
  'use strict';

  if (global.__fbChat) return;

  var NICK_KEY = 'relay.chat.nick.v1';
  var MODE_KEY = 'relay.chat.nickMode.v1';
  // Migrate Flashback localStorage once
  try {
    if (!global.localStorage.getItem(NICK_KEY)) {
      var legacy = global.localStorage.getItem('flashback.chat.nick.v1');
      if (legacy) global.localStorage.setItem(NICK_KEY, legacy);
    }
    if (!global.localStorage.getItem(MODE_KEY)) {
      var legacyM = global.localStorage.getItem('flashback.chat.nickMode.v1');
      if (legacyM) global.localStorage.setItem(MODE_KEY, legacyM);
    }
  } catch (_) {}

  function el(tag, className, text) {
    var n = global.document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Limited markdown → safe HTML (bold/italic/code/links/images). */
  function renderMd(raw) {
    var s = escapeHtml(raw);
    s = s.replace(/`([^`]+)`/g, '<code class="fb-chat-code">$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(
      /(https?:\/\/[^\s<]+)/g,
      function (url) {
        var clean = url.replace(/[),.;]+$/, '');
        var trail = url.slice(clean.length);
        var lower = clean.toLowerCase();
        var isImg =
          /\.(png|jpe?g|gif|webp)(\?|$)/i.test(clean) ||
          /\/media\//i.test(clean);
        if (isImg) {
          return (
            '<a class="fb-chat-link" href="' +
            clean +
            '" target="_blank" rel="noopener noreferrer">' +
            clean +
            '</a><div class="fb-chat-img-wrap"><img class="fb-chat-img" src="' +
            clean +
            '" alt="" loading="lazy" referrerpolicy="no-referrer" /></div>' +
            trail
          );
        }
        return (
          '<a class="fb-chat-link" href="' +
          clean +
          '" target="_blank" rel="noopener noreferrer">' +
          clean +
          '</a>' +
          trail
        );
      },
    );
    return s;
  }

  /** Known short prefixes → catalog repo slug */
  var PREFIX_REPOS = {
    fb: 'fan-edits',
    ct: 'clevertree-site',
    pt: 'paradigm-threat-files',
  };

  function normalizePrefix(raw) {
    var p = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 8);
    return p;
  }

  function normalizeChannel(raw) {
    var c = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/^#/, '');
    c = c.replace(/[^a-z0-9_\-./]/g, '').slice(0, 64);
    return c || 'flashback';
  }

  /** Ops log channel for a prefix: logs-fb, logs-ct, … */
  function logsChannel(prefix) {
    var p = normalizePrefix(prefix) || 'fb';
    return 'logs-' + p;
  }

  /**
   * Build a scoped channel.
   * Flashback (fb) keeps legacy names: flashback, page-*, movie-*.
   * Other prefixes: {prefix}, {prefix}-page-*, {prefix}-movie-*, {prefix}-doc-*.
   */
  function scopedChannel(prefix, kind, slug) {
    var p = normalizePrefix(prefix) || 'fb';
    var k = String(kind || 'lobby').toLowerCase();
    var s = String(slug || '')
      .toLowerCase()
      .replace(/[^a-z0-9_\-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    if (p === 'fb') {
      if (k === 'lobby' || k === 'chat') return 'flashback';
      if (k === 'page') return 'page-' + (s || 'home');
      if (k === 'movie') return 'movie-' + (s || 'unknown');
      if (k === 'logs') return 'logs-fb';
      return s ? 'fb-' + k + '-' + s : 'flashback';
    }
    if (k === 'lobby' || k === 'chat') return p;
    if (k === 'logs') return 'logs-' + p;
    if (k === 'page') return p + '-page-' + (s || 'home');
    if (k === 'movie' || k === 'doc') return p + '-' + k + '-' + (s || 'unknown');
    return p + '-' + k + (s ? '-' + s : '');
  }

  function channelFromPath(pathname, prefix) {
    var pfx = normalizePrefix(prefix);
    var p = String(pathname || '/').split('?')[0];
    if (!p || p === '/') {
      return pfx && pfx !== 'fb' ? scopedChannel(pfx, 'page', 'home') : 'page-home';
    }
    if (p.charAt(0) === '/') p = p.slice(1);
    if (p.indexOf('movie/') === 0) {
      var ms = p.slice(6).replace(/[^a-z0-9_\-]/g, '-').slice(0, 48);
      return scopedChannel(pfx || 'fb', 'movie', ms);
    }
    // known static pages (Flashback + shared names)
    var staticMap = {
      board: 'board',
      feedback: 'board',
      bugs: 'board',
      setup: 'setup',
      playback: 'setup',
      vlc: 'setup',
      app: 'app',
      android: 'app',
      apk: 'app',
      legal: 'legal',
      terms: 'terms',
      motivation: 'motivation',
      why: 'motivation',
      submit: 'submit',
      contribute: 'submit',
      request: 'request',
      downloads: 'request',
      email: 'request',
      chat: 'chat',
      'android-lab': 'android-lab',
      resume: 'home',
      search: 'search',
    };
    var base = p.split('/')[0];
    if (base === 'chat') {
      return scopedChannel(pfx || 'fb', 'lobby');
    }
    if (staticMap[base]) {
      return scopedChannel(pfx || 'fb', 'page', staticMap[base]);
    }
    if (p.indexOf('/') >= 0) {
      // article-like paths on paradigm → pt-doc-<slug>
      var leaf = p.replace(/\.md$/, '').split('/').pop() || 'home';
      if (pfx && pfx !== 'fb') return scopedChannel(pfx, 'doc', leaf);
      return 'page-home';
    }
    if (pfx && pfx !== 'fb') {
      return scopedChannel(pfx, 'page', p.replace(/[^a-z0-9_\-]/g, '-').slice(0, 48));
    }
    return 'movie-' + p.replace(/[^a-z0-9_\-]/g, '-').slice(0, 48);
  }

  /** Resolve chat API origin: data-chat-origin → meta → same-origin. */
  function chatOrigin() {
    try {
      var el = global.document && global.document.querySelector('[data-chat-origin]');
      if (el) {
        var o = String(el.getAttribute('data-chat-origin') || '').trim();
        if (o) return o.replace(/\/$/, '');
      }
      var meta =
        global.document &&
        global.document.querySelector('meta[name="relay-chat-origin"]');
      if (meta) {
        var m = String(meta.getAttribute('content') || '').trim();
        if (m) return m.replace(/\/$/, '');
      }
    } catch (_) {}
    return '';
  }

  function getStoredNick() {
    try {
      var n = global.localStorage.getItem(NICK_KEY);
      if (n && n.length >= 2) return n.slice(0, 24);
    } catch (_) {}
    return '';
  }

  function setStoredNick(n) {
    try {
      global.localStorage.setItem(NICK_KEY, String(n || '').slice(0, 24));
    } catch (_) {}
  }

  function getNickMode() {
    try {
      return global.localStorage.getItem(MODE_KEY) || 'theater';
    } catch (_) {
      return 'theater';
    }
  }

  function setNickMode(m) {
    try {
      global.localStorage.setItem(MODE_KEY, m === 'cut-room' ? 'cut-room' : 'theater');
    } catch (_) {}
  }

  function apiBase() {
    return chatOrigin();
  }

  function fetchJson(path) {
    var opts = { cache: 'no-store' };
    // Cross-origin chat primary needs CORS + omit credentials unless same site.
    opts.credentials = apiBase() ? 'omit' : 'same-origin';
    return global.fetch(apiBase() + path, opts).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function healthCheckOnce() {
    return fetchJson('/chat/api/health').then(
      function (j) {
        return !!(j && j.ok);
      },
      function () {
        return false;
      },
    );
  }

  /** Retry briefly — park/Caddy route drift can 404 for a few seconds after rewrite. */
  function healthCheck(retries) {
    var left = typeof retries === 'number' ? retries : 4;
    function attempt() {
      return healthCheckOnce().then(function (ok) {
        if (ok || left <= 0) return ok;
        left -= 1;
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve(attempt());
          }, 700);
        });
      });
    }
    return attempt();
  }

  function fetchHistory(channel, limit) {
    var q =
      '/chat/api/history?channel=' +
      encodeURIComponent(normalizeChannel(channel)) +
      '&limit=' +
      encodeURIComponent(String(limit || 50));
    return fetchJson(q).then(function (j) {
      return (j && j.messages) || [];
    });
  }

  function fetchChannels(q) {
    var path = '/chat/api/channels';
    if (q) path += '?q=' + encodeURIComponent(q);
    return fetchJson(path).then(function (j) {
      return (j && j.channels) || [];
    });
  }

  function fetchName(mode) {
    var m = mode || getNickMode();
    return fetchJson('/chat/api/name?mode=' + encodeURIComponent(m)).then(function (j) {
      return (j && j.nick) || 'Lobby-A1';
    });
  }

  function ensureNick() {
    var existing = getStoredNick();
    if (existing) return Promise.resolve(existing);
    return fetchName().then(function (n) {
      setStoredNick(n);
      return n;
    });
  }

  function wsUrl() {
    var origin = chatOrigin();
    if (origin) {
      try {
        var u = new global.URL(origin);
        var wsp = u.protocol === 'https:' ? 'wss:' : 'ws:';
        return wsp + '//' + u.host + '/chat/ws';
      } catch (_) {}
    }
    var proto = global.location && global.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var host = (global.location && global.location.host) || 'localhost';
    return proto + '//' + host + '/chat/ws';
  }

  /**
   * Minimal JSON chat socket.
   * onEvent(obj) for server messages.
   */
  function connectChat(opts) {
    var nick = opts.nick;
    var onEvent = opts.onEvent || function () {};
    var ws = new global.WebSocket(wsUrl());
    var opened = false;
    var queue = [];

    function send(obj) {
      var raw = JSON.stringify(obj);
      if (ws.readyState === 1) ws.send(raw);
      else queue.push(raw);
    }

    ws.addEventListener('open', function () {
      opened = true;
      if (nick) send({ type: 'nick', nick: nick });
      while (queue.length) ws.send(queue.shift());
      onEvent({ type: 'open' });
    });
    ws.addEventListener('message', function (ev) {
      try {
        onEvent(JSON.parse(String(ev.data || '{}')));
      } catch (_) {}
    });
    ws.addEventListener('close', function () {
      onEvent({ type: 'close' });
    });
    ws.addEventListener('error', function () {
      onEvent({ type: 'error' });
    });

    return {
      send: send,
      join: function (ch) {
        send({ type: 'join', channel: normalizeChannel(ch) });
      },
      part: function (ch) {
        send({ type: 'part', channel: normalizeChannel(ch) });
      },
      privmsg: function (ch, text) {
        send({ type: 'privmsg', channel: normalizeChannel(ch), text: text });
      },
      nick: function (n) {
        nick = n;
        setStoredNick(n);
        send({ type: 'nick', nick: n });
      },
      close: function () {
        try {
          ws.close();
        } catch (_) {}
      },
      raw: function () {
        return ws;
      },
    };
  }

  function ensureChatCss() {
    if (global.document.getElementById('fb-chat-css')) return;
    var st = global.document.createElement('style');
    st.id = 'fb-chat-css';
    st.textContent = [
      '.fb-live-chat{margin:28px 0 8px;border:1px solid #3a2a1a;background:linear-gradient(165deg,rgba(42,20,24,.92),rgba(13,5,5,.96));color:#f5e6be;border-radius:4px;overflow:hidden}',
      '.fb-live-chat-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:1px solid #3a2a1a;background:rgba(0,0,0,.28)}',
      '.fb-live-chat-title{margin:0;font-size:.95rem;letter-spacing:.06em;text-transform:uppercase;color:#e8c872}',
      '.fb-live-chat-meta{font-size:.8rem;color:#a69788}',
      '.fb-live-chat-body{min-height:140px;max-height:280px;overflow:auto;padding:10px 14px;font-size:.92rem;line-height:1.45}',
      '.fb-live-chat-placeholder{padding:18px 14px;color:#a69788;font-size:.9rem}',
      '.fb-live-chat-foot{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;border-top:1px solid #3a2a1a;background:rgba(0,0,0,.22)}',
      '.fb-live-chat-nick{width:140px;max-width:40%;padding:8px 10px;border:1px solid #5a4a2a;background:#12080a;color:#f5e6be;border-radius:3px;font:inherit}',
      '.fb-live-chat-input{flex:1;min-width:140px;padding:8px 10px;border:1px solid #5a4a2a;background:#12080a;color:#f5e6be;border-radius:3px;font:inherit}',
      '.fb-live-chat-send,.fb-chat-btn{padding:8px 12px;border:1px solid #e8c872;background:linear-gradient(180deg,#5a2430,#2a1018);color:#f5e6be;border-radius:3px;cursor:pointer;font:inherit}',
      '.fb-live-chat-send:hover,.fb-chat-btn:hover{border-color:#f5e6be}',
      '.fb-chat-msg{margin:0 0 8px;word-break:break-word}',
      '.fb-chat-msg-nick{color:#e8c872;font-weight:600;margin-right:6px}',
      '.fb-chat-msg-action{color:#c4b49a;font-style:italic}',
      '.fb-chat-msg-time{color:#6a5a4a;font-size:.75rem;margin-right:6px}',
      '.fb-chat-link{color:#e8c872}',
      '.fb-chat-code{font-family:ui-monospace,Consolas,monospace;font-size:.88em;color:#e8c872}',
      '.fb-chat-img-wrap{margin:6px 0}',
      '.fb-chat-img{max-width:min(320px,100%);max-height:200px;border:1px solid #3a2a1a;border-radius:2px}',
      '.fb-chat-unavailable{opacity:.85}',
      '.fb-chat-app{display:flex;flex-direction:row;align-items:stretch;width:100%;min-height:min(62vh,640px);height:min(62vh,640px);border:1px solid #3a2a1a;background:#0d0505;color:#f5e6be;border-radius:4px;overflow:hidden;box-sizing:border-box}',
      '.fb-chat-app-host{display:block;width:100%}',
      '.fb-chat-side{width:220px;max-width:36vw;flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid #3a2a1a;background:rgba(18,8,10,.95);min-height:0}',
      '.fb-chat-side-head{padding:12px;border-bottom:1px solid #3a2a1a;flex-shrink:0}',
      '.fb-chat-side-title{margin:0 0 8px;font-size:.85rem;letter-spacing:.12em;text-transform:uppercase;color:#e8c872}',
      '.fb-chat-search{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #5a4a2a;background:#12080a;color:#f5e6be;border-radius:3px;font:inherit}',
      '.fb-chat-chan-list{flex:1;overflow:auto;padding:8px 0;margin:0;list-style:none;min-height:0}',
      '.fb-chat-chan{display:block;width:100%;text-align:left;padding:8px 12px;border:0;background:transparent;color:#c4b49a;cursor:pointer;font:inherit}',
      '.fb-chat-chan:hover,.fb-chat-chan.is-active{background:rgba(232,200,114,.12);color:#f5e6be}',
      '.fb-chat-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}',
      '.fb-chat-topic{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid #3a2a1a;font-size:.88rem;color:#a69788;background:rgba(0,0,0,.25);flex-shrink:0}',
      '.fb-chat-topic-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.fb-chat-fs-btn{flex-shrink:0;padding:6px 10px;font-size:.8rem}',
      '.fb-chat-scroll{flex:1;overflow:auto;padding:12px 14px;min-height:0}',
      '.fb-chat-composer{display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;border-top:1px solid #3a2a1a;flex-shrink:0;background:rgba(0,0,0,.22)}',
      '.fb-chat-names{width:140px;flex-shrink:0;border-left:1px solid #3a2a1a;padding:10px;overflow:auto;font-size:.85rem;color:#a69788;background:rgba(0,0,0,.2);min-height:0}',
      '.fb-chat-names h3{margin:0 0 8px;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:#b8860b}',
      '.fb-chat-status{font-size:.78rem;color:#a69788}',
      '.fb-chat-app.is-fullscreen{position:fixed;inset:0;z-index:200;width:100%;height:100%;max-width:none;min-height:100%;border-radius:0;border:0}',
      'body.fb-chat-fs-open{overflow:hidden}',
      'body.fb-chat-fs-open .fb-header,body.fb-chat-fs-open .fb-now-showing-host,body.fb-chat-fs-open .fb-footer{visibility:hidden}',
      '@media (max-width:800px){.fb-chat-app{flex-direction:column;height:min(70vh,720px);min-height:min(70vh,720px)}.fb-chat-side{width:100%;max-width:none;max-height:160px;border-right:0;border-bottom:1px solid #3a2a1a}.fb-chat-names{display:none}.fb-chat-app.is-fullscreen{height:100%;min-height:100%}}',
    ].join('');
    (global.document.head || global.document.documentElement).appendChild(st);
  }

  function appendMessage(container, msg, opts) {
    opts = opts || {};
    var row = el('div', 'fb-chat-msg');
    if (msg.id) row.setAttribute('data-id', msg.id);
    var time = el('span', 'fb-chat-msg-time');
    try {
      var d = msg.ts ? new Date(msg.ts) : new Date();
      time.textContent = d.toISOString().slice(11, 19);
    } catch (_) {
      time.textContent = '';
    }
    row.appendChild(time);
    if (msg.kind === 'action') {
      var act = el('span', 'fb-chat-msg-action');
      act.textContent = '* ' + (msg.nick || '') + ' ' + (msg.text || '');
      row.appendChild(act);
    } else {
      var nick = el('span', 'fb-chat-msg-nick', msg.nick || '?');
      row.appendChild(nick);
      var body = el('span', 'fb-chat-msg-body');
      body.innerHTML = renderMd(msg.text || '');
      row.appendChild(body);
    }
    container.appendChild(row);
    if (opts.scroll !== false) {
      container.scrollTop = container.scrollHeight;
    }
  }

  global.__fbChat = {
    el: el,
    renderMd: renderMd,
    normalizeChannel: normalizeChannel,
    normalizePrefix: normalizePrefix,
    PREFIX_REPOS: PREFIX_REPOS,
    logsChannel: logsChannel,
    scopedChannel: scopedChannel,
    channelFromPath: channelFromPath,
    chatOrigin: chatOrigin,
    apiBase: apiBase,
    getStoredNick: getStoredNick,
    setStoredNick: setStoredNick,
    getNickMode: getNickMode,
    setNickMode: setNickMode,
    healthCheck: healthCheck,
    fetchHistory: fetchHistory,
    fetchChannels: fetchChannels,
    fetchName: fetchName,
    ensureNick: ensureNick,
    connectChat: connectChat,
    ensureChatCss: ensureChatCss,
    appendMessage: appendMessage,
  };
  // Alias for non-Flashback call sites
  global.__relayChat = global.__fbChat;
})(typeof globalThis !== 'undefined' ? globalThis : window);
