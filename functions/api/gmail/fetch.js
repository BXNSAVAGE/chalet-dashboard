const details = [];

for (const m of list.messages) {
  const msgRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  const msg = await msgRes.json();

  const headers = msg.payload?.headers || [];

  const subject =
    headers.find(h => h.name === 'Subject')?.value || '(Kein Betreff)';
  const fromHeader =
    headers.find(h => h.name === 'From')?.value || 'Unbekannt';
  const dateHeader = headers.find(h => h.name === 'Date')?.value || null;

  // Parse readable sender
  let fromName = fromHeader;
  const match = fromHeader.match(/(.*)<(.*)>/);
  if (match) {
    fromName = match[1].trim() || match[2].trim();
  }

  // Parse readable date
  let dateFormatted = '';
  try {
    if (dateHeader) {
      const d = new Date(dateHeader);
      if (!isNaN(d))
        dateFormatted = d.toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
    }
  } catch (_) {}

  // Extract body text (handles nested parts + base64)
  const decode = str =>
    atob(str.replace(/-/g, '+').replace(/_/g, '/'));

  let body = '';

  function extract(part) {
    if (part.parts) part.parts.forEach(extract);
    if (
      part.mimeType === 'text/plain' ||
      part.mimeType === 'text/html'
    ) {
      if (part.body?.data) {
        const text = decode(part.body.data);
        body += text;
      }
    }
  }

  extract(msg.payload);

  // Fallback if empty
  if (!body && msg.snippet) body = msg.snippet;

  details.push({
    id: m.id,
    from: fromName,
    subject,
    date: dateFormatted,
    body,
  });
}
