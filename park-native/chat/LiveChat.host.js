/**
 * Web host for fb-live-chat — lazy IntersectionObserver + health gate + compact panel.
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

  function buildLiveChat(props) {
    var C = global.__fbChat;
    if (!C) {
      var missing = document.createElement('div');
      missing.className = 'fb-live-chat-placeholder';
      missing.textContent = 'Chat loading…';
      return missing;
    }
    C.ensureChatCss();

    var prefix = C.normalizePrefix(prop(props, 'prefix', ''));
    var path = prop(props, 'path', '/');
    var channelRaw = prop(props, 'channel', '');
    var channel = channelRaw
      ? C.normalizeChannel(channelRaw)
      : C.channelFromPath(path, prefix || 'fb');
    // Propagate origin onto root so ChatCommon.chatOrigin() sees it
    var originAttr = prop(props, 'chat-origin', '') || prop(props, 'origin', '');

    var root = C.el('div', 'fb-live-chat');
    root.setAttribute('data-fb-live-chat', '1');
    root.setAttribute('data-channel', channel);
    if (prefix) root.setAttribute('data-prefix', prefix);
    if (originAttr) root.setAttribute('data-chat-origin', originAttr);

    var head = C.el('div', 'fb-live-chat-head');
    var title = C.el('h2', 'fb-live-chat-title', 'Live chat');
    var meta = C.el('div', 'fb-live-chat-meta');
    meta.textContent = '#' + channel;
    var openFull = C.el('a', 'fb-link');
    var fullBase = C.chatOrigin() || '';
    if (fullBase) {
      openFull.href = fullBase + '/chat?c=' + encodeURIComponent(channel);
      openFull.target = '_blank';
      openFull.rel = 'noopener noreferrer';
    } else {
      openFull.href = '/chat?c=' + encodeURIComponent(channel);
    }
    openFull.textContent = 'Open full chat';
    head.appendChild(title);
    head.appendChild(meta);
    head.appendChild(openFull);
    root.appendChild(head);

    var placeholder = C.el(
      'div',
      'fb-live-chat-placeholder',
      'Scroll here to load chat for #' + channel + '…',
    );
    root.appendChild(placeholder);

    var activated = false;
    var sock = null;
    var seen = {};

    function activate() {
      if (activated) return;
      activated = true;
      placeholder.textContent = 'Checking chat…';

      C.healthCheck().then(function (ok) {
        if (!ok) {
          root.classList.add('fb-chat-unavailable');
          placeholder.textContent = 'Chat unavailable — retrying…';
          activated = false;
          setTimeout(function () {
            if (!root.isConnected) return;
            root.classList.remove('fb-chat-unavailable');
            activate();
          }, 8000);
          return;
        }

        placeholder.textContent = 'Connecting…';
        return C.ensureNick().then(function (nick) {
          var body = C.el('div', 'fb-live-chat-body');
          var foot = C.el('div', 'fb-live-chat-foot');
          var nickInput = C.el('input', 'fb-live-chat-nick');
          nickInput.type = 'text';
          nickInput.maxLength = 24;
          nickInput.value = nick;
          nickInput.setAttribute('aria-label', 'Nickname');
          var input = C.el('input', 'fb-live-chat-input');
          input.type = 'text';
          input.maxLength = 400;
          input.placeholder = 'Message #' + channel;
          var sendBtn = C.el('button', 'fb-live-chat-send', 'Send');
          sendBtn.type = 'button';
          foot.appendChild(nickInput);
          foot.appendChild(input);
          foot.appendChild(sendBtn);

          if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
          root.appendChild(body);
          root.appendChild(foot);

          function pushMsg(m) {
            if (!m) return;
            var id = m.id || m.ts + m.nick + m.text;
            if (seen[id]) return;
            seen[id] = 1;
            C.appendMessage(body, m);
          }

          return C.fetchHistory(channel, 40).then(function (msgs) {
            for (var i = 0; i < msgs.length; i++) pushMsg(msgs[i]);
            sock = C.connectChat({
              nick: nick,
              onEvent: function (ev) {
                if (ev.type === 'open') {
                  sock.join(channel);
                  meta.textContent = '#' + channel + ' · connected';
                }
                if (ev.type === 'hello' && ev.nick) {
                  nickInput.value = ev.nick;
                  C.setStoredNick(ev.nick);
                }
                if (ev.type === 'message' && C.normalizeChannel(ev.channel) === channel) {
                  pushMsg(ev);
                }
                if (ev.type === 'close' || ev.type === 'error') {
                  meta.textContent = '#' + channel + ' · disconnected';
                }
              },
            });

            function doSend() {
              var text = String(input.value || '').trim();
              if (!text) return;
              var n = String(nickInput.value || '').trim();
              if (n && n !== nick) {
                nick = n;
                sock.nick(n);
              }
              sock.privmsg(channel, text);
              input.value = '';
            }
            sendBtn.addEventListener('click', doSend);
            input.addEventListener('keydown', function (e) {
              if (e.key === 'Enter') {
                e.preventDefault();
                doSend();
              }
            });
            nickInput.addEventListener('change', function () {
              var n = String(nickInput.value || '').trim();
              if (n.length >= 2) {
                nick = n;
                sock.nick(n);
              }
            });
          });
        });
      });
    }

    if (global.IntersectionObserver) {
      var obs = new global.IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) {
              activate();
              obs.disconnect();
              break;
            }
          }
        },
        { root: null, rootMargin: '200px 0px', threshold: 0.01 },
      );
      obs.observe(root);
    } else {
      // no IO — still wait for user interaction / short delay rather than instant WS storm
      global.setTimeout(activate, 800);
    }

    return root;
  }

  function upgrade(node) {
    if (!node || node.getAttribute('data-fb-live-chat-upgraded') === '1') return;
    waitChat().then(function () {
      if (!global.__fbChat) return;
      // Ensure data-chat-origin is visible before ChatCommon.chatOrigin() runs
      var props = attrsToProps(node);
      if (props['data-chat-origin'] || props['chat-origin']) {
        try {
          node.setAttribute(
            'data-chat-origin',
            props['data-chat-origin'] || props['chat-origin'],
          );
        } catch (_) {}
      }
      var built = buildLiveChat(props);
      node.setAttribute('data-fb-live-chat-upgraded', '1');
      if (node.replaceChildren) node.replaceChildren(built);
      else {
        while (node.firstChild) node.removeChild(node.firstChild);
        node.appendChild(built);
      }
    });
  }

  function scan() {
    var nodes = global.document.querySelectorAll(
      '[data-relay-park-native="fb-live-chat"]:not([data-fb-live-chat-upgraded="1"])',
    );
    for (var i = 0; i < nodes.length; i++) upgrade(nodes[i]);
  }

  function register() {
    if (typeof global.__relayRegisterParkNative === 'function') {
      global.__relayRegisterParkNative('fb-live-chat', function (props) {
        return buildLiveChat(props || {});
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
  if (typeof global.__fbScheduleParkNativeReupgrade === 'function') {
    var prev = global.__fbScheduleParkNativeReupgrade;
    global.__fbScheduleParkNativeReupgrade = function () {
      try {
        prev();
      } catch (_) {}
      scan();
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
