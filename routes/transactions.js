const express = require('express');
const { db, logAudit } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { contact_id } = req.query;
  const rows = contact_id
    ? db
        .prepare('SELECT * FROM transactions WHERE contact_id = ? ORDER BY created_at DESC')
        .all(contact_id)
    : db.prepare('SELECT * FROM transactions ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { contact_id, direction, amount, currency_from, currency_to, rate, notes } = req.body;

  if (!contact_id || !direction || !amount || !currency_from || !currency_to || !rate) {
    return res.status(400).json({
      error: 'contact_id, direction, amount, currency_from, currency_to, and rate are required',
    });
  }
  if (!['buy', 'sell'].includes(direction)) {
    return res.status(400).json({ error: "direction must be 'buy' or 'sell'" });
  }

  const contact = db.prepare('SELECT id FROM contacts WHERE id = ?').get(contact_id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const result = db
    .prepare(
      `INSERT INTO transactions (contact_id, direction, amount, currency_from, currency_to, rate, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(contact_id, direction, amount, currency_from, currency_to, rate, notes || null);

  logAudit('transaction', result.lastInsertRowid, 'create', req.body);
  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Transaction not found' });

  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  logAudit('transaction', req.params.id, 'delete', existing);
  res.status(204).end();
});

module.exports = router;
