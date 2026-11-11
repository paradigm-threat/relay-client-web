/**
 * Web host for fb-chat-app — full IRC-style client with sidebar + search.
 */
(function (global) {
  'use strict';

  function prop(props, key, fallback) {
    if (!props) return fallback;
    var keys = [key, 'data-' + key];
    for (var i = 0; i < keys.length; i++) {
      var v = props[keys[i]];
      if (v == null) continue;
      if (typeof v === 'object' && v !== null && 'value' in v) {
        return v.value != null ? String(v.value) : fallback;
      }
      return String(v);
    }
    return fallback;
  }

  function attrsToProps(el) {
    var o = {};
    if (!el || !el.attributes) return o;
    for (var i = 0; i < el.attributes.length; i++) {
      o[el.attributes[i].name] = el.attributes[i].value;
    }
    return o;
  }

  function queryChannel() {
    try {
      var loc = global.location;
      if (!loc) return '';
      var u = new global.URL(loc.href);
      var c = u.searchParams.get('c') || u.searchParams.get('channel') || '';
      if (!c && u.hash) c = u.hash.replace(/^#/, '');
      return c;
    } catch (_) {
      return '';
    }
  }

  function waitChat() {
    return new Promise(function (resolve) {
      if (global.__fbChat) return resolve(global.__fbChat);
      var n = 0;
      var t = setInterval(function () {
        n++;
        if (global.__fbChat || n > 80) {
          clearInterval(t);
          resolve(global.__fbChat || null);
        }
      }, 50);
    });
  }

  function buildChatApp(props) {
    var C = global.__fbChat;
    if (!C) {
      var missing = document.createElement('div');
      missing.textContent = 'Chat loading…';
      return missing;
    }
    C.ensureChatCss();

    var initial =
      C.normalizeChannel(queryChannel() || prop(props, 'channel', 'flashback')) || 'flashback';

    var root = C.el('div', 'fb-chat-app');
    root.setAttribute('data-fb-chat-app', '1');

    var side = C.el('aside', 'fb-chat-side');
    var sideHead = C.el('div', 'fb-chat-side-head');
    sideHead.appendChild(C.el('h2', 'fb-chat-side-title', 'Channels'));
    var search = C.el('input', 'fb-chat-search');
    search.type = 'search';
    search.placeholder = 'Search channels…';
    search.setAttribute('aria-label', 'Search channels');
    sideHead.appendChild(search);
    var status = C.el('div', 'fb-chat-status', 'Connecting…');
    sideHead.appendChild(status);
    side.appendChild(sideHead);
    var list = C.el('ul', 'fb-chat-chan-list');
    side.appendChild(list);

    var main = C.el('div', 'fb-chat-main');
    var topic = C.el('div', 'fb-chat-topic');
    var topicLabel = C.el('span', 'fb-chat-topic-label', '#' + initial);
    var fsBtn = C.el('button', 'fb-chat-btn fb-chat-fs-btn', 'Fullscreen');
    fsBtn.type = 'button';
    fsBtn.setAttribute('aria-label', 'Toggle fullscreen chat');
    topic.appendChild(topicLabel);
    topic.appendChild(fsBtn);
    var scroll = C.el('div', 'fb-chat-scroll');
    var composer = C.el('div', 'fb-chat-composer');
    var nickInput = C.el('input', 'fb-live-chat-nick');
    nickInput.type = 'text';
    nickInput.maxLength = 24;
    nickInput.setAttribute('aria-label', 'Nickname');
    var modeSelect = global.document.createElement('select');
    modeSelect.className = 'fb-live-chat-nick';
    modeSelect.setAttribute('aria-label', 'Nick style');
    ;[
      ['theater', 'Theater'],
      ['cut-room', 'Cut room'],
    ].forEach(function (pair) {
      var o = global.document.createElement('option');
      o.value = pair[0];
      o.textContent = pair[1];
      modeSelect.appendChild(o);
    });
    modeSelect.value = C.getNickMode();
    var input = C.el('input', 'fb-live-chat-input');
    input.type = 'text';
    input.maxLength = 400;
    input.placeholder = 'Message (or /me /join /part)';
    var sendBtn = C.el('button', 'fb-live-chat-send', 'Send');
    sendBtn.type = 'button';
    var regenBtn = C.el('button', 'fb-chat-btn', 'New nick');
    regenBtn.type = 'button';
    composer.appendChild(nickInput);
    composer.appendChild(modeSelect);
    composer.appendChild(regenBtn);
    composer.appendChild(input);
    composer.appendChild(sendBtn);
    main.appendChild(topic);
    main.appendChild(scroll);
    main.appendChild(composer);

    var namesPane = C.el('aside', 'fb-chat-names');
    namesPane.appendChild(C.el('h3', null, 'Names'));
    var namesList = C.el('div', 'fb-chat-names-list');
    namesPane.appendChild(namesList);

    root.appendChild(side);
    root.appendChild(main);
    root.appendChild(namesPane);

    var state = {
      channel: initial,
      sock: null,
      seen: {},
      channels: [],
    };

    function setTopicLine(extra) {
      topicLabel.textContent = '#' + state.channel + (extra ? ' — ' + extra : '');
    }

    function setFullscreen(on) {
      if (on) {
        root.classList.add('is-fullscreen');
        try {
          global.document.body.classList.add('fb-chat-fs-open');
        } catch (_) {}
        fsBtn.textContent = 'Exit full';
      } else {
        root.classList.remove('is-fullscreen');
        try {
          global.document.body.classList.remove('fb-chat-fs-open');
        } catch (_) {}
        fsBtn.textContent = 'Fullscreen';
      }
    }
    fsBtn.addEventListener('click', function () {
      setFullscreen(!root.classList.contains('is-fullscreen'));
    });
    function onFsKey(e) {
      if (e && e.key === 'Escape' && root.classList.contains('is-fullscreen')) {
        setFullscreen(false);
      }
    }
    try {
      global.document.addEventListener('keydown', onFsKey);
    } catch (_) {}

    function renderChannelList() {
      while (list.firstChild) list.removeChild(list.firstChild);
      var q = String(search.value || '')
        .trim()
        .toLowerCase();
      var rows = state.channels.slice();
      if (q) {
        rows = rows.filter(function (c) {
          return (
            String(c.name).indexOf(q) >= 0 ||
            String(c.topic || '')
              .toLowerCase()
              .indexOf(q) >= 0
          );
        });
      }
      // always include current
      if (!rows.some(function (c) {
        return c.name === state.channel;
      })) {
        rows.unshift({ name: state.channel, topic: '' });
      }
      rows.forEach(function (c) {
        var li = C.el('li', null);
        var btn = C.el('button', 'fb-chat-chan', '#' + c.name);
        btn.type = 'button';
        if (c.name === state.channel) btn.classList.add('is-active');
        btn.addEventListener('click', function () {
          switchChannel(c.name);
        });
        li.appendChild(btn);
        list.appendChild(li);
      });
    }

    function clearScroll() {
      while (scroll.firstChild) scroll.removeChild(scroll.firstChild);
      state.seen = {};
    }

    function pushMsg(m) {
      if (!m) return;
      if (C.normalizeChannel(m.channel || state.channel) !== state.channel && m.channel) return;
      var id = m.id || m.ts + m.nick + m.text;
      if (state.seen[id]) return;
      state.seen[id] = 1;
      C.appendMessage(scroll, m);
    }

    function switchChannel(name) {
      var next = C.normalizeChannel(name);
      if (!next || next === state.channel) {
        renderChannelList();
        return;
      }
      if (state.sock) {
        state.sock.part(state.channel);
        state.sock.join(next);
      }
      state.channel = next;
      setTopicLine('');
      clearScroll();
      renderChannelList();
      try {
        var u = new global.URL(global.location.href);
        u.searchParams.set('c', next);
        global.history.replaceState({}, '', u.pathname + u.search);
      } catch (_) {}
      C.fetchHistory(next, 80).then(function (msgs) {
        for (var i = 0; i < msgs.length; i++) pushMsg(msgs[i]);
      });
      input.placeholder = 'Message #' + next + ' (or /me /join /part)';
    }

    function refreshChannels() {
      return C.fetchChannels(search.value || '').then(function (chs) {
        state.channels = chs || [];
        // seed lobby if empty
        if (!state.channels.length) {
          state.channels = [
            { name: 'flashback', topic: 'Lobby' },
            { name: state.channel, topic: '' },
          ];
        }
        renderChannelList();
      });
    }

    function bootChat() {
      return C.ensureNick().then(function (nick) {
        nickInput.value = nick;
        state.sock = C.connectChat({
          nick: nick,
          onEvent: function (ev) {
            if (ev.type === 'open') {
              status.textContent = 'Connected';
              state.sock.join(state.channel);
            }
            if (ev.type === 'hello' && ev.nick) {
              nickInput.value = ev.nick;
              C.setStoredNick(ev.nick);
            }
            if (ev.type === 'message') pushMsg(ev);
            if (ev.type === 'topic' && C.normalizeChannel(ev.channel) === state.channel) {
              setTopicLine(ev.topic || '');
            }
            if (ev.type === 'names' && C.normalizeChannel(ev.channel) === state.channel) {
              while (namesList.firstChild) namesList.removeChild(namesList.firstChild);
              (ev.names || []).forEach(function (n) {
                namesList.appendChild(C.el('div', null, n));
              });
            }
            if (ev.type === 'join' && ev.nick) {
              /* soft */
            }
            if (ev.type === 'close' || ev.type === 'error') {
              status.textContent = 'Disconnected — refresh to reconnect';
            }
            if (ev.type === 'notice') {
              pushMsg({
                id: 'notice-' + Date.now(),
                ts: new Date().toISOString(),
                channel: state.channel,
                nick: ev.nick || 'server',
                kind: 'privmsg',
                text: ev.text || '',
              });
            }
          },
        });

        C.fetchHistory(state.channel, 80).then(function (msgs) {
          for (var i = 0; i < msgs.length; i++) pushMsg(msgs[i]);
        });
        refreshChannels();

        function doSend() {
          var text = String(input.value || '').trim();
          if (!text || !state.sock) return;
          var n = String(nickInput.value || '').trim();
          if (n.length >= 2) state.sock.nick(n);
          if (text.indexOf('/join ') === 0) {
            switchChannel(text.slice(6));
            input.value = '';
            return;
          }
          state.sock.privmsg(state.channel, text);
          input.value = '';
        }
        sendBtn.addEventListener('click', doSend);
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            doSend();
          }
        });
        search.addEventListener('input', function () {
          refreshChannels();
        });
        regenBtn.addEventListener('click', function () {
          C.setNickMode(modeSelect.value);
          C.fetchName(modeSelect.value).then(function (n) {
            nickInput.value = n;
            C.setStoredNick(n);
            if (state.sock) state.sock.nick(n);
          });
        });
        modeSelect.addEventListener('change', function () {
          C.setNickMode(modeSelect.value);
        });
      });
    }

    function tryConnect(attempt) {
      var n = attempt || 0;
      status.textContent = n ? 'Retrying chat…' : 'Connecting…';
      C.healthCheck().then(function (ok) {
        if (!ok) {
          status.textContent = 'Chat API unavailable — retrying…';
          setTimeout(function () {
            tryConnect(n + 1);
          }, Math.min(20000, 2500 + n * 2500));
          return;
        }
        bootChat();
      });
    }
    tryConnect(0);

    return root;
  }

  function upgrade(node) {
    if (!node || node.getAttribute('data-fb-chat-app-upgraded') === '1') return;
    waitChat().then(function () {
      if (!global.__fbChat) return;
      var built = buildChatApp(attrsToProps(node));
      node.setAttribute('data-fb-chat-app-upgraded', '1');
      if (node.replaceChildren) node.replaceChildren(built);
      else {
        while (node.firstChild) node.removeChild(node.firstChild);
        node.appendChild(built);
      }
    });
  }

  function scan() {
    var nodes = global.document.querySelectorAll(
      '[data-relay-park-native="fb-chat-app"]:not([data-fb-chat-app-upgraded="1"])',
    );
    for (var i = 0; i < nodes.length; i++) upgrade(nodes[i]);
  }

  function register() {
    if (typeof global.__relayRegisterParkNative === 'function') {
      global.__relayRegisterParkNative('fb-chat-app', function (props) {
        return buildChatApp(props || {});
      });
    }
    scan();
  }

  register();
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', scan);
    }
    global.setInterval(scan, 1500);
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
