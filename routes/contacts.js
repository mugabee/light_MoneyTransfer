const express = require('express');
const { db, logAudit } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Contact not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, channel, handle, source, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const result = db
    .prepare(
      `INSERT INTO contacts (name, channel, handle, source, notes) VALUES (?, ?, ?, ?, ?)`
    )
    .run(name, channel || 'other', handle || null, source || null, notes || null);

  logAudit('contact', result.lastInsertRowid, 'create', { name, channel });
  const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact not found' });

  const { name, channel, handle, source, notes } = req.body;
  db.prepare(
    `UPDATE contacts SET name = ?, channel = ?, handle = ?, source = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    name ?? existing.name,
    channel ?? existing.channel,
    handle ?? existing.handle,
    source ?? existing.source,
    notes ?? existing.notes,
    req.params.id
  );

  logAudit('contact', req.params.id, 'update', req.body);
  const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  res.json(row);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Contact not found' });

  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  logAudit('contact', req.params.id, 'delete', existing);
  res.status(204).end();
});

module.exports = router;
