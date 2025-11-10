// ---- Cloudflare API Integration ----
let bookings = [];

async function loadBookings() {
  try {
    const res = await fetch('/api/bookings');
    if (!res.ok) throw new Error('Failed to fetch bookings');
    bookings = await res.json();
  } catch (e) {
    console.error('❌ Could not load bookings:', e);
    bookings = [];
  }
}

async function addBooking(newBooking) {
  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBooking)
    });
    const result = await res.json();
    console.log('✅ Booking added:', result);
    await loadBookings();
    buildMonth(view);
  } catch (err) {
    console.error('❌ Error adding booking:', err);
  }
}

// ---- Helpers ----
function pad(n) { return n < 10 ? ('0' + n) : '' + n; }
function iso(d) { return d.toISOString().slice(0, 10); }
function formatDateEU(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

// ---- Calendar ----
let view = new Date();

function buildMonth(date) {
  const calGrid = document.getElementById('calGrid');
  const calTitle = document.getElementById('calTitle');
  if (!calGrid) return;

  calGrid.innerHTML = '';
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  calTitle.textContent = first.toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });

  const dows = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  dows.forEach(txt => {
    const el = document.createElement('div');
    el.className = 'dow';
    el.textContent = txt;
    calGrid.appendChild(el);
  });

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement('div');
    empty.className = 'cell';
    calGrid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const dateLabel = document.createElement('span');
    dateLabel.className = 'date';
    dateLabel.textContent = d;
    cell.appendChild(dateLabel);
    cell.dataset.date = `${y}-${pad(m + 1)}-${pad(d)}`;
    calGrid.appendChild(cell);
  }

  const cellByDate = {};
  document.querySelectorAll('.cell[data-date]').forEach(c => {
    cellByDate[c.dataset.date] = c;
  });

  function eachDate(fromISO, toISO) {
    const out = [];
    let d = new Date(fromISO + 'T00:00:00');
    const end = new Date(toISO + 'T00:00:00');
    while (d <= end) {
      out.push(iso(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  bookings.forEach(b => {
    const dates = eachDate(b.start, b.end);
    dates.forEach((dayIso, idx) => {
      const cell = cellByDate[dayIso];
      if (!cell) return;
      const seg = document.createElement('div');
      seg.className = 'seg ' + (b.status === 'confirm' ? 'confirm' : 'pending');
      seg.innerHTML = (idx === 0)
        ? `${b.guest} — ${(b.status === 'confirm') ? 'Bestätigt' : 'Ausstehend'}`
        : '';
      seg.addEventListener('click', () => openModal(b));
      cell.appendChild(seg);
    });
  });
}

// ---- Modal ----
function openModal(b) {
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'flex';
  document.getElementById('mTitle').textContent = b.guest;
  document.getElementById('mGuest').textContent = b.guest;
  document.getElementById('mStatus').innerHTML = `<span class='status-tag ${b.status}'>${(b.status === 'confirm') ? 'Bestätigt' : 'Ausstehend'}</span>`;
  document.getElementById('mDates').textContent = `${formatDateEU(b.start)} bis ${formatDateEU(b.end)}`;
  document.getElementById('mEmail').textContent = b.email;
  document.getElementById('mPhone').textContent = b.phone || 'Nicht angegeben';
  document.getElementById('mAddress').textContent = b.address || 'Nicht angegeben';
  document.getElementById('mAmount').textContent = b.amount ? `€${b.amount}` : 'Nicht angegeben';
  document.getElementById('mDeposit').textContent = b.depositAmount ? `€${b.depositAmount}` : 'Nicht angegeben';
  document.getElementById('mDepositDue').textContent = b.depositDue ? formatDateEU(b.depositDue) : 'Nicht angegeben';
  document.getElementById('mGuests').textContent = b.guests;
  document.getElementById('mNotes').textContent = b.notes || 'Keine Notizen';

  const emailsEl = document.getElementById('mEmails');
  emailsEl.innerHTML = '';
  (b.emails || []).forEach(e => {
    const it = document.createElement('div');
    it.className = 'em-item';
    it.innerHTML = `<div class='em-meta'>${e.time} — ${e.from}</div><div class='em-body'>${e.subject}: ${e.body}</div>`;
    emailsEl.appendChild(it);
  });
}

// ---- Navigation ----
document.getElementById('mClose').addEventListener('click', () => {
  document.getElementById('overlay').style.display = 'none';
});
document.getElementById('overlay').addEventListener('click', e => {
  if (e.target.id === 'overlay') e.currentTarget.style.display = 'none';
});
document.getElementById('prevBtn').addEventListener('click', () => {
  view.setMonth(view.getMonth() - 1);
  buildMonth(view);
});
document.getElementById('nextBtn').addEventListener('click', () => {
  view.setMonth(view.getMonth() + 1);
  buildMonth(view);
});
document.getElementById('todayBtn').addEventListener('click', () => {
  view = new Date();
  buildMonth(view);
});

// ---- Startup ----
loadBookings().then(() => buildMonth(view));
