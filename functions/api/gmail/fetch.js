export async function onRequest(context) {
  const { env } = context;

  try {
    const row = await env.DB.prepare(
      'SELECT access_token, refresh_token, expires_at FROM gmail_tokens ORDER BY rowid DESC LIMIT 1'
    ).first();

    if (!row) return new Response('No Gmail token', { status: 401 });

    let { access_token, refresh_token, expires_at } = row;

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

    // Step 1: get latest message IDs
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    const list = await listRes.json();
    if (!list.messages) return new Response('No messages', { status: 200 });

    // Step 2: fetch metadata for each message
    const details = [];
    for (const m of list.messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      const msg = await msgRes.json();

      const headers = msg.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '(Kein Betreff)';
      const from = headers.find(h => h.name === 'From')?.value || 'Unbekannt';
      const date = headers.find(h => h.name === 'Date')?.value || null;

      details.push({ id: m.id, subject, from, date });
    }

    return new Response(JSON.stringify(details), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response('Server error: ' + err.stack, { status: 500 });
  }
}
