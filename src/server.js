const express = require('express');
const path = require('node:path');
const { Pool } = require('pg');

const app = express();
app.disable('x-powered-by');
const port = Number(process.env.PORT || 3000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const categories = new Set(['Internet', 'Classroom', 'Facilities', 'Safety', 'Other']);

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (_error) {
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.get('/api/issues', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM issues ORDER BY created_at DESC, id DESC');
    res.json(rows);
  } catch (error) {
    console.error('Could not list issues:', error.message);
    res.status(500).json({ error: 'Could not load issues.' });
  }
});

app.post('/api/issues', async (req, res) => {
  const { title, description, category, location, priority = 'Medium' } = req.body || {};
  const fields = { title, description, category, location };
  const invalidField = Object.entries(fields).find(([, value]) => typeof value !== 'string' || !value.trim());
  if (invalidField) {
    return res.status(400).json({ error: `${invalidField[0]} is required.` });
  }
  if (title.trim().length > 100 || description.trim().length > 500 || category.trim().length > 40 || location.trim().length > 100) {
    return res.status(400).json({ error: 'One or more fields exceed the allowed length.' });
  }
  if (!categories.has(category.trim())) {
    return res.status(400).json({ error: 'Choose a valid issue category.' });
  }
  if (!['Low', 'Medium', 'High'].includes(priority)) {
    return res.status(400).json({ error: 'Priority must be Low, Medium, or High.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO issues (title, description, category, location, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title.trim(), description.trim(), category.trim(), location.trim(), priority],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Could not create issue:', error.message);
    res.status(500).json({ error: 'Could not create issue.' });
  }
});

app.patch('/api/issues/:id/status', async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid issue id.' });
  }
  if (!['Open', 'In Progress', 'Resolved'].includes(status)) {
    return res.status(400).json({ error: 'Status must be Open, In Progress, or Resolved.' });
  }

  try {
    const { rows } = await pool.query('UPDATE issues SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
    if (!rows[0]) return res.status(404).json({ error: 'Issue not found.' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Could not update issue:', error.message);
    res.status(500).json({ error: 'Could not update issue.' });
  }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));

async function start() {
  const maxAttempts = 20;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      app.listen(port, '0.0.0.0', () => console.log(`CampusFix is listening on port ${port}`));
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.log(`Waiting for database (${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
}

start().catch((error) => {
  console.error('Startup failed:', error.message);
  process.exit(1);
});