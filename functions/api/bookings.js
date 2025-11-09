export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const db = env.DB; // D1 binding (set in Cloudflare dashboard)

  // --- GET: Fetch all bookings ---
  if (request.method === 'GET') {
    try {
      const { results } = await db.prepare('SELECT * FROM bookings').all();
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('❌ DB fetch failed', err);
      return new Response(JSON.stringify({ error: 'DB error' }), { status: 500 });
    }
  }

  // --- POST: Add a new booking ---
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      if (!body.id) body.id = crypto.randomUUID();

      await db
        .prepare(
          `INSERT INTO bookings (id, guest, email, status, start, end, guests, amount, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          body.id,
          body.guest || '',
          body.email || '',
          body.status || 'pending',
          body.start || '',
          body.end || '',
          body.guests || 1,
          body.amount || '',
          body.notes || ''
        )
        .run();

      return new Response(
        JSON.stringify({ ok: true, id: body.id }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('❌ DB insert failed', err);
      return new Response(JSON.stringify({ error: 'Insert failed' }), { status: 500 });
    }
  }

  // --- Fallback ---
  return new Response('Method Not Allowed', { status: 405 });
}
