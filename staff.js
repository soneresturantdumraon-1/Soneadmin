/* Sone - staff (waiter + owner) shared logic: login, live orders, order cards, take-order */
(function () {
  const S = window.Staff = { me: null, orders: [], seen: null, menu: [], onOrders: null, fromDate: null };

  /* ---------- login / session ---------- */
  S.init = async function ({ roles, title, subtitle, onReady }) {
    const box = $('#login');
    box.innerHTML = `<div class="login"><img class="logo" src="sonelogo.png" alt="Sone"><h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p>
      <label class="field"><span>Email</span><input class="inp" id="lg-email" type="email" autocomplete="username" inputmode="email"></label>
      <label class="field"><span>Password</span><input class="inp" id="lg-pass" type="password" autocomplete="current-password"></label>
      <button class="btn block mt8" id="lg-btn">Login</button><div class="err-txt" id="lg-err"></div></div>`;
    const err = m => { $('#lg-err').textContent = m || ''; };
    async function enter(user) {
      const { data, error } = await sb.from('staff').select('*').eq('id', user.id).maybeSingle();
      if (error || !data || !data.active) { await sb.auth.signOut(); box.classList.remove('hide'); $('#app').classList.add('hide'); return err('Is account ko access nahi hai. Owner se baat karein.'); }
      if (!roles.includes(data.role)) { await sb.auth.signOut(); box.classList.remove('hide'); $('#app').classList.add('hide'); return err('Ye app ' + roles.join('/') + ' ke liye hai.'); }
      S.me = data; box.classList.add('hide'); $('#app').classList.remove('hide'); onReady(data);
    }
    async function login() {
      const email = $('#lg-email').value.trim(), password = $('#lg-pass').value;
      if (!email || !password) return err('Email aur password likhein');
      $('#lg-btn').disabled = true; err('Login ho raha hai...');
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      $('#lg-btn').disabled = false;
      if (error) return err('Login nahi hua: ' + (/invalid/i.test(error.message) ? 'email ya password galat hai' : error.message));
      err(''); enter(data.user);
    }
    $('#lg-btn').onclick = login; $('#lg-pass').addEventListener('keydown', e => e.key === 'Enter' && login());
    const { data: { session } } = await sb.auth.getSession();
    if (session) enter(session.user); else { box.classList.remove('hide'); $('#app').classList.add('hide'); }
  };
  S.logout = async () => { await sb.auth.signOut(); location.reload(); };

  /* ---------- live orders ---------- */
  S.refresh = async function () {
    if (!S.me) return;
    const from = S.fromDate || new Date(Date.now() - 36 * 3600e3).toISOString();
    const { data, error } = await sb.from('orders').select('*').gte('created_at', from).order('created_at', { ascending: false }).limit(500);
    if (error) { toast('Orders load nahi hue: ' + error.message, 'err'); return; }
    S.orders = data || [];
    const fresh = [];
    if (S.seen) S.orders.forEach(o => { if (!S.seen.has(o.id) && o.status === 'placed' && o.source === 'customer') fresh.push(o); });
    S.seen = new Set(S.orders.map(o => o.id));
    if (fresh.length) {
      chime(3); haptic([250, 120, 250]);
      toast('🔔 Naya order: ' + fresh[0].customer_name + ' · ' + money(fresh[0].total), 'ok');
      speak('Naya order aaya hai');
    }
    S.onOrders && S.onOrders(S.orders, fresh);
  };
  S.startLive = function () {
    S.refresh();
    let t; const deb = () => { clearTimeout(t); t = setTimeout(S.refresh, 400); };
    sb.channel('orders-live').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, deb).subscribe();
    setInterval(S.refresh, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) S.refresh(); });
  };
  S.find = id => S.orders.find(o => o.id === Number(id));

  /* ---------- order card ---------- */
  S.card = function (o, opts = {}) {
    const items = (o.items || []).map(i => `<div><b>${i.qty}×</b><span class="grow">${esc(i.name)}</span><span class="muted">${money(i.price * i.qty)}</span></div>`).join('');
    const where = o.order_type === 'delivery' ? `<a href="https://maps.google.com/?q=${encodeURIComponent(o.address || '')}" target="_blank" rel="noopener">📍 ${esc(o.address)}</a>`
      : o.order_type === 'dine_in' ? `🪑 Table ${esc(o.table_no)}` : '🛍️ Khud lene aayenge';
    const paid = o.payment_status === 'paid';
    const payLine = `${PAY_LABEL[o.payment_method]}${o.utr ? ' · UTR <b>' + esc(o.utr) + '</b>' : ''} <span class="pill ${paid ? 'green' : 'orange'}">${paid ? 'Paid' : o.payment_status === 'refunded' ? 'Refunded' : 'Pending'}</span>`;
    const open = o.status !== 'completed' && o.status !== 'cancelled';
    const nl = nextLabel(o);
    return `<div class="ocard st-${o.status} ${opts.flash ? 'newflash' : ''}" data-oid="${o.id}">
      <div class="row between"><div><b style="font-size:17px">#${esc(o.order_no)}</b> <span class="pill blue">${TYPE_LABEL[o.order_type]}</span></div>
        <span class="xs muted">${fmtTime(o.created_at)} · ${ago(o.created_at)}</span></div>
      <div class="mt8 small"><b>${esc(o.customer_name)}</b>${o.phone && o.phone !== '-' ? ` · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : ''}</div>
      <div class="small muted mt8">${where}</div>
      <div class="items">${items}</div>
      ${o.note ? `<div class="small mb8">📝 <i>${esc(o.note)}</i></div>` : ''}
      <div class="row between small"><div>${payLine}</div><b style="font-size:18px">${money(o.total)}</b></div>
      ${o.delivery_fee > 0 ? `<div class="xs muted right">(delivery ${money(o.delivery_fee)} shaamil)</div>` : ''}
      ${o.status === 'cancelled' ? `<div class="small mt8" style="color:var(--red)">Cancelled: ${esc(o.cancel_reason || '')}</div>` : `<div class="mt8"><span class="pill ${o.status === 'completed' ? 'green' : 'orange'}">${STATUS_LABEL[o.status]}</span></div>`}
      <div class="acts">
        ${open ? `<button class="btn red sm" data-act="reject" data-id="${o.id}">Reject</button>` : ''}
        ${open && o.payment_status === 'pending' && o.payment_method === 'upi' ? `<button class="btn blue sm" data-act="paid" data-id="${o.id}">Payment mili ✓</button>` : ''}
        <button class="btn sec sm" data-act="print" data-id="${o.id}">🖨 KOT</button>
        ${opts.owner && !open ? `<button class="btn red sm" data-act="delete" data-id="${o.id}">Delete</button>` : ''}
        ${open && nl ? `<button class="btn green" data-act="next" data-id="${o.id}">${nl}</button>` : ''}
      </div></div>`;
  };

  S.bindCards = function (container) {
    container.addEventListener('click', async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const o = S.find(b.dataset.id); if (!o) return;
      b.disabled = true;
      try { await S.act(b.dataset.act, o); } finally { b.disabled = false; }
    });
  };

  S.act = async function (act, o) {
    if (act === 'print') return S.printKOT(o);
    if (act === 'next') {
      const n = nextStatus(o); if (!n) return;
      const patch = { status: n, handled_by: S.me.id };
      if (n === 'completed') {
        if (o.payment_status === 'pending' && o.payment_method === 'upi' && !await confirmBox('UPI payment verify nahi hui. Phir bhi complete karein?', 'Haan, complete')) return;
        if (o.payment_status === 'pending' && o.payment_method !== 'upi') patch.payment_status = 'paid';
      }
      return S.update(o, patch);
    }
    if (act === 'paid') return S.update(o, { payment_status: 'paid' });
    if (act === 'reject') return S.rejectSheet(o);
    if (act === 'delete') { if (await confirmBox('Ye order hamesha ke liye delete karein?', 'Delete', true)) { const { error } = await sb.from('orders').delete().eq('id', o.id); if (error) return toast(error.message, 'err'); toast('Delete ho gaya'); S.refresh(); } }
  };

  S.update = async function (o, patch) {
    const { error } = await sb.from('orders').update(patch).eq('id', o.id);
    if (error) return toast('Update nahi hua: ' + error.message, 'err');
    Object.assign(o, patch); haptic(12); S.onOrders && S.onOrders(S.orders, []); S.refresh();
  };

  S.rejectSheet = function (o) {
    const reasons = ['Item khatam ho gaya', 'Restaurant abhi band hai', 'Delivery area se bahar', 'Payment verify nahi hui', 'Customer ke kehne par'];
    const sh = sheet(`<div class="sh-head"><h3>Order reject karein</h3><button class="iconbtn" data-close>✕</button></div>
      <div class="sh-body"><div class="list">${reasons.map(r => `<button class="li chev" data-r="${esc(r)}" style="width:100%;text-align:left"><span class="grow t">${esc(r)}</span></button>`).join('')}</div>
      <div class="pad"><input class="inp" id="rj-other" placeholder="Dusra karan likhein..."><button class="btn red block mt8" id="rj-go">Is karan se reject karein</button></div></div>`);
    const go = async r => { if (!r) return; sh.close(); S.update(o, { status: 'cancelled', cancel_reason: r, handled_by: S.me.id }); };
    $$('[data-r]', sh.el).forEach(b => b.onclick = () => go(b.dataset.r));
    $('#rj-go', sh.el).onclick = () => go($('#rj-other', sh.el).value.trim());
  };

  /* ---------- print ---------- */
  function printHTML(html) {
    let a = $('#print-area'); if (!a) { a = document.createElement('div'); a.id = 'print-area'; document.body.appendChild(a); }
    a.innerHTML = html; setTimeout(() => window.print(), 150);
  }
  S.printHTML = printHTML;
  S.printKOT = function (o) {
    printHTML(`<div style="font:14px monospace;padding:6px;width:72mm"><div style="text-align:center;font-weight:bold;font-size:16px">SONE RESTAURANT</div><div style="text-align:center">KOT · #${esc(o.order_no)}</div>
      <div>${TYPE_LABEL[o.order_type]} ${o.table_no ? '· Table ' + esc(o.table_no) : ''}</div><div>${fmtDT(o.created_at)}</div><hr>
      ${(o.items || []).map(i => `<div style="display:flex;justify-content:space-between;font-weight:bold"><span>${esc(i.name)}</span><span>x${i.qty}</span></div>`).join('')}
      ${o.note ? '<hr><div>Note: ' + esc(o.note) + '</div>' : ''}<hr><div>${esc(o.customer_name)}</div></div>`);
  };

  /* ---------- waiter takes a table order ---------- */
  S.loadMenu = async function () {
    if (S.menu.length) return S.menu;
    const { data } = await sb.from('menu_items').select('*').eq('available', true).order('sort');
    S.menu = data || []; return S.menu;
  };
  S.takeOrder = async function () {
    await S.loadMenu();
    const cart = {}; let q = '';
    const sh = sheet(`<div class="sh-head"><h3>Table ka order</h3><button class="iconbtn" data-close>✕</button></div>
      <div class="pad" style="padding-top:0"><div class="row gap8"><input class="inp" id="to-table" placeholder="Table no." style="max-width:110px" inputmode="text"><div class="search grow">${ICON.search}<input id="to-q" placeholder="Dish dhoondhein"></div></div></div>
      <div class="sh-body" id="to-list"></div>
      <div class="sh-foot"><input class="inp mb8" id="to-note" placeholder="Note (kam teekha, bina pyaz...)"><button class="btn block" id="to-go">Order bhejein</button></div>`, { full: true });
    const list = $('#to-list', sh.el);
    const total = () => Object.entries(cart).reduce((s, [id, n]) => s + n * S.menu.find(m => m.id == id).price, 0);
    const count = () => Object.values(cart).reduce((s, n) => s + n, 0);
    function render() {
      const m = S.menu.filter(i => !q || i.name.toLowerCase().includes(q)).slice(0, 80);
      list.innerHTML = `<div class="list">${m.map(i => `<div class="li"><div class="grow"><div class="t">${esc(i.name)}</div><div class="s">${money(i.price)} · ${esc(i.category)}</div></div>
        <div class="row gap8">${cart[i.id] ? `<button class="iconbtn" data-d="${i.id}">−</button><b>${cart[i.id]}</b>` : ''}<button class="iconbtn" data-a="${i.id}" style="background:var(--brand);color:#fff">+</button></div></div>`).join('') || '<div class="li muted">Kuch nahi mila</div>'}</div>`;
      $('#to-go', sh.el).textContent = count() ? `Order bhejein · ${count()} items · ${money(total())}` : 'Order bhejein';
    }
    list.onclick = e => { const a = e.target.closest('[data-a]'), d = e.target.closest('[data-d]');
      if (a) cart[a.dataset.a] = (cart[a.dataset.a] || 0) + 1; if (d) { cart[d.dataset.d]--; if (cart[d.dataset.d] <= 0) delete cart[d.dataset.d]; } if (a || d) { haptic(8); const y = list.scrollTop; render(); list.scrollTop = y; } };
    $('#to-q', sh.el).oninput = e => { q = e.target.value.toLowerCase(); render(); };
    $('#to-go', sh.el).onclick = async () => {
      const table = $('#to-table', sh.el).value.trim(); if (!table) return toast('Table number likhein', 'err'); if (!count()) return toast('Koi dish chunein', 'err');
      const items = Object.entries(cart).map(([id, n]) => { const m = S.menu.find(x => x.id == id); return { id: m.id, name: m.name, price: Number(m.price), qty: n, veg: m.is_veg }; });
      const t = total();
      const { error } = await sb.from('orders').insert({ customer_name: 'Table ' + table, phone: '-', order_type: 'dine_in', table_no: table, items, subtotal: t, total: t,
        payment_method: 'counter', status: 'accepted', source: 'waiter', handled_by: S.me.id, note: $('#to-note', sh.el).value.trim() || null });
      if (error) return toast(error.message, 'err');
      sh.close(); toast('Order kitchen ko bhej diya ✓', 'ok'); S.refresh();
    };
    render();
  };
})();
