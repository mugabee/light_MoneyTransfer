const express = require('express');
const { pool, logAudit } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Contact not found' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const { name, channel, handle, source, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { rows } = await pool.query(
    `INSERT INTO contacts (name, channel, handle, source, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, channel || 'other', handle || null, source || null, notes || null]
  );

  const contact = rows[0];
  await logAudit('contact', contact.id, 'create', { name, channel });
  res.status(201).json(contact);
});

router.put('/:id', async (req, res) => {
  const existing = await pool.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Contact not found' });

  const { name, channel, handle, source, notes } = req.body;
  const current = existing.rows[0];

  const { rows } = await pool.query(
    `UPDATE contacts SET name = $1, channel = $2, handle = $3, source = $4, notes = $5, updated_at = now()
     WHERE id = $6 RETURNING *`,
    [
      name ?? current.name,
      channel ?? current.channel,
      handle ?? current.handle,
      source ?? current.source,
      notes ?? current.notes,
      req.params.id,
    ]
  );

  await logAudit('contact', req.params.id, 'update', req.body);
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const existing = await pool.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Contact not found' });

  await pool.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
  await logAudit('contact', req.params.id, 'delete', existing.rows[0]);
  res.status(204).end();
});

module.exports = router;
