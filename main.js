const bookings = [
  { guest: 'Müller', status: 'pending', start: '2025-10-30', end: '2025-11-02', guests: 2, amount: '200€', email: 'mueller@example.com', emails: ['Buchungsanfrage am 29.10.'] },
  { guest: 'Novak', status: 'confirm', start: '2025-11-03', end: '2025-11-07', guests: 3, amount: '500€', email: 'novak@example.com', emails: ['Anfrage am 01.11', 'Bestätigung am 01.11'] },
  { guest: 'Klein', status: 'pending', start: '2025-11-10', end: '2025-11-13', guests: 2, amount: '350€', email: 'klein@example.com', emails: ['Anfrage am 09.11'] },
  { guest: 'Meier', status: 'confirm', start: '2025-11-18', end: '2025-11-21', guests: 4, amount: '450€', email: 'meier@example.com', emails: ['Anfrage am 15.11', 'Bestätigung am 16.11'] }
];

let view = new Date(2025, 10, 1); // November 2025
const calTitle = document.getElementById('calTitle');
const calGrid = document.getElementById('calGrid');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const todayBtn = document.getElementById('todayBtn');
const overlay = document.getElementById('overlay');
const closeBtn = document.getElementById('closeBtn');
const mTitle = document.getElementById('mTitle');
const mStatus = document.getElementById('mStatus');
const mDates = document.getElementById('mDates');
const mEmail = document.getElementById('mEmail');
const mAmount = document.getElementById('mAmount');
const mGuests = document.getElementById('mGuests');
const mEmails = document.getElementById('mEmails');

function formatDate(date) {
  return date.toLocaleDateString('de-AT');
}

function buildCalendar() {
  calGrid.innerHTML = '';
  const monthName = view.toLocaleDateString('de-AT', { month: 'long', year: 'numeric' });
  calTitle.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekDay = (firstDay.getDay() + 6) % 7; // Monday start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = 42;
  for (let i = 0; i < totalCells; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const date = new Date(year, month, i - startWeekDay + 1);
    const dayNumber = date.getMonth() === month ? date.getDate() : '';
    if (dayNumber) {
      const label = document.createElement('div');
      label.className = 'date';
      label.textContent = dayNumber;
      cell.appendChild(label);
      bookings.forEach(b => {
        const start = new Date(b.start);
        const end = new Date(b.end);
        if (date >= start && date <= end) {
          const seg = document.createElement('div');
          seg.className = 'seg ' + (b.status === 'confirm' ? 'confirm' : 'pending');
          if (date.getTime() === start.getTime()) {
            seg.textContent = `${b.guest} — ${b.status === 'confirm' ? 'Bestätigt' : 'Ausstehend'}`;
          } else {
            seg.textContent = '';
          }
          seg.addEventListener('click', () => openModal(b));
          cell.appendChild(seg);
        }
      });
    }
    calGrid.appendChild(cell);
  }
}

function openModal(booking) {
  mTitle.textContent = booking.guest;
  mStatus.className = 'status ' + (booking.status === 'confirm' ? 'confirm' : 'pending');
  mStatus.textContent = booking.status === 'confirm' ? 'Bestätigt' : 'Ausstehend';
  mDates.textContent = `${formatDate(new Date(booking.start))} – ${formatDate(new Date(booking.end))}`;
  mEmail.textContent = booking.email || '';
  mAmount.textContent = booking.amount || '';
  mGuests.textContent = booking.guests ? booking.guests.toString() : '';
  mEmails.innerHTML = '';
  if (booking.emails) {
    booking.emails.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      mEmails.appendChild(li);
    });
  }
  overlay.style.display = 'flex';
}

function closeModal() {
  overlay.style.display = 'none';
}

prevBtn.addEventListener('click', () => {
  view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
  buildCalendar();
});

nextBtn.addEventListener('click', () => {
  view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
  buildCalendar();
});

todayBtn.addEventListener('click', () => {
  const today = new Date();
  view = new Date(today.getFullYear(), today.getMonth(), 1);
  buildCalendar();
});

closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});

buildCalendar();
