export async function onRequest(context) {
  const { env } = context;

  try {
    // === 1️⃣ Letzten gespeicherten Token holen ===
    const row = await env.DB.prepare(
      'SELECT access_token, refresh_token, expires_at FROM gmail_tokens ORDER BY rowid DESC LIMIT 1'
    ).first();
    if (!row) {
      return new Response('No Gmail token stored', { status: 401 });
    }

    let { access_token, refresh_token, expires_at } = row;

    // === 2️⃣ Token bei Bedarf refreshen ===
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

    // === 3️⃣ Aktuelle Nachrichten-IDs laden ===
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const list = await listRes.json();
    if (!list.messages) {
      return new Response('No messages found', { status: 200 });
    }

    // === 4️⃣ Body-Dekodier-Hilfsfunktion ===
    function safeDecode(base64) {
      try {
        // Gmail nutzt URL-safe Base64
        const cleaned = base64.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(cleaned);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder('utf-8').decode(bytes);
      } catch (e) {
        return '';
      }
    }

    // === 5️⃣ Nachrichtendetails laden ===
    const details = [];

    for (const m of list.messages) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
          { headers: { Authorization: `Bearer ${access_token}` } }
        );
        const msg = await msgRes.json();

        const headers = msg.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '(Kein Betreff)';
        const fromHeader = headers.find(h => h.name === 'From')?.value || 'Unbekannt';
        const dateHeader = headers.find(h => h.name === 'Date')?.value || '';

        // — Absender parsen —
        let fromName = fromHeader;
        const match = fromHeader.match(/(.*)<(.*)>/);
        if (match) fromName = match[1].trim() || match[2].trim();

        // — Datum formatieren —
        let dateFormatted = '';
        try {
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
        } catch (_) {}

        // — Body extrahieren —
        let body = '';
        function extract(part) {
          if (!part) return;
          if (part.parts) part.parts.forEach(extract);
          if (part.body?.data) {
            const mime = part.mimeType || '';
            if (mime.includes('text/plain') || mime.includes('text/html')) {
              body += safeDecode(part.body.data);
            }
          }
        }
        extract(msg.payload);
        if (!body && msg.snippet) body = msg.snippet;

        details.push({
          id: m.id,
          from: fromName,
          subject,
          date: dateFormatted,
          body
        });
      } catch (err) {
        details.push({
          id: m.id,
          from: 'Fehler',
          subject: err.message,
          date: '',
          body: ''
        });
      }
    }

    // === 6️⃣ JSON-Antwort zurückgeben ===
    return new Response(JSON.stringify(details, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response('Server error: ' + err.stack, { status: 500 });
  }
}
