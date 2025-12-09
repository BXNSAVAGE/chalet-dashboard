const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 5000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

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
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        country TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        guest_name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        status TEXT DEFAULT 'pending',
        start_date DATE,
        end_date DATE,
        adults INTEGER DEFAULT 2,
        children INTEGER DEFAULT 0,
        amount NUMERIC(10,2) DEFAULT 0,
        deposit_amount NUMERIC(10,2) DEFAULT 0,
        deposit_paid BOOLEAN DEFAULT false,
        deposit_due DATE,
        notes TEXT,
        source TEXT DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE,
        booking_id TEXT REFERENCES bookings(id) ON DELETE SET NULL,
        customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        guest_name TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        checkin DATE,
        checkout DATE,
        adults INTEGER DEFAULT 2,
        children INTEGER DEFAULT 0,
        items JSONB DEFAULT '[]',
        subtotal NUMERIC(10,2) DEFAULT 0,
        tax NUMERIC(10,2) DEFAULT 0,
        cleaning_fee NUMERIC(10,2) DEFAULT 70,
        total NUMERIC(10,2) DEFAULT 0,
        deposit NUMERIC(10,2) DEFAULT 0,
        deposit_paid BOOLEAN DEFAULT false,
        balance_due NUMERIC(10,2) DEFAULT 0,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        template_type TEXT DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const templatesExist = await client.query('SELECT COUNT(*) FROM email_templates');
    if (parseInt(templatesExist.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO email_templates (id, name, subject, body, template_type) VALUES
        ('tpl_booking_confirm', 'Buchungsbestätigung', 'Ihre Buchung im Chalet Bischof - Bestätigung', 
         'Sehr geehrte/r {{guest_name}},\n\nvielen Dank für Ihre Buchung!\n\nIhre Buchungsdetails:\n- Anreise: {{checkin}}\n- Abreise: {{checkout}}\n- Personen: {{adults}} Erwachsene, {{children}} Kinder\n- Gesamtbetrag: €{{total}}\n\nAnzahlung (30%): €{{deposit}} - Bitte überweisen Sie diesen Betrag bis {{deposit_due}}.\n\nBankverbindung:\nIBAN: AT00 0000 0000 0000 0000\nBIC: XXXXATWW\n\nMit freundlichen Grüßen,\nChalet Bischof Team', 'booking'),
        ('tpl_payment_reminder', 'Zahlungserinnerung', 'Erinnerung: Anzahlung für Ihre Buchung', 
         'Sehr geehrte/r {{guest_name}},\n\nwir möchten Sie freundlich an die ausstehende Anzahlung für Ihre Buchung erinnern.\n\nOffener Betrag: €{{deposit}}\nFällig bis: {{deposit_due}}\n\nBankverbindung:\nIBAN: AT00 0000 0000 0000 0000\nBIC: XXXXATWW\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen,\nChalet Bischof Team', 'reminder'),
        ('tpl_checkin_info', 'Check-in Informationen', 'Informationen zu Ihrem Aufenthalt im Chalet Bischof', 
         'Sehr geehrte/r {{guest_name}},\n\nwir freuen uns auf Ihren Besuch!\n\nCheck-in: {{checkin}} ab 15:00 Uhr\nCheck-out: {{checkout}} bis 10:00 Uhr\n\nAdresse:\nChalet Bischof\nDorfstraße 123\n6020 Innsbruck, Österreich\n\nAnreise:\n- GPS: 47.2692° N, 11.4041° E\n- Schlüsselbox Code: Wird am Anreisetag per SMS gesendet\n\nBei Fragen erreichen Sie uns unter: +43 XXX XXX XXXX\n\nWir wünschen Ihnen eine gute Anreise!\n\nMit freundlichen Grüßen,\nChalet Bischof Team', 'checkin'),
        ('tpl_invoice', 'Rechnung', 'Rechnung Nr. {{invoice_number}} - Chalet Bischof', 
         'Sehr geehrte/r {{guest_name}},\n\nanbei erhalten Sie Ihre Rechnung für Ihren Aufenthalt.\n\nRechnungsnummer: {{invoice_number}}\nRechnungsdatum: {{invoice_date}}\n\nAufenthalt: {{checkin}} - {{checkout}}\nGesamtbetrag: €{{total}}\nBereits bezahlt: €{{deposit}}\nRestbetrag: €{{balance}}\n\nBitte überweisen Sie den Restbetrag bis zum Check-out.\n\nMit freundlichen Grüßen,\nChalet Bischof Team', 'invoice'),
        ('tpl_thank_you', 'Dankeschön', 'Vielen Dank für Ihren Aufenthalt!', 
         'Sehr geehrte/r {{guest_name}},\n\nvielen Dank, dass Sie Gast in unserem Chalet waren!\n\nWir hoffen, dass Ihnen Ihr Aufenthalt vom {{checkin}} bis {{checkout}} gefallen hat.\n\nWir würden uns sehr freuen, wenn Sie uns eine Bewertung auf Google oder Booking.com hinterlassen könnten.\n\nFür Ihre nächste Buchung gewähren wir Ihnen 10% Stammkunden-Rabatt!\n\nBis bald!\n\nMit freundlichen Grüßen,\nChalet Bischof Team', 'followup')
      `);
    }

    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
}

app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const bookings = await pool.query('SELECT * FROM bookings WHERE customer_id = $1 ORDER BY start_date DESC', [req.params.id]);
    const invoices = await pool.query('SELECT * FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json({ ...result.rows[0], bookings: bookings.rows, invoices: invoices.rows });
  } catch (err) {
    console.error('Error fetching customer:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, email, phone, address, country, notes } = req.body;
    const id = 'cust_' + crypto.randomUUID();
    await pool.query(
      'INSERT INTO customers (id, name, email, phone, address, country, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, name, email || '', phone || '', address || '', country || '', notes || '']
    );
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ error: 'Insert failed' });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { name, email, phone, address, country, notes } = req.body;
    await pool.query(
      'UPDATE customers SET name=$1, email=$2, phone=$3, address=$4, country=$5, notes=$6, updated_at=CURRENT_TIMESTAMP WHERE id=$7',
      [name, email || '', phone || '', address || '', country || '', notes || '', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, c.name as customer_name, c.email as customer_email 
      FROM bookings b 
      LEFT JOIN customers c ON b.customer_id = c.id 
      ORDER BY b.start_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const body = req.body;
    const id = 'book_' + crypto.randomUUID();
    
    let customerId = body.customer_id;
    if (!customerId && body.guest_name && body.email) {
      const existingCustomer = await pool.query('SELECT id FROM customers WHERE email = $1', [body.email]);
      if (existingCustomer.rows.length > 0) {
        customerId = existingCustomer.rows[0].id;
      } else {
        customerId = 'cust_' + crypto.randomUUID();
        await pool.query(
          'INSERT INTO customers (id, name, email, phone, address) VALUES ($1, $2, $3, $4, $5)',
          [customerId, body.guest_name, body.email, body.phone || '', body.address || '']
        );
      }
    }
    
    await pool.query(
      `INSERT INTO bookings (id, customer_id, guest_name, email, phone, address, status, start_date, end_date, adults, children, amount, deposit_amount, deposit_paid, deposit_due, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [id, customerId, body.guest_name, body.email || '', body.phone || '', body.address || '', body.status || 'pending', 
       body.start_date, body.end_date, body.adults || 2, body.children || 0, body.amount || 0, 
       body.deposit_amount || 0, body.deposit_paid || false, body.deposit_due || null, body.notes || '', body.source || 'manual']
    );
    
    res.json({ ok: true, id, customer_id: customerId });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Insert failed', details: err.message });
  }
});

app.put('/api/bookings/:id', async (req, res) => {
  try {
    const body = req.body;
    await pool.query(
      `UPDATE bookings SET customer_id=$1, guest_name=$2, email=$3, phone=$4, address=$5, status=$6, 
       start_date=$7, end_date=$8, adults=$9, children=$10, amount=$11, deposit_amount=$12, 
       deposit_paid=$13, deposit_due=$14, notes=$15, updated_at=CURRENT_TIMESTAMP WHERE id=$16`,
      [body.customer_id, body.guest_name, body.email || '', body.phone || '', body.address || '', 
       body.status || 'pending', body.start_date, body.end_date, body.adults || 2, body.children || 0,
       body.amount || 0, body.deposit_amount || 0, body.deposit_paid || false, body.deposit_due || null, 
       body.notes || '', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Error updating booking:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/bookings/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.status(500).json({ error: 'Delete failed' });
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

app.post('/api/invoices', async (req, res) => {
  try {
    const body = req.body;
    const id = 'inv_' + crypto.randomUUID();
    
    const countResult = await pool.query('SELECT COUNT(*) FROM invoices');
    const count = parseInt(countResult.rows[0].count) + 1;
    const invoiceNumber = `${count}/${new Date().getFullYear()}`;
    
    await pool.query(
      `INSERT INTO invoices (id, invoice_number, booking_id, customer_id, guest_name, email, phone, address, 
       checkin, checkout, adults, children, items, subtotal, tax, cleaning_fee, total, deposit, deposit_paid, balance_due, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
      [id, invoiceNumber, body.booking_id || null, body.customer_id || null, body.guest_name, body.email || '', 
       body.phone || '', body.address || '', body.checkin, body.checkout, body.adults || 2, body.children || 0,
       JSON.stringify(body.items || []), body.subtotal || 0, body.tax || 0, body.cleaning_fee || 70, 
       body.total || 0, body.deposit || 0, body.deposit_paid || false, body.balance_due || 0, body.status || 'pending', body.notes || '']
    );
    
    res.json({ ok: true, id, invoice_number: invoiceNumber });
  } catch (err) {
    console.error('Error creating invoice:', err);
    res.status(500).json({ error: 'Insert failed' });
  }
});

app.put('/api/invoices/:id', async (req, res) => {
  try {
    const body = req.body;
    await pool.query(
      `UPDATE invoices SET guest_name=$1, email=$2, phone=$3, address=$4, checkin=$5, checkout=$6, 
       adults=$7, children=$8, items=$9, subtotal=$10, tax=$11, cleaning_fee=$12, total=$13, 
       deposit=$14, deposit_paid=$15, balance_due=$16, status=$17, notes=$18 WHERE id=$19`,
      [body.guest_name, body.email || '', body.phone || '', body.address || '', body.checkin, body.checkout,
       body.adults || 2, body.children || 0, JSON.stringify(body.items || []), body.subtotal || 0, 
       body.tax || 0, body.cleaning_fee || 70, body.total || 0, body.deposit || 0, body.deposit_paid || false,
       body.balance_due || 0, body.status || 'pending', body.notes || '', req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Error updating invoice:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error deleting invoice:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

app.get('/api/email-templates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM email_templates ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const bookingsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_bookings,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_bookings,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_bookings,
        COALESCE(SUM(amount), 0) as total_revenue,
        COUNT(*) FILTER (WHERE start_date >= CURRENT_DATE AND start_date <= CURRENT_DATE + INTERVAL '30 days') as upcoming_30_days
      FROM bookings
    `);
    
    const invoicesResult = await pool.query(`
      SELECT 
        COUNT(*) as total_invoices,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_invoices,
        COALESCE(SUM(balance_due) FILTER (WHERE status = 'pending'), 0) as outstanding_balance
      FROM invoices
    `);
    
    const customersResult = await pool.query('SELECT COUNT(*) as total_customers FROM customers');
    
    res.json({
      ...bookingsResult.rows[0],
      ...invoicesResult.rows[0],
      ...customersResult.rows[0]
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDB().then(() => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Chalet Dashboard running on http://0.0.0.0:${port}`);
  });
});
