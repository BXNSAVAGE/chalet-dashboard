// /functions/api/gmail/send.js
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get request body
    const { to, subject, body } = await request.json();

    if (!to || !subject || !body) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Get access token
    const row = await env.DB.prepare(
      'SELECT access_token, refresh_token, expires_at FROM gmail_tokens ORDER BY rowid DESC LIMIT 1'
    ).first();

    if (!row) {
      return new Response('No Gmail token stored', { status: 401 });
    }

    let { access_token, refresh_token, expires_at } = row;

    // Refresh token if needed
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

    // Get the "from" address (optional, defaults to primary account)
    const from = env.GMAIL_SEND_FROM || ''; // Set this in your environment variables

    // Create email in RFC 2822 format
    const emailLines = [
      from ? `From: ${from}` : null,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body
    ].filter(Boolean); // Remove null values
    const email = emailLines.join('\r\n');

    // Encode to base64url
    const base64 = btoa(unescape(encodeURIComponent(email)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send via Gmail API
    const sendResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: base64 })
      }
    );

    if (!sendResponse.ok) {
      const error = await sendResponse.text();
      console.error('Gmail API error:', error);
      return new Response(`Failed to send: ${error}`, { status: sendResponse.status });
    }

    const result = await sendResponse.json();
    return new Response(JSON.stringify({ success: true, messageId: result.id }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Send email error:', err);
    return new Response('Server error: ' + err.message, { status: 500 });
  }
}
