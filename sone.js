/* Sone - shared helpers (teeno apps) */
(function () {
  const C = window.SONE_CONFIG;
  window.sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  window.$ = (s, r = document) => r.querySelector(s);
  window.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  window.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  window.ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  window.ago = iso => {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'abhi'; if (s < 3600) return Math.floor(s / 60) + ' min pehle';
    if (s < 86400) return Math.floor(s / 3600) + ' ghante pehle';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };
  window.fmtTime = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  window.fmtDT = iso => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  window.dayStr = (d = new Date()) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
  window.startOfDay = (str) => new Date(str + 'T00:00:00');

  /* toast */
  let tbox; window.toast = (msg, type) => {
    if (!tbox) { tbox = document.createElement('div'); tbox.id = 'toasts'; document.body.appendChild(tbox); }
    const t = document.createElement('div'); t.className = 'toast ' + (type || ''); t.textContent = msg; tbox.appendChild(t);
    setTimeout(() => { t.style.transition = '.3s'; t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, 3200);
  };
  window.haptic = (p = 15) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  /* sound (user ke pehle tap ke baad chalta hai) */
  let actx; const unlock = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} };
  ['click', 'touchstart', 'keydown'].forEach(e => document.addEventListener(e, unlock, { passive: true }));
  window.chime = (times = 2) => {
    if (ls.get('sone_mute', false)) return; unlock(); if (!actx) return;
    for (let i = 0; i < times; i++) [880, 1175].forEach((f, j) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * .55 + j * .18;
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.35, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .45);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + .5);
    });
  };
  window.speak = text => {
    if (ls.get('sone_mute', false) || !('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const m = new SpeechSynthesisUtterance(text); m.lang = 'hi-IN'; m.rate = .95; speechSynthesis.speak(m); } catch (e) {}
  };

  /* bottom sheet */
  window.sheet = (html, opts = {}) => {
    const w = document.createElement('div'); w.className = 'sheet-wrap';
    w.innerHTML = `<div class="sheet ${opts.full ? 'full' : ''}"><div class="grab"></div>${html}</div>`;
    document.body.appendChild(w); document.body.style.overflow = 'hidden';
    const api = { el: w.firstElementChild, wrap: w, close() { w.remove(); if (!$('.sheet-wrap')) document.body.style.overflow = ''; opts.onClose && opts.onClose(); } };
    w.addEventListener('click', e => { if (e.target === w) api.close(); });
    $$('[data-close]', w).forEach(b => b.addEventListener('click', () => api.close()));
    return api;
  };
  window.confirmBox = (msg, ok = 'OK', danger = false) => new Promise(res => {
    const w = document.createElement('div'); w.className = 'alert-wrap';
    w.innerHTML = `<div class="alert"><div class="msg">${esc(msg)}</div><div class="acts"><button data-v="0">Nahi</button><button data-v="1" class="${danger ? 'danger' : ''}">${esc(ok)}</button></div></div>`;
    document.body.appendChild(w);
    w.addEventListener('click', e => { const b = e.target.closest('button'); if (b || e.target === w) { w.remove(); res(b && b.dataset.v === '1'); } });
  });

  window.ICON = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
    list: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    receipt: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
    fork: '<svg viewBox="0 0 24 24"><path d="M7 3v8a2 2 0 002 2v8M11 3v8a2 2 0 01-2 2M17 21V3c-2 2-3 5-3 8h3"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
    flame: '<svg viewBox="0 0 24 24"><path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>'
  };

  /* ---------- order flow (waiter + owner) ---------- */
  window.FLOW = {
    delivery: ['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed'],
    pickup: ['placed', 'accepted', 'preparing', 'ready', 'completed'],
    dine_in: ['placed', 'accepted', 'preparing', 'ready', 'completed']
  };
  window.STATUS_LABEL = { placed: 'Naya order', accepted: 'Accepted', preparing: 'Ban raha hai', ready: 'Ready', out_for_delivery: 'Delivery par', completed: 'Complete', cancelled: 'Cancelled' };
  window.TYPE_LABEL = { delivery: '🛵 Delivery', pickup: '🛍️ Pickup', dine_in: '🍽️ Dine-in' };
  window.PAY_LABEL = { upi: 'UPI', cod: 'Cash on delivery', counter: 'Counter par' };
  window.nextStatus = o => { const f = FLOW[o.order_type] || FLOW.pickup, i = f.indexOf(o.status); return i >= 0 ? f[i + 1] : null; };
  window.nextLabel = o => {
    const n = nextStatus(o); if (!n) return null;
    return { accepted: 'Accept karein', preparing: 'Banana shuru', ready: 'Ready hai', out_for_delivery: 'Delivery par bheja', completed: o.order_type === 'delivery' ? 'Deliver ho gaya' : o.order_type === 'dine_in' ? 'Serve ho gaya' : 'Handover ho gaya' }[n];
  };
})();
