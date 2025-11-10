// ---- Cloudflare API Integration ----
let bookings = [];
let currentBooking = null;

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

async function saveBooking(booking) {
  try {
    const res = await fetch('/api/bookings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(booking)
    });
    const result = await res.json();
    console.log('✅ Booking saved:', result);
    await loadBookings();
    buildMonth(view);
    return true;
  } catch (err) {
    console.error('❌ Error saving booking:', err);
    return false;
  }
}

// ---- Helpers ----
function pad(n) { return n < 10 ? ('0' + n) : '' + n; }
function iso(d) { return d.toISOString().slice(0, 10); }
function formatDateEU(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}
function parseEUDate(euStr) {
  if (!euStr) return null;
  const [d, m, y] = euStr.split('.');
  return new Date(y, m - 1, d);
}

// ---- Calculate nights between two dates ----
function calculateNights(startISO, endISO) {
  if (!startISO || !endISO) return 0;
  const start = new Date(startISO);
  const end = new Date(endISO);
  const diff = end - start;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

// ---- Calculate tourist tax (€5 per adult per night) ----
function calculateTouristTax(nights, adults) {
  return nights * adults * 5;
}

// ---- Calculate cancellation fee based on current date ----
function calculateCancellationFee(booking) {
  if (!booking.amount || !booking.cancellationPolicy) {
    return { fee: 0, percentage: 0, text: 'Keine Stornobedingungen' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let policy;
  try {
    policy = JSON.parse(booking.cancellationPolicy);
  } catch (e) {
    return { fee: 0, percentage: 0, text: 'Fehler beim Parsen' };
  }

  if (booking.freeCancellation === 'true') {
    // Check if we're still in free cancellation period
    if (policy.length > 0) {
      const firstPolicyDate = parseEUDate(policy[0].date);
      if (today < firstPolicyDate) {
        return { fee: 0, percentage: 0, text: 'Kostenlos stornierbar' };
      }
    }
  }

  // Find applicable cancellation percentage
  let applicablePercentage = 0;
  for (const p of policy) {
    const policyDate = parseEUDate(p.date);
    if (today >= policyDate) {
      applicablePercentage = parseFloat(p.percentage);
    }
  }

  const amount = parseFloat(booking.amount) || 0;
  const fee = (amount * applicablePercentage) / 100;

  return {
    fee: fee.toFixed(2),
    percentage: applicablePercentage,
    text: applicablePercentage > 0 ? `${applicablePercentage}% = €${fee.toFixed(2)}` : 'Kostenlos stornierbar'
  };
}

// ---- Update calculations in modal ----
function updateCalculations() {
  const start = document.getElementById('mStart').value;
  const end = document.getElementById('mEnd').value;
  const adults = parseInt(document.getElementById('mAdults').value) || 0;
  const amount = parseFloat(document.getElementById('mAmount').value) || 0;

  // Calculate nights
  const nights = calculateNights(start, end);

  // Calculate tourist tax
  const touristTax = calculateTouristTax(nights, adults);
  document.getElementById('mTouristTax').textContent = `€${touristTax.toFixed(2)} (${nights} Nächte × ${adults} Erwachsene × €5)`;

  // Calculate total with tax
  const totalWithTax = amount + touristTax;
  document.getElementById('mTotalWithTax').textContent = `€${totalWithTax.toFixed(2)}`;

  // Calculate cancellation fee
  if (currentBooking) {
    const cancellation = calculateCancellationFee({
      ...currentBooking,
      amount: amount.toString()
    });
    document.getElementById('mCancellationFee').textContent = cancellation.text;
  }
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
  const startOffset = (first.getDay() + 6) % 7;
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
  currentBooking = b;
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'flex';
  
  document.getElementById('mTitle').textContent = b.guest;
  document.getElementById('mGuest').value = b.guest;
  document.getElementById('mStatus').innerHTML = `<span class='status-tag ${b.status}'>${(b.status === 'confirm') ? 'Bestätigt' : 'Ausstehend'}</span>`;
  document.getElementById('mStart').value = b.start;
  document.getElementById('mEnd').value = b.end;
  document.getElementById('mEmail').value = b.email;
  document.getElementById('mPhone').value = b.phone || '';
  document.getElementById('mAddress').value = b.address || '';
  document.getElementById('mAdults').value = b.adults || 2;
  document.getElementById('mChildren').value = b.children || 0;
  document.getElementById('mAmount').value = b.amount || '';
  document.getElementById('mDeposit').value = b.depositAmount || '';
  document.getElementById('mDepositDue').value = b.depositDue || '';
  document.getElementById('mNotes').value = b.notes || '';

  updateCalculations();
}

function closeModal() {
  document.getElementById('overlay').style.display = 'none';
  currentBooking = null;
}

// ---- Navigation ----
document.getElementById('mClose').addEventListener('click', closeModal);
document.getElementById('overlay').addEventListener('click', e => {
  if (e.target.id === 'overlay') closeModal();
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

// ---- Save Button ----
document.getElementById('saveBtn').addEventListener('click', async () => {
  if (!currentBooking) return;

  const updated = {
    ...currentBooking,
    guest: document.getElementById('mGuest').value,
    email: document.getElementById('mEmail').value,
    phone: document.getElementById('mPhone').value,
    address: document.getElementById('mAddress').value,
    start: document.getElementById('mStart').value,
    end: document.getElementById('mEnd').value,
    adults: parseInt(document.getElementById('mAdults').value) || 2,
    children: parseInt(document.getElementById('mChildren').value) || 0,
    amount: document.getElementById('mAmount').value,
    depositAmount: document.getElementById('mDeposit').value,
    depositDue: document.getElementById('mDepositDue').value,
    notes: document.getElementById('mNotes').value
  };

  const success = await saveBooking(updated);
  if (success) {
    alert('✅ Buchung gespeichert!');
    closeModal();
  } else {
    alert('❌ Fehler beim Speichern');
  }
});

// ---- Auto-recalculate on input change ----
['mStart', 'mEnd', 'mAdults', 'mAmount'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateCalculations);
});

// ---- Startup ----
loadBookings().then(() => buildMonth(view));
