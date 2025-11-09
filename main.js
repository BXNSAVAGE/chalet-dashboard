// ---------- Beispiel-Daten ----------
const bookings = [
  { id:'A1234', guest:'Müller', status:'pending', start:'2025-11-01', end:'2025-11-04', email:'mueller@example.com', amount:'€300', guests:2,
    emails:[ {time:'Gestern 18:03', from:'tvb@stanton.tirol', subject:'Buchung eingegangen', body:'Vielen Dank für Ihre Anfrage…'} ] },
  { id:'A1235', guest:'Novak', status:'confirm', start:'2025-11-05', end:'2025-11-08', email:'novak@example.com', amount:'€540', guests:3,
    emails:[ {time:'Heute 08:01', from:'bank@notifications.at', subject:'Anzahlung eingegangen', body:'Anzahlung 180 € verbucht.'} ] },
  { id:'A1236', guest:'Klein', status:'pending', start:'2025-11-12', end:'2025-11-14', email:'klein@example.com', amount:'€250', guests:2,
    emails:[ {time:'Heute 09:16', from:'klein@example.com', subject:'Anreisezeit', body:'Wir kommen gegen 16 Uhr.'} ] },
  { id:'A1237', guest:'Meier', status:'confirm', start:'2025-11-20', end:'2025-11-22', email:'meier@example.com', amount:'€420', guests:2,
    emails:[ {time:'Gestern 12:11', from:'tvb@stanton.tirol', subject:'Buchung bestätigt', body:'Bis bald im Chalet!'} ] },
];

// ---------- Helpers ----------
const calGrid = document.getElementById('calGrid');
const calTitle = document.getElementById('calTitle');

function pad(n){return n<10?('0'+n):''+n;}
function iso(d){return d.toISOString().slice(0,10);}
function formatDateEU(dateStr){ const [y,m,d]=dateStr.split('-'); return `${d}.${m}.${y}`; }

let view = new Date(); // current month

// ---------- Calendar Builder ----------
function buildMonth(date){
  if(!calGrid) return console.error('calGrid not found');
  calGrid.innerHTML='';
  const y=date.getFullYear();
  const m=date.getMonth();
  const first=new Date(y,m,1);
  const startOffset=(first.getDay()+6)%7; // Monday = 0
  const daysInMonth=new Date(y,m+1,0).getDate();
  calTitle.textContent=first.toLocaleDateString('de-AT',{month:'long',year:'numeric'});

  // Wochentage
  const dows=['Mo','Di','Mi','Do','Fr','Sa','So'];
  dows.forEach(txt=>{
    const el=document.createElement('div');
    el.className='dow';
    el.textContent=txt;
    calGrid.appendChild(el);
  });

  // Leerzellen
  for(let i=0;i<startOffset;i++){
    const empty=document.createElement('div');
    empty.className='cell';
    calGrid.appendChild(empty);
  }

  // Tage
  for(let d=1; d<=daysInMonth; d++){
    const cell=document.createElement('div');
    cell.className='cell';
    const dateLabel=document.createElement('span');
    dateLabel.className='date';
    dateLabel.textContent=d;
    cell.appendChild(dateLabel);
    cell.dataset.date=`${y}-${pad(m+1)}-${pad(d)}`;
    calGrid.appendChild(cell);
  }

  const cellByDate={};
  document.querySelectorAll('.cell[data-date]').forEach(c=>cellByDate[c.dataset.date]=c);

  function eachDate(fromISO,toISO){
    const out=[];
    let d=new Date(fromISO+'T00:00:00');
    const end=new Date(toISO+'T00:00:00');
    while(d<=end){out.push(iso(d)); d.setDate(d.getDate()+1);}
    return out;
  }

  // Buchungen rendern
  bookings.forEach(b=>{
    const dates=eachDate(b.start,b.end);
    dates.forEach((dayIso,idx)=>{
      const cell=cellByDate[dayIso];
      if(!cell) return;
      const seg=document.createElement('div');
      seg.className='seg '+(b.status==='confirm'?'confirm':'pending');
      seg.innerHTML=(idx===0)?`${b.guest} — ${(b.status==='confirm')?'Bestätigt':'Ausstehend'}`:'';
      seg.addEventListener('click',()=>openModal(b));
      cell.appendChild(seg);
    });
  });
}

// ---------- Modal ----------
function openModal(b){
  const overlay=document.getElementById('overlay');
  overlay.style.display='flex';
  document.getElementById('mTitle').textContent=b.guest;
  document.getElementById('mGuest').textContent=b.guest;
  document.getElementById('mStatus').innerHTML=`<span class='status-tag ${b.status}'>${(b.status==='confirm')?'Bestätigt':'Ausstehend'}</span>`;
  document.getElementById('mDates').textContent=`${formatDateEU(b.start)} bis ${formatDateEU(b.end)}`;
  document.getElementById('mEmail').textContent=b.email;
  document.getElementById('mAmount').textContent=b.amount;
  document.getElementById('mGuests').textContent=b.guests;
  const emails=document.getElementById('mEmails');
  emails.innerHTML='';
  (b.emails||[]).forEach(e=>{
    const it=document.createElement('div');
    it.className='em-item';
    it.innerHTML=`<div class='em-meta'>${e.time} — ${e.from}</div><div class='em-body'>${e.subject}: ${e.body}</div>`;
    emails.appendChild(it);
  });
}

document.getElementById('mClose').addEventListener('click',()=>{document.getElementById('overlay').style.display='none';});
document.getElementById('overlay').addEventListener('click',e=>{if(e.target.id==='overlay')e.currentTarget.style.display='none';});
document.getElementById('prevBtn').addEventListener('click',()=>{view.setMonth(view.getMonth()-1);buildMonth(view);});
document.getElementById('nextBtn').addEventListener('click',()=>{view.setMonth(view.getMonth()+1);buildMonth(view);});
document.getElementById('todayBtn').addEventListener('click',()=>{view=new Date();buildMonth(view);});

// Initial render
buildMonth(view);
