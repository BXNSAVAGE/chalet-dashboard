async function getValidToken(env) {
  const token = await env.DB.prepare(
    'SELECT * FROM gmail_tokens ORDER BY id DESC LIMIT 1'
  ).first();
  
  if (!token) return null;
  
  const now = Math.floor(Date.now() / 1000);
  if (token.expires_at > now) {
    return token.access_token;
  }
  
  // Refresh token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token'
    })
  });
  
  const newTokens = await response.json();
  const expiresAt = Math.floor(Date.now() / 1000) + newTokens.expires_in;
  
  await env.DB.prepare(
    'UPDATE gmail_tokens SET access_token = ?, expires_at = ? WHERE id = ?'
  ).bind(newTokens.access_token, expiresAt, token.id).run();
  
  return newTokens.access_token;
}

export async function onRequest(context) {
  const { env } = context;
  const token = await getValidToken(env);
  
  if (!token) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Fetch messages
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  const data = await response.json();
  
  if (!data.messages) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Fetch full message details
  const messages = await Promise.all(
    data.messages.map(async (msg) => {
      const msgResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return msgResponse.json();
    })
  );
  
  // Parse and store emails
  for (const msg of messages) {
    const headers = msg.payload.headers;
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const date = parseInt(msg.internalDate) / 1000;
    
    const [fromName, fromEmail] = from.match(/(.*)<(.*)>/) 
      ? [RegExp.$1.trim(), RegExp.$2.trim()]
      : ['', from];
    
    // Get email body
    let body = msg.snippet;
    if (msg.payload.parts) {
      const textPart = msg.payload.parts.find(p => p.mimeType === 'text/plain');
      if (textPart?.body?.data) {
        body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    }
    
    // Store in database
    await env.DB.prepare(
      `INSERT OR REPLACE INTO emails 
       (id, thread_id, from_email, from_name, subject, snippet, body, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      msg.id,
      msg.threadId,
      fromEmail,
      fromName,
      subject,
      msg.snippet,
      body,
      date
    ).run();
  }
  
  // Return stored emails
  const { results } = await env.DB.prepare(
    'SELECT * FROM emails ORDER BY date DESC'
  ).all();
  
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
}
