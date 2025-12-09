const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = 5000;

app.use(express.json());
app.use(express.static('.'));

app.set('Cache-Control', 'no-cache');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  next();
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        guest TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        status TEXT DEFAULT 'pending',
        start_date TEXT,
        end_date TEXT,
        adults INTEGER DEFAULT 2,
        children INTEGER DEFAULT 0,
        amount TEXT,
        deposit_amount TEXT,
        deposit_due TEXT,
        cancellation_policy TEXT DEFAULT '[]',
        free_cancellation TEXT DEFAULT 'false',
        notes TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        number TEXT,
        guest TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        checkin TEXT,
        checkout TEXT,
        adults INTEGER DEFAULT 2,
        children INTEGER DEFAULT 0,
        items TEXT DEFAULT '[]',
        subtotal NUMERIC(10,2) DEFAULT 0,
        tax NUMERIC(10,2) DEFAULT 0,
        cleaning NUMERIC(10,2) DEFAULT 70,
        total NUMERIC(10,2) DEFAULT 0,
        deposit NUMERIC(10,2) DEFAULT 0,
        deposit_paid BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'pending',
        folder TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT,
        parent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
}

app.get('/api/bookings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings ORDER BY start_date DESC');
    const bookings = result.rows.map(row => ({
      id: row.id,
      guest: row.guest,
      email: row.email,
      phone: row.phone,
      address: row.address,
      status: row.status,
      start: row.start_date,
      end: row.end_date,
      adults: row.adults,
      children: row.children,
      amount: row.amount,
      depositAmount: row.deposit_amount,
      depositDue: row.deposit_due,
      cancellationPolicy: row.cancellation_policy,
      freeCancellation: row.free_cancellation,
      notes: row.notes
    }));
    res.json(bookings);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const body = req.body;
    const id = body.id || require('crypto').randomUUID();
    
    await pool.query(
      `INSERT INTO bookings (id, guest, email, phone, address, status, start_date, end_date, adults, children, amount, deposit_amount, deposit_due, cancellation_policy, free_cancellation, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [id, body.guest || '', body.email || '', body.phone || '', body.address || '', body.status || 'pending', body.start || '', body.end || '', body.adults || 2, body.children || 0, body.amount || '', body.depositAmount || '', body.depositDue || '', body.cancellationPolicy || '[]', body.freeCancellation || 'false', body.notes || '']
    );
    
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error inserting booking:', err);
    res.status(500).json({ error: 'Insert failed', details: err.message });
  }
});

app.put('/api/bookings', async (req, res) => {
  try {
    const body = req.body;
    const id = body.id || require('crypto').randomUUID();
    
    const existing = await pool.query('SELECT id FROM bookings WHERE id = $1', [id]);
    
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE bookings SET guest=$1, email=$2, phone=$3, address=$4, status=$5, start_date=$6, end_date=$7, adults=$8, children=$9, amount=$10, deposit_amount=$11, deposit_due=$12, cancellation_policy=$13, free_cancellation=$14, notes=$15 WHERE id=$16`,
        [body.guest || '', body.email || '', body.phone || '', body.address || '', body.status || 'pending', body.start || '', body.end || '', body.adults || 2, body.children || 0, body.amount || '', body.depositAmount || '', body.depositDue || '', body.cancellationPolicy || '[]', body.freeCancellation || 'false', body.notes || '', id]
      );
    } else {
      await pool.query(
        `INSERT INTO bookings (id, guest, email, phone, address, status, start_date, end_date, adults, children, amount, deposit_amount, deposit_due, cancellation_policy, free_cancellation, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [id, body.guest || '', body.email || '', body.phone || '', body.address || '', body.status || 'pending', body.start || '', body.end || '', body.adults || 2, body.children || 0, body.amount || '', body.depositAmount || '', body.depositDue || '', body.cancellationPolicy || '[]', body.freeCancellation || 'false', body.notes || '']
      );
    }
    
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error upserting booking:', err);
    res.status(500).json({ error: 'Upsert failed', details: err.message });
  }
});

app.delete('/api/bookings', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Missing booking ID' });
    }
    
    const result = await pool.query('DELETE FROM bookings WHERE id = $1', [id]);
    res.json({ ok: true, id, deleted: true, changes: result.rowCount });
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.status(500).json({ error: 'Delete failed', details: err.message });
  }
});

app.get('/api/invoices', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/invoices', async (req, res) => {
  try {
    const invoices = req.body;
    
    await pool.query('DELETE FROM invoices');
    
    for (const inv of invoices) {
      await pool.query(
        `INSERT INTO invoices (id, number, guest, email, phone, address, checkin, checkout, adults, children, items, subtotal, tax, cleaning, total, deposit, deposit_paid, status, folder, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [inv.id, inv.number, inv.guest, inv.email, inv.phone, inv.address, inv.checkin, inv.checkout, inv.adults, inv.children, JSON.stringify(inv.items || []), inv.subtotal || 0, inv.tax || 0, inv.cleaning || 70, inv.total || 0, inv.deposit || 0, inv.depositPaid || false, inv.status || 'pending', inv.folder || null, inv.notes || '']
      );
    }
    
    res.json({ ok: true });
  } catch (err) {
    console.error('Error saving invoices:', err);
    res.status(500).json({ error: 'Save failed', details: err.message });
  }
});

app.get('/api/folders', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM folders ORDER BY created_at DESC');
    const folders = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      parent: row.parent,
      created: row.created_at
    }));
    res.json(folders);
  } catch (err) {
    console.error('Error fetching folders:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/folders', async (req, res) => {
  try {
    const folders = req.body;
    
    await pool.query('DELETE FROM folders');
    
    for (const folder of folders) {
      await pool.query(
        `INSERT INTO folders (id, name, parent) VALUES ($1, $2, $3)`,
        [folder.id, folder.name, folder.parent || null]
      );
    }
    
    res.json({ ok: true });
  } catch (err) {
    console.error('Error saving folders:', err);
    res.status(500).json({ error: 'Save failed', details: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDB().then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
});
