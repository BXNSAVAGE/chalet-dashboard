export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

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
          `INSERT INTO bookings (
            id, guest, email, phone, address, status, start, end, 
            adults, children, amount, depositAmount, depositDue, 
            cancellationPolicy, freeCancellation, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          body.id,
          body.guest || '',
          body.email || '',
          body.phone || '',
          body.address || '',
          body.status || 'pending',
          body.start || '',
          body.end || '',
          body.adults || 2,
          body.children || 0,
          body.amount || '',
          body.depositAmount || '',
          body.depositDue || '',
          body.cancellationPolicy || '[]',
          body.freeCancellation || 'false',
          body.notes || ''
        )
        .run();

      return new Response(
        JSON.stringify({ ok: true, id: body.id }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('❌ DB insert failed', err);
      return new Response(JSON.stringify({ error: 'Insert failed', details: err.message }), { status: 500 });
    }
  }

  // --- PUT: Create OR Update a booking (upsert) ---
  if (request.method === 'PUT') {
    try {
      const body = await request.json();
      if (!body.id) body.id = crypto.randomUUID();

      // Check if booking exists
      const existing = await db
        .prepare('SELECT id FROM bookings WHERE id = ?')
        .bind(body.id)
        .first();

      if (existing) {
        // Update existing booking
        await db
          .prepare(
            `UPDATE bookings SET 
              guest=?, email=?, phone=?, address=?, status=?, start=?, end=?,
              adults=?, children=?, amount=?, depositAmount=?, depositDue=?,
              cancellationPolicy=?, freeCancellation=?, notes=?
            WHERE id=?`
          )
          .bind(
            body.guest || '',
            body.email || '',
            body.phone || '',
            body.address || '',
            body.status || 'pending',
            body.start || '',
            body.end || '',
            body.adults || 2,
            body.children || 0,
            body.amount || '',
            body.depositAmount || '',
            body.depositDue || '',
            body.cancellationPolicy || '[]',
            body.freeCancellation || 'false',
            body.notes || '',
            body.id
          )
          .run();
      } else {
        // Insert new booking
        await db
          .prepare(
            `INSERT INTO bookings (
              id, guest, email, phone, address, status, start, end, 
              adults, children, amount, depositAmount, depositDue, 
              cancellationPolicy, freeCancellation, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            body.id,
            body.guest || '',
            body.email || '',
            body.phone || '',
            body.address || '',
            body.status || 'pending',
            body.start || '',
            body.end || '',
            body.adults || 2,
            body.children || 0,
            body.amount || '',
            body.depositAmount || '',
            body.depositDue || '',
            body.cancellationPolicy || '[]',
            body.freeCancellation || 'false',
            body.notes || ''
          )
          .run();
      }

      return new Response(
        JSON.stringify({ ok: true, id: body.id }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('❌ DB upsert failed', err);
      return new Response(JSON.stringify({ error: 'Upsert failed', details: err.message }), { status: 500 });
    }
  }

  // --- DELETE: Remove a booking ---
  if (request.method === 'DELETE') {
    try {
      // Extract ID from URL path (e.g., /api/bookings/123)
      const pathParts = url.pathname.split('/');
      const bookingId = pathParts[pathParts.length - 1];

      if (!bookingId || bookingId === 'bookings') {
        return new Response(JSON.stringify({ error: 'Missing booking ID' }), { status: 400 });
      }

      const result = await db
        .prepare('DELETE FROM bookings WHERE id = ?')
        .bind(bookingId)
        .run();

      if (result.changes === 0) {
        return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
      }

      return new Response(
        JSON.stringify({ ok: true, id: bookingId, deleted: true }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err) {
      console.error('❌ DB delete failed', err);
      return new Response(JSON.stringify({ error: 'Delete failed', details: err.message }), { status: 500 });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}
