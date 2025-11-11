export async function onRequest(context) {
  const { env } = context;

  try {
    const row = await env.DB.prepare(
      'SELECT access_token, refresh_token, expires_at FROM gmail_tokens ORDER BY rowid DESC LIMIT 1'
    ).first();
    if (!row) return new Response('No Gmail token stored', { status: 401 });

    let { access_token, refresh_token, expires_at } = row;

    // Refresh if needed
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
      }
    }

    // === list messages ===
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const list = await listRes.json();
    if (!list.messages) return new Response('No messages', { status: 200 });

    // === helpers ===
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

    // Find header - search in top-level headers only (more reliable)
    function findHeader(payload, name) {
      if (!payload || !payload.headers) return null;
      const found = payload.headers.find(h => 
        h.name && h.name.toLowerCase() === name.toLowerCase()
      );
      return found ? found.value : null;
    }

    // Extract sender name from From header
    function extractFromName(fromHeader) {
      if (!fromHeader) return 'Unbekannt';
      
      // Try to match "Name <email@example.com>" format
      const nameEmailMatch = fromHeader.match(/^"?([^"<]+)"?\s*<(.+)>$/);
      if (nameEmailMatch) {
        const name = nameEmailMatch[1].trim();
        return name || nameEmailMatch[2].trim();
      }
      
      // Try to match "<email@example.com>" format
      const emailOnlyMatch = fromHeader.match(/^<(.+)>$/);
      if (emailOnlyMatch) {
        return emailOnlyMatch[1].trim();
      }
      
      // Return as-is if it's just an email or name
      return fromHeader.trim();
    }

    // Format date in German locale
    function formatDate(dateHeader) {
      if (!dateHeader) return '';
      
      try {
        // Parse the date
        const date = new Date(dateHeader);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
          return dateHeader; // Return original if parsing fails
        }
        
        // Format in German locale
        return date.toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      } catch (e) {
        return dateHeader; // Return original on error
      }
    }

    const details = [];

    for (const m of list.messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      const msg = await msgRes.json();

      // DEBUG: Log the entire message structure for first email
      if (details.length === 0) {
        console.log('First message structure:', JSON.stringify(msg, null, 2));
        console.log('Headers:', msg.payload?.headers);
      }

      // Extract headers from top-level payload
      const subject = findHeader(msg.payload, 'Subject') || '(Kein Betreff)';
      const fromHeader = findHeader(msg.payload, 'From') || 'Unbekannt';
      const dateHeader = findHeader(msg.payload, 'Date') || '';

      console.log('Extracted values:', { subject, fromHeader, dateHeader });

      // Extract clean sender name
      const fromName = extractFromName(fromHeader);

      // Format date
      const dateFormatted = formatDate(dateHeader);

      // Extract body
      let body = extractBody(msg.payload);
      if (!body && msg.snippet) body = msg.snippet;

      details.push({
        id: m.id,
        from: fromName,
        subject,
        date: dateFormatted,
        body,
        // Add raw values for debugging
        _debug: {
          rawFrom: fromHeader,
          rawDate: dateHeader
        }
      });
    }

    return new Response(JSON.stringify(details, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response('Server error: ' + err.stack, { status: 500 });
  }
}
