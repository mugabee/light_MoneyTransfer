require('dotenv').config();
const express = require('express');
const path = require('path');

const { init } = require('./db');
const contactsRouter = require('./routes/contacts');
const transactionsRouter = require('./routes/transactions');
const { router: ratesRouter } = require('./routes/rates');
const whatsappRouter = require('./routes/whatsapp');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/contacts', contactsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/rates', ratesRouter);
app.use('/whatsapp', whatsappRouter);

const PORT = process.env.PORT || 3000;

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Ledger running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
