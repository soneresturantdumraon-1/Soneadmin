/* Owner app: dashboard, online orders, more (settings / staff / udhaar / export) */
(function () {
  const C = window.SONE_CONFIG;
  ['t1:home', 't2:list', 't3:receipt', 't4:fork', 't5:more'].forEach(s => { const [i, n] = s.split(':'); $('#' + i).innerHTML = ICON[n]; });
  $('#today-str').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  window.Owner = Object.assign(window.Owner || {}, { SET: {}, tab: null });
  let SALES = [];                 // pos_sales (last 7 days)
  let ofilter = 'all';

  function tab(n) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'v-' + n));
    $$('#tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === n));
    scrollTo(0, 0); Owner.tab = n;
    if (n === 'home') renderHome(); if (n === 'orders') renderOrders(Staff.orders); if (n === 'pos') window.POSUI && POSUI.show(); if (n === 'menu') window.MenuUI && MenuUI.show(); if (n === 'more') renderMore();
  }
  window.Owner.goto = tab;
  $('#tabbar').onclick = e => { const b = e.target.closest('button'); if (b) tab(b.dataset.tab); };

  /* ---------- settings ---------- */
  Owner.loadSettings = async () => { const { data } = await sb.from('settings').select('*'); Owner.SET = {}; (data || []).forEach(r => Owner.SET[r.key] = r.value); return Owner.SET; };
  Owner.saveSettings = async obj => {
    const rows = Object.entries(obj).map(([key, value]) => ({ key, value }));
    const { error } = await sb.from('settings').upsert(rows); if (error) { toast(error.message, 'err'); return false; }
    Object.assign(Owner.SET, obj); return true;
  };

  /* ---------- dashboard ---------- */
  async function renderHome() {
    const box = $('#home'); const days = []; for (let i = 6; i >= 0; i--) days.push(dayStr(new Date(Date.now() - i * 86400e3)));
    const [s, u] = await Promise.all([
      sb.from('pos_sales').select('*').gte('bill_date', days[0]).is('deleted_at', null),
      sb.from('pos_sales').select('udhaar').gt('udhaar', 0).is('deleted_at', null)]);
    SALES = s.data || []; const udhaar = (u.data || []).reduce((a, r) => a + Number(r.udhaar), 0);
    const today = days[6], ord = Staff.orders.filter(o => o.status !== 'cancelled');
    const oDay = d => ord.filter(o => dayStr(new Date(o.created_at)) === d), pDay = d => SALES.filter(x => x.bill_date === d);
    const posAmt = x => Number(x.subtotal) - Number(x.discount);
    const per = days.map(d => ({ d, online: oDay(d).reduce((a, o) => a + Number(o.total), 0), pos: pDay(d).reduce((a, x) => a + posAmt(x), 0) }));
    const T = per[6], tOrd = oDay(today), tPos = pDay(today);
    const newN = Staff.orders.filter(o => o.status === 'placed').length, verify = Staff.orders.filter(o => o.payment_method === 'upi' && o.payment_status === 'pending' && o.status !== 'cancelled').length;
    const cash = tPos.reduce((a, x) => a + Number(x.cash), 0) + tOrd.filter(o => o.payment_status === 'paid' && o.payment_method !== 'upi').reduce((a, o) => a + Number(o.total), 0);
    const onl = tPos.reduce((a, x) => a + Number(x.online), 0) + tOrd.filter(o => o.payment_status === 'paid' && o.payment_method === 'upi').reduce((a, o) => a + Number(o.total), 0);
    const top = {}; tOrd.forEach(o => (o.items || []).forEach(i => top[i.name] = (top[i.name] || 0) + i.qty)); tPos.forEach(x => (x.items || []).forEach(i => top[i.name] = (top[i.name] || 0) + i.qty));
    const topL = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = Math.max(1, ...per.map(p => p.online + p.pos)), W = 320, H = 130, bw = 30, gap = (W - 7 * bw) / 8;
    const bars = per.map((p, i) => { const x = gap + i * (bw + gap), h1 = p.pos / max * 100, h2 = p.online / max * 100, dn = new Date(p.d).toLocaleDateString('en-IN', { weekday: 'short' }).slice(0, 3);
      return `<g class="${i === 6 ? 'today' : 'old'}"><rect class="bar2" x="${x}" y="${108 - h1 - h2}" width="${bw}" height="${h2}" rx="3"/><rect class="bar" x="${x}" y="${108 - h1}" width="${bw}" height="${h1}" rx="3"/></g>
        <text x="${x + bw / 2}" y="124" text-anchor="middle">${dn}</text><text x="${x + bw / 2}" y="${103 - h1 - h2}" text-anchor="middle">${p.pos + p.online ? Math.round((p.pos + p.online) / 100) / 10 + 'k' : ''}</text>`; }).join('');
    const on = String(Owner.SET.accepting_orders) !== 'false';
    box.innerHTML = `
      <div class="card" style="margin-top:12px"><div class="row between"><div><div class="bold">Online ordering</div><div class="small muted" id="acc-sub">${on ? 'Customers abhi order kar sakte hain' : 'Band hai — customers order nahi kar sakte'}</div></div>
        <label class="sw"><input type="checkbox" id="acc-sw" ${on ? 'checked' : ''}><i></i></label></div></div>
      ${newN || verify ? `<div class="card" style="background:rgba(255,149,0,.12)"><button class="row between" id="go-orders" style="width:100%;text-align:left"><div><div class="bold">${newN ? `🔔 ${newN} naya order` : ''}${newN && verify ? ' · ' : ''}${verify ? `💳 ${verify} UPI payment verify karni hai` : ''}</div><div class="small muted">Dekhne ke liye tap karein</div></div><span class="muted">›</span></button></div>` : ''}
      <div class="section-h" style="padding-top:6px">Aaj ka hisaab</div>
      <div class="tiles">
        <div class="tile" style="grid-column:span 2;background:var(--brand);color:#fff"><div class="l" style="color:rgba(255,255,255,.85)">Aaj ki kul sale</div><div class="v">${money(T.online + T.pos)}</div></div>
        <div class="tile"><div class="l">Online orders (${tOrd.length})</div><div class="v">${money(T.online)}</div></div>
        <div class="tile"><div class="l">Counter bills (${tPos.length})</div><div class="v">${money(T.pos)}</div></div>
        <div class="tile"><div class="l">💵 Cash mila</div><div class="v">${money(cash)}</div></div>
        <div class="tile"><div class="l">📱 Online/UPI mila</div><div class="v">${money(onl)}</div></div>
        <div class="tile" style="grid-column:span 2"><div class="l">Total udhaar baaki (sab bills)</div><div class="v" style="color:${udhaar ? 'var(--red)' : 'inherit'}">${money(udhaar)}</div></div>
      </div>
      <div class="section-h">Pichhle 7 din</div>
      <div class="card chart"><svg viewBox="0 0 ${W} ${H}" width="100%"><line x1="0" x2="${W}" y1="108" y2="108" stroke="var(--sep)"/>${bars}</svg>
        <div class="row gap8 xs muted" style="justify-content:center;padding-bottom:4px"><span style="color:var(--brand)">■</span>Counter <span style="color:var(--blue)">■</span>Online</div></div>
      <div class="section-h">Aaj ke top dishes</div>
      <div class="card">${topL.length ? topL.map((t, i) => `<div class="rank"><span class="n">${i + 1}</span><span class="grow">${esc(t[0])}</span><b>${t[1]}</b></div>`).join('') : '<div class="muted small">Aaj abhi koi sale nahi.</div>'}</div>
      <div style="height:20px"></div>`;
    const sw = $('#acc-sw'); sw.onchange = async () => { const ok = await Owner.saveSettings({ accepting_orders: sw.checked }); if (!ok) sw.checked = !sw.checked; else { toast(sw.checked ? 'Online orders chalu ✓' : 'Online orders band kiye', sw.checked ? 'ok' : ''); $('#acc-sub').textContent = sw.checked ? 'Customers abhi order kar sakte hain' : 'Band hai — customers order nahi kar sakte'; } };
    const g = $('#go-orders'); if (g) g.onclick = () => tab('orders');
  }
  $('#home-refresh').onclick = async () => { await Staff.refresh(); renderHome(); };

  /* ---------- online orders ---------- */
  $('#o-date').value = dayStr();
  $('#o-date').onchange = () => renderOrders(Staff.orders);
  $('#o-filter').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; ofilter = b.dataset.f; $$('#o-filter button').forEach(x => x.classList.toggle('on', x === b)); renderOrders(Staff.orders); };
  function renderOrders(orders) {
    const nNew = orders.filter(o => o.status === 'placed').length, dot = $('#new-dot'); dot.textContent = nNew; dot.classList.toggle('hide', !nNew);
    if (Owner.tab === 'home') renderHome();
    if (Owner.tab !== 'orders') return;
    const day = $('#o-date').value || dayStr();
    let l = orders.filter(o => dayStr(new Date(o.created_at)) === day || (o.status !== 'completed' && o.status !== 'cancelled' && day === dayStr()));
    if (ofilter === 'new') l = l.filter(o => o.status === 'placed'); if (ofilter === 'active') l = l.filter(o => !['completed', 'cancelled', 'placed'].includes(o.status));
    if (ofilter === 'done') l = l.filter(o => o.status === 'completed'); if (ofilter === 'cancelled') l = l.filter(o => o.status === 'cancelled');
    const sum = l.filter(o => o.status !== 'cancelled').reduce((a, o) => a + Number(o.total), 0);
    $('#olist').innerHTML = (l.length ? `<div class="small muted" style="padding:0 20px 10px">${l.length} orders · ${money(sum)}</div>` + l.map(o => Staff.card(o, { owner: true })).join('') : `<div class="empty"><div class="big">🧾</div>Is din koi order nahi</div>`);
  }
  Staff.bindCards($('#olist'));
  Staff.onOrders = (orders) => renderOrders(orders);

  /* ---------- more ---------- */
  function renderMore() {
    $('#more').innerHTML = `
      <div class="section-h" style="padding-top:14px">Restaurant</div>
      <div class="list">
        <button class="li chev" data-m="settings" style="width:100%;text-align:left"><span class="grow t">⚙️ Delivery, minimum order, UPI</span></button>
        <button class="li chev" data-m="staff" style="width:100%;text-align:left"><span class="grow t">👥 Staff (waiter) accounts</span></button>
        <button class="li chev" data-m="seed" style="width:100%;text-align:left"><span class="grow t">📥 Poora menu load karein (211 items)</span></button>
        <button class="li chev" data-m="udhaar" style="width:100%;text-align:left"><span class="grow t">📒 Udhaar (baaki payment)</span></button>
        <button class="li chev" data-m="export" style="width:100%;text-align:left"><span class="grow t">📤 Hisaab download (CSV)</span></button>
      </div>
      <div class="section-h">App</div>
      <div class="list">
        <div class="li"><div class="grow t">🔔 Naye order ki awaaz</div><label class="sw"><input type="checkbox" id="sw-snd" ${ls.get('sone_mute', false) ? '' : 'checked'}><i></i></label></div>
        <button class="li" data-m="test" style="width:100%;text-align:left"><span class="grow t" style="color:var(--blue)">Awaaz test karein</span></button>
        <button class="li" data-m="logout" style="width:100%;text-align:left"><span class="grow t" style="color:var(--red)">Logout</span></button>
      </div>
      <p class="xs muted" style="text-align:center;padding:24px">Sone Owner · ${esc(Staff.me ? Staff.me.name : '')}</p>`;
  }
  $('#more').onclick = e => {
    const b = e.target.closest('[data-m]'); if (!b) return; const m = b.dataset.m;
    if (m === 'settings') settingsSheet(); if (m === 'staff') staffSheet(); if (m === 'udhaar') udhaarSheet(); if (m === 'seed') Owner.importMenu(); if (m === 'export') exportSheet();
    if (m === 'test') { chime(2); speak('Naya order aaya hai'); } if (m === 'logout') Staff.logout();
  };
  document.addEventListener('change', e => { if (e.target.id === 'sw-snd') ls.set('sone_mute', !e.target.checked); });

  async function settingsSheet() {
    await Owner.loadSettings(); const S = Owner.SET, v = (k, d) => S[k] == null ? d : S[k];
    const sh = sheet(`<div class="sh-head"><h3>Settings</h3><button class="iconbtn" data-close>✕</button></div><div class="sh-body">
      <div class="list"><div class="li"><div class="grow t">🛵 Home delivery</div><label class="sw"><input type="checkbox" id="s-del" ${String(v('delivery_enabled', true)) !== 'false' ? 'checked' : ''}><i></i></label></div></div>
      <div class="card mt12">
        <label class="field"><span>Delivery fee (₹)</span><input class="inp" id="s-fee" type="number" inputmode="decimal" value="${v('delivery_fee', 30)}"></label>
        <label class="field"><span>Is amount se upar delivery FREE (₹) — 0 = kabhi nahi</span><input class="inp" id="s-free" type="number" inputmode="decimal" value="${v('free_delivery_above', 500)}"></label>
        <label class="field"><span>Delivery ke liye minimum order (₹)</span><input class="inp" id="s-min" type="number" inputmode="decimal" value="${v('min_order', 100)}"></label>
        <label class="field"><span>Timing (customer ko dikhega)</span><input class="inp" id="s-hrs" value="${esc(v('open_hours', '12:00 PM - 9:00 PM'))}"></label>
        <label class="field"><span>Delivery area (km)</span><input class="inp" id="s-km" type="number" inputmode="decimal" value="${v('delivery_km', 5)}"></label>
        <label class="field"><span>UPI ID</span><input class="inp" id="s-upi" autocapitalize="off" value="${esc(v('upi_id', ''))}"></label>
        <label class="field" style="margin:0"><span>UPI par dikhne wala naam</span><input class="inp" id="s-upin" value="${esc(v('upi_name', 'Sone Restaurant'))}"></label></div>
      <p class="xs muted pad">Dhyan dein: customer app ka QR image (qr.png) alag hai. UPI ID badalne par qr.png bhi nayi se badlein.</p></div>
      <div class="sh-foot"><button class="btn block" id="s-save">Save karein</button></div>`, { full: true });
    $('#s-save', sh.el).onclick = async () => {
      const n = id => Math.max(0, Number($(id, sh.el).value) || 0), upi = $('#s-upi', sh.el).value.trim();
      if (!/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(upi)) return toast('UPI ID sahi likhein (jaise name@bank)', 'err');
      if (await Owner.saveSettings({ delivery_enabled: $('#s-del', sh.el).checked, delivery_fee: n('#s-fee'), free_delivery_above: n('#s-free'), min_order: n('#s-min'), open_hours: $('#s-hrs', sh.el).value.trim() || '12:00 PM - 9:00 PM', delivery_km: n('#s-km'), upi_id: upi, upi_name: $('#s-upin', sh.el).value.trim() || 'Sone Restaurant' })) { toast('Settings save ho gayi ✓', 'ok'); sh.close(); }
    };
  }

  async function staffSheet() {
    const sh = sheet(`<div class="sh-head"><h3>Staff</h3><button class="iconbtn" data-close>✕</button></div><div class="sh-body" id="st-body"><div class="spin"></div></div>`, { full: true });
    async function draw() {
      const { data } = await sb.from('staff').select('*').order('created_at'); const body = $('#st-body', sh.el);
      body.innerHTML = `<div class="list">${(data || []).map(s => `<div class="li"><div class="grow"><div class="t">${esc(s.name)}</div><div class="s">${s.role === 'owner' ? 'Owner' : 'Waiter'}${s.active ? '' : ' · band'}</div></div>${s.id === Staff.me.id ? '<span class="pill">Aap</span>' : `<label class="sw"><input type="checkbox" data-sid="${s.id}" ${s.active ? 'checked' : ''}><i></i></label>`}</div>`).join('')}</div>
        <div class="section-h">Naya waiter jodein</div><div class="card"><label class="field"><span>Naam</span><input class="inp" id="w-name"></label>
        <label class="field"><span>Email (login ke liye)</span><input class="inp" id="w-mail" type="email" autocapitalize="off"></label>
        <label class="field"><span>Password (kam se kam 6 akshar)</span><input class="inp" id="w-pass" type="text" autocapitalize="off"></label>
        <button class="btn block" id="w-add">Waiter banayein</button></div>
        <p class="xs muted pad">Agar naya waiter login na kar paye to Supabase → Authentication → Providers → Email mein "Confirm email" OFF karein.</p>`;
      $$('[data-sid]', body).forEach(c => c.onchange = async () => { const { error } = await sb.from('staff').update({ active: c.checked }).eq('id', c.dataset.sid); if (error) { toast(error.message, 'err'); c.checked = !c.checked; } else toast(c.checked ? 'Chalu kiya' : 'Band kiya'); });
      $('#w-add', body).onclick = async () => {
        const name = $('#w-name', body).value.trim(), email = $('#w-mail', body).value.trim(), password = $('#w-pass', body).value;
        if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 6) return toast('Naam, sahi email aur 6+ akshar ka password likhein', 'err');
        const tmp = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        const { data: r, error } = await tmp.auth.signUp({ email, password });
        if (error) return toast(error.message, 'err'); if (!r.user || (r.user.identities && !r.user.identities.length)) return toast('Ye email pehle se registered hai', 'err');
        const { error: e2 } = await sb.from('staff').insert({ id: r.user.id, name, role: 'waiter' }); if (e2) return toast(e2.message, 'err');
        toast('Waiter ban gaya ✓ (login: ' + email + ')', 'ok'); draw();
      };
    }
    draw();
  }

  async function udhaarSheet() {
    const sh = sheet(`<div class="sh-head"><h3>Udhaar baaki</h3><button class="iconbtn" data-close>✕</button></div><div class="sh-body" id="u-body"><div class="spin"></div></div>`, { full: true });
    async function draw() {
      const { data, error } = await sb.from('pos_sales').select('*').gt('udhaar', 0).is('deleted_at', null).order('created_at', { ascending: false }); const body = $('#u-body', sh.el);
      if (error) return body.innerHTML = '<div class="empty">' + esc(error.message) + '</div>';
      if (!data.length) return body.innerHTML = '<div class="empty"><div class="big">🎉</div>Koi udhaar baaki nahi</div>';
      const tot = data.reduce((a, r) => a + Number(r.udhaar), 0);
      body.innerHTML = `<div class="card"><div class="small muted">Kul baaki</div><div style="font-size:28px;font-weight:700;color:var(--red)">${money(tot)}</div></div><div class="list">${data.map(r => `<div class="li"><div class="grow"><div class="t">${esc(r.customer_name || 'Naam nahi')}</div><div class="s">Bill #${r.bill_no} · ${r.bill_date}</div></div><b>${money(r.udhaar)}</b><button class="btn sm green" data-rcv="${r.id}">Mil gaya</button></div>`).join('')}</div>`;
      $$('[data-rcv]', body).forEach(b => b.onclick = async () => { const r = data.find(x => x.id == b.dataset.rcv); if (!await confirmBox(`${money(r.udhaar)} cash mil gaya?`, 'Haan')) return;
        const { error: e } = await sb.from('pos_sales').update({ cash: Number(r.cash) + Number(r.udhaar), udhaar: 0 }).eq('id', r.id); if (e) return toast(e.message, 'err'); toast('Udhaar clear ✓', 'ok'); draw(); });
    }
    draw();
  }

  function exportSheet() {
    const sh = sheet(`<div class="sh-head"><h3>Hisaab download</h3><button class="iconbtn" data-close>✕</button></div><div class="sh-body"><div class="card">
      <label class="field"><span>Kab se</span><input class="inp" type="date" id="x-from" value="${dayStr(new Date(Date.now() - 6 * 86400e3))}"></label>
      <label class="field"><span>Kab tak</span><input class="inp" type="date" id="x-to" value="${dayStr()}"></label>
      <button class="btn block" id="x-go">CSV download karein</button></div><p class="xs muted pad">Excel / Google Sheets mein khul jayegi. Online orders aur counter bills dono.</p></div>`);
    $('#x-go', sh.el).onclick = async () => {
      const f = $('#x-from', sh.el).value, t = $('#x-to', sh.el).value; if (!f || !t || f > t) return toast('Date sahi chunein', 'err');
      const [o, p] = await Promise.all([
        sb.from('orders').select('*').gte('created_at', startOfDay(f).toISOString()).lt('created_at', new Date(startOfDay(t).getTime() + 86400e3).toISOString()).order('created_at').limit(5000),
        sb.from('pos_sales').select('*').gte('bill_date', f).lte('bill_date', t).is('deleted_at', null).order('bill_date')]);
      if (o.error || p.error) return toast((o.error || p.error).message, 'err');
      const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"', rows = [['Type', 'Date', 'Time', 'No', 'Customer', 'Phone', 'Order type', 'Items', 'Total', 'Discount', 'Cash', 'Online', 'Udhaar', 'Payment', 'Status']];
      o.data.forEach(x => rows.push(['Online', dayStr(new Date(x.created_at)), fmtTime(x.created_at), x.order_no, x.customer_name, x.phone, x.order_type, (x.items || []).map(i => i.qty + 'x ' + i.name).join('; '), x.total, x.discount, '', '', '', x.payment_method + '/' + x.payment_status, x.status]));
      p.data.forEach(x => rows.push(['POS', x.bill_date, fmtTime(x.created_at), x.bill_no, x.customer_name || '', '', 'counter', (x.items || []).map(i => i.qty + 'x ' + i.name).join('; '), Number(x.subtotal) - Number(x.discount), x.discount, x.cash, x.online, x.udhaar, '', 'billed']));
      const blob = new Blob(['﻿' + rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `sone_hisaab_${f}_to_${t}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('Download ho gaya ✓', 'ok');
    };
  }

  /* ---------- boot ---------- */
  Staff.init({
    roles: ['owner'], title: 'Owner Login', subtitle: 'Sone Restaurant · poora control',
    async onReady() { Staff.fromDate = new Date(Date.now() - 8 * 86400e3).toISOString(); await Owner.loadSettings(); Staff.startLive(); tab('home'); }
  });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
