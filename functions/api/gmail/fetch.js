export async function onRequest(context) {
  const { env } = context;

  try {
    // === 1. Token aus D1 ===
    const row = await env.DB.prepare(
      'SELECT access_token, refresh_token, expires_at FROM gmail_tokens ORDER BY rowid DESC LIMIT 1'
    ).first();
    if (!row) return new Response('No Gmail token stored', { status: 401 });

    let { access_token, refresh_token, expires_at } = row;

    // === 2. Refresh falls nötig ===
    if (Date.now() / 1000 > expires_at - 60) {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.GMAIL_CLIENT_ID,
          client_secret: env.GMAIL_CLIENT_SECRET,
          refresh_token,
          grant_type: 'refresh_token'
        })
      });
      const refreshed = await refreshResponse.json();
      if (refreshed.access_token) {
        access_token = refreshed.access_token;
        expires_at = Math.floor(Date.now() / 1000) + refreshed.expires_in;
        await env.DB.prepare(
          'INSERT INTO gmail_tokens (access_token, refresh_token, expires_at) VALUES (?, ?, ?)'
        ).bind(access_token, refresh_token, expires_at).run();
      } else {
        return new Response('Failed to refresh token', { status: 401 });
      }
    }

    // === 3. Nachrichtenliste ===
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const list = await listRes.json();
    if (!list.messages) return new Response('No messages', { status: 200 });

    // === 4. Hilfsfunktionen ===
    function safeDecode(b64) {
      try {
        const cleaned = b64.replace(/-/g, '+').replace(/_/g, '/');
        const binary = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
        return new TextDecoder('utf-8').decode(binary);
      } catch { return ''; }
    }

    function extractBody(payload) {
      let out = '';
      (function walk(part) {
        if (!part) return;
        if (part.parts) part.parts.forEach(walk);
        const mime = part.mimeType || '';
        if (part.body?.data && (mime.includes('text/plain') || mime.includes('text/html'))) {
          out += safeDecode(part.body.data);
        }
      })(payload);
      return out;
    }

    function findHeader(headers, name) {
      const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return h ? h.value : null;
    }

    // === 5. Details je Mail ===
    const details = [];
    for (const m of list.messages) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        const msg = await msgRes.json();
        const headers = msg.payload?.headers || [];

        const subject = findHeader(headers, 'Subject') || '(Kein Betreff)';
        const fromHeader = findHeader(headers, 'From') || 'Unbekannt';
        const dateHeader = findHeader(headers, 'Date') || '';

        let fromName = fromHeader;
        const match = fromHeader.match(/(.*)<(.*)>/);
        if (match) fromName = match[1].trim() || match[2].trim();

        let dateFormatted = '';
        if (dateHeader) {
          const d = new Date(dateHeader);
          if (!isNaN(d)) {
            dateFormatted = d.toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        }

        let body = extractBody(msg.payload);
        if (!body && msg.snippet) body = msg.snippet;

        details.push({ id: m.id, from: fromName, subject, date: dateFormatted, body });
      } catch (e) {
        details.push({ id: m.id, from: 'Fehler', subject: e.message, date: '', body: '' });
      }
    }

    return new Response(JSON.stringify(details, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response('Server error: ' + err.stack, { status: 500 });
  }
}
