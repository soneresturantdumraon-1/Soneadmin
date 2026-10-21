/* Owner app: counter billing (POS) + menu management */
(function () {
  const C = window.SONE_CONFIG;
  $('#ic-s').innerHTML = ICON.search; $('#ic-s2').innerHTML = ICON.search;
  let MENU = [], loaded = false;
  async function loadMenu(force) {
    if (loaded && !force) return MENU;
    const { data, error } = await sb.from('menu_items').select('*').order('sort').order('id');
    if (error) { toast('Menu load nahi hua: ' + error.message, 'err'); return MENU; }
    MENU = data || []; loaded = true; return MENU;
  }
  window.Owner = window.Owner || {};
  Owner.importMenu = async function () {
    const seed = window.SONE_MENU_SEED || []; if (!seed.length) return toast('Menu data nahi mila', 'err');
    if (!await confirmBox(`${seed.length} items ka poora menu load karein? Jo item pehle se hai uska daam nahi badlega.`, 'Load karein')) return;
    let done = 0;
    for (let i = 0; i < seed.length; i += 50) {
      const { error } = await sb.from('menu_items').upsert(seed.slice(i, i + 50), { onConflict: 'name', ignoreDuplicates: true });
      if (error) return toast('Menu load nahi hua: ' + error.message, 'err'); done += Math.min(50, seed.length - i);
    }
    toast(`${done} items ka menu load ho gaya ✓`, 'ok'); await loadMenu(true); drawMenu(); POSUI.show && POSUI.show();
  };
  const cats = () => [...new Set(MENU.map(m => m.category))];

  /* =============== POS =============== */
  let bill = [], q = '', cat = '';
  const total = () => bill.reduce((a, l) => a + l.price * l.qty, 0);
  const cnt = () => bill.reduce((a, l) => a + l.qty, 0);
  window.POSUI = {
    async show() { await loadMenu(); draw(); }
  };
  function draw() {
    const list = MENU.filter(m => m.available && (!q || m.name.toLowerCase().includes(q)) && (!cat || m.category === cat)).slice(0, 60);
    $('#pos-results').innerHTML = `<div class="chips" style="padding-top:10px"><button class="chip ${!cat ? 'on' : ''}" data-c="">Sab</button>${cats().map(c => `<button class="chip ${cat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div style="background:var(--card)">${list.map(m => `<div class="pr"><span class="vegmark ${m.is_veg ? 'veg' : 'nonveg'}" style="flex:none;width:14px;height:14px;border:1.6px solid;border-radius:3px;color:${m.is_veg ? '#0f8a3c' : '#c62828'};position:relative"></span><div class="grow"><div>${esc(m.name)}</div><div class="small muted">${money(m.price)}</div></div>
        <button class="btn sec sm" data-half="${m.id}" title="Half">½</button><button class="btn sm" data-add="${m.id}">＋</button></div>`).join('') || '<div class="empty">Kuch nahi mila</div>'}</div><div style="height:90px"></div>`;
    $('#pos-bill').innerHTML = bill.length ? `<div class="billfoot"><button class="btn green block" id="pos-open">Bill dekhein · ${cnt()} items · ${money(total())}</button></div>` : '';
    const o = $('#pos-open'); if (o) o.onclick = billSheet;
  }
  $('#pos-q').oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
  $('#pos-results').onclick = e => {
    const c = e.target.closest('[data-c]'), a = e.target.closest('[data-add]'), h = e.target.closest('[data-half]');
    if (c) { cat = c.dataset.c; draw(); }
    if (a || h) { const m = MENU.find(x => x.id == (a || h).dataset[a ? 'add' : 'half']), half = !!h, key = m.id + (half ? 'h' : ''); const ln = bill.find(l => l.key === key);
      if (ln) ln.qty++; else bill.push({ key, id: m.id, name: m.name + (half ? ' (Half)' : ''), price: half ? Math.round(m.price / 2) : Number(m.price), qty: 1 });
      haptic(8); toast(m.name + (half ? ' ½' : '') + ' ✓'); const y = scrollY; draw(); scrollTo(0, y); }
  };

  function billSheet() {
    let disc = 0, cash = 0, online = 0, auto = true;
    const sh = sheet(`<div class="sh-head"><h3>Bill</h3><button class="iconbtn" data-close>✕</button></div><div class="sh-body" id="bs"></div><div class="sh-foot"><button class="btn block" id="bs-save">Save & Print</button></div>`, { full: true });
    const body = $('#bs', sh.el);
    const payable = () => Math.max(0, total() - disc);
    function render() {
      if (!bill.length) { sh.close(); draw(); return; }
      if (auto) { cash = payable() - online; if (cash < 0) cash = 0; }
      const ud = Math.max(0, payable() - cash - online);
      body.innerHTML = `<div class="list">${bill.map((l, i) => `<div class="pos-line"><div class="grow"><div>${esc(l.name)}</div><div class="small muted">${money(l.price)}</div></div>
        <div class="mini"><button data-m="${i}">−</button><span>${l.qty}</span><button data-p="${i}">+</button></div><b style="min-width:62px;text-align:right">${money(l.price * l.qty)}</b></div>`).join('')}</div>
        <div class="card mt12">
          <div class="row gap8"><label class="field grow" style="margin:0"><span>Customer naam</span><input class="inp" id="b-name" value="${esc(ctx.name)}"></label><label class="field" style="margin:0;width:90px"><span>Table</span><input class="inp" id="b-table" value="${esc(ctx.table)}"></label></div>
          <div class="row gap8 mt12"><label class="field grow" style="margin:0"><span>Discount ₹</span><input class="inp" id="b-disc" type="number" inputmode="decimal" value="${disc || ''}"></label>
          <label class="field grow" style="margin:0"><span>Cash ₹</span><input class="inp" id="b-cash" type="number" inputmode="decimal" value="${cash || ''}"></label>
          <label class="field grow" style="margin:0"><span>Online ₹</span><input class="inp" id="b-online" type="number" inputmode="decimal" value="${online || ''}"></label></div>
          <div class="row between mt12"><span class="muted">Subtotal</span><b>${money(total())}</b></div>
          ${disc ? `<div class="row between"><span class="muted">Discount</span><b>− ${money(disc)}</b></div>` : ''}
          <div class="row between" style="font-size:20px;margin-top:6px"><b>Payable</b><b>${money(payable())}</b></div>
          ${ud > 0 ? `<div class="row between mt8" style="color:var(--red)"><b>Udhaar (baaki)</b><b>${money(ud)}</b></div>` : ''}
        </div>`;
      $$('[data-m]', body).forEach(b => b.onclick = () => { const l = bill[b.dataset.m]; l.qty--; if (l.qty <= 0) bill.splice(b.dataset.m, 1); keep(); render(); });
      $$('[data-p]', body).forEach(b => b.onclick = () => { bill[b.dataset.p].qty++; keep(); render(); });
      const num = id => Math.max(0, Number($(id, body).value) || 0);
      $('#b-disc', body).onchange = () => { keep(); disc = Math.min(num('#b-disc'), total()); auto = true; render(); };
      $('#b-cash', body).oninput = () => { auto = false; cash = num('#b-cash'); updUd(); };
      $('#b-online', body).onchange = () => { keep(); online = num('#b-online'); auto = true; render(); };
    }
    const ctx = { name: '', table: '' };
    const keep = () => { const n = $('#b-name', body), t = $('#b-table', body); if (n) ctx.name = n.value; if (t) ctx.table = t.value; };
    function updUd() { const ud = Math.max(0, payable() - cash - online); let el = $('#ud-live', body); /* sirf save par check */ }
    $('#bs-save', sh.el).onclick = async () => {
      keep(); if (!bill.length) return; const pay = payable(), ud = Math.max(0, pay - cash - online);
      if (ud > 0 && !ctx.name.trim()) return toast('Udhaar ke liye customer ka naam zaroori hai', 'err');
      if (cash + online > pay + 0.001) { if (!await confirmBox('Cash + Online payable se zyada hai. Phir bhi save karein?', 'Haan')) return; }
      const btn = $('#bs-save', sh.el); btn.disabled = true;
      try {
        const row = await saveBill({ items: bill.map(l => ({ name: l.name, price: l.price, qty: l.qty, total: l.price * l.qty })), subtotal: total(), discount: disc, cash, online, udhaar: ud, customer_name: ctx.name.trim() || null, table_no: ctx.table.trim() || null });
        bill = []; sh.close(); draw(); toast('Bill #' + row.bill_no + ' save ho gaya ✓', 'ok'); Staff.printHTML(receipt(row));
      } catch (e) { btn.disabled = false; toast('Bill save nahi hua: ' + (e.message || e), 'err'); }
    };
    render();
  }
  async function saveBill(b) {
    const today = dayStr();
    for (let t = 0; t < 3; t++) {
      const { data } = await sb.from('pos_sales').select('bill_no').eq('bill_date', today).order('bill_no', { ascending: false }).limit(1);
      const no = (data && data[0] ? data[0].bill_no : 0) + 1;
      const { data: ins, error } = await sb.from('pos_sales').insert({ ...b, bill_no: no, bill_date: today }).select().single();
      if (!error) return ins; if (error.code !== '23505') throw error;
    }
    throw new Error('Bill number ki dikkat, dobara try karein');
  }
  function receipt(b) {
    const pay = Number(b.subtotal) - Number(b.discount);
    return `<div class="receipt" style="width:72mm"><div style="text-align:center"><b style="font-size:17px">SONE RESTAURANT</b><br>${esc(C.ADDRESS.toUpperCase())}<br>Mob: ${C.WHATSAPP.slice(2)}</div><hr>
      <div style="display:flex;justify-content:space-between"><span>Bill No: ${b.bill_no}</span><span>${new Date(b.created_at || Date.now()).toLocaleDateString('en-IN')}</span></div>
      <div style="display:flex;justify-content:space-between"><span>${esc(b.customer_name || '')}</span><span>${b.table_no ? 'Table ' + esc(b.table_no) : ''}</span></div><hr>
      <table><tr><th>Item</th><th>Qty</th><th>Amt</th></tr>${(b.items || []).map(i => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${i.total}</td></tr>`).join('')}</table><hr>
      <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${money(b.subtotal)}</span></div>
      ${Number(b.discount) ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>- ${money(b.discount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:16px"><b>TOTAL</b><b>${money(pay)}</b></div>
      ${Number(b.udhaar) ? `<div style="display:flex;justify-content:space-between"><span>Baaki (udhaar)</span><span>${money(b.udhaar)}</span></div>` : ''}<hr><div style="text-align:center">Dhanyavaad! Phir aaiyega 🙏</div></div>`;
  }

  /* POS history */
  $('#pos-hist').onclick = () => {
    let day = dayStr(), del = false;
    const sh = sheet(`<div class="sh-head"><h3>Bill history</h3><button class="iconbtn" data-close>✕</button></div>
      <div class="pad" style="padding-top:0"><input class="inp" type="date" id="h-day" value="${day}"><div class="seg mt8" id="h-seg"><button class="on" data-d="0">Bills</button><button data-d="1">Deleted</button></div></div><div class="sh-body" id="h-body"></div>`, { full: true });
    async function load() {
      const body = $('#h-body', sh.el); body.innerHTML = '<div class="spin"></div>';
      let qy = sb.from('pos_sales').select('*').eq('bill_date', day).order('bill_no', { ascending: false }); qy = del ? qy.not('deleted_at', 'is', null) : qy.is('deleted_at', null);
      const { data, error } = await qy; if (error) return body.innerHTML = `<div class="empty">${esc(error.message)}</div>`;
      const sum = data.reduce((a, b) => a + Number(b.subtotal) - Number(b.discount), 0);
      body.innerHTML = (data.length ? `<div class="small muted" style="padding:0 20px 8px">${data.length} bills · ${money(sum)}</div>` : '<div class="empty"><div class="big">🧾</div>Is din koi bill nahi</div>') +
        `<div class="list">${data.map(b => `<div class="li"><div class="grow"><div class="t">#${b.bill_no} · ${money(Number(b.subtotal) - Number(b.discount))}</div><div class="s">${fmtTime(b.created_at)}${b.customer_name ? ' · ' + esc(b.customer_name) : ''}${Number(b.udhaar) ? ' · udhaar ' + money(b.udhaar) : ''}</div></div>
        <button class="btn sec sm" data-pr="${b.id}">🖨</button><button class="btn ${del ? 'green' : 'red'} sm" data-x="${b.id}">${del ? 'Restore' : 'Delete'}</button></div>`).join('')}</div>`;
      $$('[data-pr]', body).forEach(x => x.onclick = () => Staff.printHTML(receipt(data.find(b => b.id == x.dataset.pr))));
      $$('[data-x]', body).forEach(x => x.onclick = async () => { if (!del && !await confirmBox('Ye bill delete karein? (Deleted mein mil jayega)', 'Delete', true)) return;
        const { error: e } = await sb.from('pos_sales').update({ deleted_at: del ? null : new Date().toISOString() }).eq('id', x.dataset.x); if (e) return toast(e.message, 'err'); load(); });
    }
    $('#h-day', sh.el).onchange = e => { day = e.target.value; load(); };
    $('#h-seg', sh.el).onclick = e => { const b = e.target.closest('[data-d]'); if (!b) return; del = b.dataset.d === '1'; $$('#h-seg button', sh.el).forEach(x => x.classList.toggle('on', x === b)); load(); };
    load();
  };

  /* =============== MENU =============== */
  let mq = '';
  window.MenuUI = { async show() { await loadMenu(true); drawMenu(); } };
  function drawMenu() {
    const l = MENU.filter(m => !mq || m.name.toLowerCase().includes(mq) || m.category.toLowerCase().includes(mq));
    if (!MENU.length) { $('#menu-list').innerHTML = '<div class="empty"><div class="big">🍽️</div>Menu abhi khali hai.<br><button class="btn mt12" id="seed-btn">📥 Poora menu load karein (211 items)</button></div>'; $('#seed-btn').onclick = () => Owner.importMenu(); return; }
    $('#menu-list').innerHTML = `<div class="small muted" style="padding:10px 20px 0">${MENU.length} items · ${MENU.filter(m => !m.available).length} khatam</div>` +
      ([...new Set(l.map(m => m.category))].map(c => `<div class="cg">${esc(c)}</div><div style="background:var(--card)">${l.filter(m => m.category === c).map(m => `<div class="pr" data-edit="${m.id}" style="${m.available ? '' : 'opacity:.55'}">
        <span style="flex:none;width:14px;height:14px;border:1.6px solid;border-radius:3px;color:${m.is_veg ? '#0f8a3c' : '#c62828'};display:inline-block;position:relative"><i style="position:absolute;inset:2px;border-radius:50%;background:currentColor"></i></span>
        <div class="grow"><div>${esc(m.name)} ${m.bestseller ? '<span class="pill orange">★</span>' : ''}</div><div class="small muted">${money(m.price)}${m.available ? '' : ' · Khatam'}</div></div>
        <label class="sw" onclick="event.stopPropagation()"><input type="checkbox" data-av="${m.id}" ${m.available ? 'checked' : ''}><i></i></label></div>`).join('')}</div>`).join('') || '<div class="empty">Kuch nahi mila</div>') + '<div style="height:20px"></div>';
  }
  $('#menu-q').oninput = e => { mq = e.target.value.trim().toLowerCase(); drawMenu(); };
  $('#menu-list').onclick = e => { if (e.target.closest('.sw')) return; const r = e.target.closest('[data-edit]'); if (r) editSheet(MENU.find(m => m.id == r.dataset.edit)); };
  $('#menu-list').onchange = async e => { const c = e.target.closest('[data-av]'); if (!c) return; const { error } = await sb.from('menu_items').update({ available: c.checked }).eq('id', c.dataset.av);
    if (error) { toast(error.message, 'err'); c.checked = !c.checked; return; } MENU.find(m => m.id == c.dataset.av).available = c.checked; toast(c.checked ? 'Available ✓' : 'Khatam mark kiya'); drawMenu(); };
  $('#menu-add').onclick = () => editSheet(null);

  function editSheet(m) {
    const n = m || { name: '', price: '', category: '', is_veg: true, available: true, bestseller: false, description: '', image_url: '' };
    const sh = sheet(`<div class="sh-head"><h3>${m ? 'Item edit' : 'Naya item'}</h3><button class="iconbtn" data-close>✕</button></div><div class="sh-body"><div class="card">
      <label class="field"><span>Naam</span><input class="inp" id="e-name" value="${esc(n.name)}"></label>
      <div class="row gap8"><label class="field grow"><span>Price ₹</span><input class="inp" id="e-price" type="number" inputmode="decimal" value="${n.price}"></label>
      <label class="field grow"><span>Category</span><input class="inp" id="e-cat" list="e-cats" value="${esc(n.category)}"><datalist id="e-cats">${cats().map(c => `<option value="${esc(c)}">`).join('')}</datalist></label></div>
      <label class="field"><span>Chhota description (optional)</span><input class="inp" id="e-desc" maxlength="120" value="${esc(n.description || '')}"></label>
      <label class="field"><span>Photo ka link (optional, https://…)</span><input class="inp" id="e-img" autocapitalize="off" value="${esc(n.image_url || '')}"></label></div>
      <div class="list"><div class="li"><div class="grow t">🥦 Veg</div><label class="sw"><input type="checkbox" id="e-veg" ${n.is_veg ? 'checked' : ''}><i></i></label></div>
      <div class="li"><div class="grow t">★ Bestseller</div><label class="sw"><input type="checkbox" id="e-bs" ${n.bestseller ? 'checked' : ''}><i></i></label></div>
      <div class="li"><div class="grow t">Available</div><label class="sw"><input type="checkbox" id="e-av" ${n.available ? 'checked' : ''}><i></i></label></div></div>
      ${m ? '<div class="pad"><button class="btn red block" id="e-del">Item delete karein</button></div>' : ''}</div><div class="sh-foot"><button class="btn block" id="e-save">Save karein</button></div>`, { full: true });
    $('#e-save', sh.el).onclick = async () => {
      const name = $('#e-name', sh.el).value.trim(), price = parseFloat($('#e-price', sh.el).value), category = $('#e-cat', sh.el).value.trim() || 'Other', img = $('#e-img', sh.el).value.trim();
      if (!name || isNaN(price) || price < 0) return toast('Naam aur sahi price likhein', 'err');
      if (img && !/^https:\/\//i.test(img)) return toast('Photo ka link https:// se shuru hona chahiye', 'err');
      const row = { name, price, category, is_veg: $('#e-veg', sh.el).checked, bestseller: $('#e-bs', sh.el).checked, available: $('#e-av', sh.el).checked, description: $('#e-desc', sh.el).value.trim() || null, image_url: img || null };
      const r = m ? await sb.from('menu_items').update(row).eq('id', m.id) : await sb.from('menu_items').insert({ ...row, sort: Math.max(0, ...MENU.map(x => x.sort)) + 1 });
      if (r.error) return toast(r.error.code === '23505' ? 'Is naam ka item pehle se hai' : r.error.message, 'err');
      toast('Save ho gaya ✓', 'ok'); sh.close(); await loadMenu(true); drawMenu();
    };
    const d = $('#e-del', sh.el); if (d) d.onclick = async () => { if (!await confirmBox(`"${m.name}" delete karein?`, 'Delete', true)) return; const { error } = await sb.from('menu_items').delete().eq('id', m.id); if (error) return toast(error.message, 'err'); sh.close(); toast('Delete ho gaya'); await loadMenu(true); drawMenu(); };
  }
})();
