export default {
  async fetch(request, env) {
    const db = env.DB;
    const url = new URL(request.url);
    if (url.pathname === '/api/bookings' && request.method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM bookings').all();
      return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/api/bookings' && request.method === 'POST') {
      const data = await request.json();
      await db.prepare('INSERT INTO bookings (id, guest, email, status, start, end, guests, amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), data.guest, data.email, data.status, data.start, data.end, data.guests, data.amount, data.notes || '')
        .run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404 });
  }
};
