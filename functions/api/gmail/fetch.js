export async function onRequest(context) {
  const { env } = context;

  try {
    if (!env.DB) {
      return new Response('DB binding missing', { status: 500 });
    }

    const row = await env.DB.prepare(
      'SELECT access_token, refresh_token, expires_at FROM gmail_tokens ORDER BY rowid DESC LIMIT 1'
    ).first();

    if (!row) {
      return new Response('No Gmail token stored', { status: 401 });
    }

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

      if (!refreshed.access_token) {
        return new Response('Failed to refresh token: ' + JSON.stringify(refreshed), {
          status: 401
        });
      }

      access_token = refreshed.access_token;
      expires_at = Math.floor(Date.now() / 1000) + refreshed.expires_in;

      await env.DB.prepare(
        'INSERT INTO gmail_tokens (access_token, refresh_token, expires_at) VALUES (?, ?, ?)'
      ).bind(access_token, refresh_token, expires_at).run();
    }

    const gmailRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!gmailRes.ok) {
      const err = await gmailRes.text();
      return new Response('Gmail API error: ' + err, { status: gmailRes.status });
    }

const data = await gmailRes.json();
return new Response(JSON.stringify(data.messages || []), {
  headers: { 'Content-Type': 'application/json' }
});


  } catch (err) {
    return new Response('Server error: ' + err.stack, { status: 500 });
  }
}
