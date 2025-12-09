// Export Postgres bookings into a D1-friendly SQL seed file.
// Usage: DATABASE_URL=postgres://user:pass@host/db node scripts/export-postgres-to-d1.js
// Output: d1_seed.sql (apply with: wrangler d1 execute chalet_db --file d1_seed.sql --env production)

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function sqlEscape(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function toDateString(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.slice(0, 10);
  try {
    return val.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL env var');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const { rows } = await client.query('SELECT * FROM bookings ORDER BY start_date ASC');
    console.log(`Found ${rows.length} bookings to export`);

    const lines = [];
    lines.push('-- Generated seed for D1 bookings table');
    lines.push('BEGIN TRANSACTION;');

    for (const b of rows) {
      const start = toDateString(b.start_date);
      const end = toDateString(b.end_date);
      const createdAt = b.created_at ? new Date(b.created_at).toISOString() : null;

      const sql = [
        'INSERT OR REPLACE INTO bookings (',
        '  id, guest, email, phone, address, status, start, end, adults, children,',
        '  amount, depositAmount, depositDue, cancellationPolicy, freeCancellation, notes, created_at',
        ') VALUES (',
        [
          sqlEscape(b.id),
          sqlEscape(b.guest_name || ''),
          sqlEscape(b.email || ''),
          sqlEscape(b.phone || ''),
          sqlEscape(b.address || ''),
          sqlEscape(b.status || 'pending'),
          sqlEscape(start),
          sqlEscape(end),
          b.adults || 0,
          b.children || 0,
          b.amount || 0,
          b.deposit_amount || 0,
          sqlEscape(toDateString(b.deposit_due)),
          sqlEscape('[]'),          // cancellationPolicy not stored in Postgres
          sqlEscape('false'),       // freeCancellation not stored in Postgres
          sqlEscape(b.notes || ''),
          createdAt ? sqlEscape(createdAt) : 'CURRENT_TIMESTAMP',
        ].join(', '),
        ');'
      ].join('\n');

      lines.push(sql);
    }

    lines.push('COMMIT;');

    const outPath = path.join(process.cwd(), 'd1_seed.sql');
    fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
    console.log(`Wrote ${lines.length} SQL statements to ${outPath}`);
  } catch (err) {
    console.error('Export failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
