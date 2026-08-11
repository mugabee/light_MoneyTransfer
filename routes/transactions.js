const express = require('express');
const { pool, logAudit } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const { contact_id } = req.query;
  const { rows } = contact_id
    ? await pool.query(
        'SELECT * FROM transactions WHERE contact_id = $1 ORDER BY created_at DESC',
        [contact_id]
      )
    : await pool.query('SELECT * FROM transactions ORDER BY created_at DESC');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { contact_id, direction, amount, currency_from, currency_to, rate, notes } = req.body;

  if (!contact_id || !direction || !amount || !currency_from || !currency_to || !rate) {
    return res.status(400).json({
      error: 'contact_id, direction, amount, currency_from, currency_to, and rate are required',
    });
  }
  if (!['buy', 'sell'].includes(direction)) {
    return res.status(400).json({ error: "direction must be 'buy' or 'sell'" });
  }

  const contact = await pool.query('SELECT id FROM contacts WHERE id = $1', [contact_id]);
  if (!contact.rows[0]) return res.status(404).json({ error: 'Contact not found' });

  const { rows } = await pool.query(
    `INSERT INTO transactions (contact_id, direction, amount, currency_from, currency_to, rate, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [contact_id, direction, amount, currency_from, currency_to, rate, notes || null]
  );

  const tx = rows[0];
  await logAudit('transaction', tx.id, 'create', req.body);
  res.status(201).json(tx);
});

router.delete('/:id', async (req, res) => {
  const existing = await pool.query('SELECT * FROM transactions WHERE id = $1', [req.params.id]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Transaction not found' });

  await pool.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
  await logAudit('transaction', req.params.id, 'delete', existing.rows[0]);
  res.status(204).end();
});

module.exports = router;
