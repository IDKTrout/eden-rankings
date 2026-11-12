// Eden colour theme picker, shared by edenafk.com, alliance.edenafk.com and event-rankings.edenafk.com.
// Keep the three copies identical (see theme.css). Fills every [data-theme-pick] element with a
// button that opens the list of themes. The choice is saved in a cookie on .edenafk.com so it
// follows the visitor between the three sites (localStorage on any other host, such as localhost).
(function () {
  var THEMES = [
    ['gold', 'Eden Gold', '#c9961e'],
    ['sky', 'Sky', '#3d82e6'],
    ['emerald', 'Emerald', '#2a9d68'],
    ['teal', 'Teal', '#16939e'],
    ['amethyst', 'Amethyst', '#8a5ee6'],
    ['rose', 'Rose', '#d64589'],
    ['crimson', 'Crimson', '#d24636'],
  ];
  var KEY = 'eden-accent';
  var shared = /(^|\.)edenafk\.com$/.test(location.hostname);
  var root = document.documentElement;

  function current() {
    var a = root.getAttribute('data-accent');
    return THEMES.some(function (t) { return t[0] === a; }) ? a : 'gold';
  }

  function save(id) {
    root.setAttribute('data-accent', id);
    if (shared) {
      document.cookie = KEY + '=' + id + '; domain=.edenafk.com; path=/; max-age=31536000; SameSite=Lax; Secure';
    }
    try { localStorage.setItem(KEY, id); } catch (e) { /* storage blocked */ }
  }

  root.setAttribute('data-accent', current());

  var count = 0;
  document.querySelectorAll('[data-theme-pick]').forEach(function (holder) {
    count += 1;
    var menuId = 'theme-menu-' + count;
    holder.classList.add('theme-pick');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-btn';
    btn.setAttribute('aria-label', 'Colour theme');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', menuId);
    btn.title = 'Colour theme';
    btn.innerHTML = '<span class="dot-now" aria-hidden="true"></span>';

    var menu = document.createElement('div');
    menu.className = 'theme-menu';
    menu.id = menuId;
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Colour theme');
    menu.innerHTML = '<div class="tm-title">Colour theme</div>';

    var items = THEMES.map(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitemradio');
      b.dataset.id = t[0];
      b.innerHTML = '<span class="sw" aria-hidden="true" style="background:' + t[2] + '"></span><span>' + t[1] + '</span><span class="tick" aria-hidden="true">✓</span>';
      b.addEventListener('click', function () { save(t[0]); mark(); close(true); });
      menu.appendChild(b);
      return b;
    });
    var note = document.createElement('div');
    note.className = 'tm-note';
    note.textContent = shared ? 'Applies on every Eden site.' : 'Saved on this browser.';
    menu.appendChild(note);

    function mark() {
      var now = current();
      items.forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.id === now)); });
    }
    function open() {
      mark();
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      var on = items.filter(function (b) { return b.getAttribute('aria-checked') === 'true'; })[0] || items[0];
      on.focus();
    }
    function close(focusBtn) {
      if (menu.hidden) return;
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      if (focusBtn) btn.focus();
    }

    btn.addEventListener('click', function () { menu.hidden ? open() : close(false); });
    menu.addEventListener('keydown', function (e) {
      var i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if (e.key === 'Tab') { close(false); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
    document.addEventListener('click', function (e) { if (!holder.contains(e.target)) close(false); });

    holder.replaceChildren(btn, menu);
  });
})();
