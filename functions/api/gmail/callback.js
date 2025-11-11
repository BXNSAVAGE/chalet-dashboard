export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('Authorization failed', { status: 400 });
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GMAIL_CLIENT_ID,
        client_secret: env.GMAIL_CLIENT_SECRET,
        redirect_uri: env.GMAIL_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      return new Response('Failed to get tokens: ' + JSON.stringify(tokens), { status: 500 });
    }

    if (env.DB) {
      const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;
      await env.DB.prepare(
        'INSERT INTO gmail_tokens (access_token, refresh_token, expires_at) VALUES (?, ?, ?)'
      ).bind(tokens.access_token, tokens.refresh_token, expiresAt).run();
    }

    const redirectTo = env.GMAIL_SUCCESS_REDIRECT_URL || 'https://chalet-dashboard-4fr.pages.dev/';
    return Response.redirect(redirectTo, 302);
  } catch (err) {
    return new Response('Error: ' + err.message, { status: 500 });
  }
}
