import express from 'express';
import { MongoClient } from 'mongodb';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const app = express();
const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', {
  serverSelectionTimeoutMS: 5000
});
const db = client.db(process.env.MONGODB_DB || 'ipp_contacts');
const contacts = db.collection('contacts');
const fields = ['name', 'phone', 'email'];

function parseContact(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !fields.includes(key)) ||
      typeof body.name !== 'string' || typeof body.phone !== 'string' ||
      (body.email !== undefined && typeof body.email !== 'string')) return null;
  const name = body.name.trim();
  const phone = body.phone.trim();
  const email = (body.email ?? '').trim();
  if (!name || name.length > 100 || !/^\+?[0-9 ()-]{7,24}$/.test(phone) ||
      phone.replace(/\D/g, '').length < 7 ||
      (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))) return null;
  return { name, phone, email };
}

function toContact({ _id, ...fields }) {
  return { id: _id, ...fields };
}

function validateContact(req, res, next) {
  req.contact = parseContact(req.body);
  if (!req.contact) return res.status(400).json({
    message: 'Проверьте имя, телефон и электронную почту.'
  });
  next();
}

function sendMissing(res) {
  return res.status(404).json({ message: 'Контакт не найден.' });
}

app.use(express.json({ limit: '16kb' }));
app.get('/api/contacts', async (_req, res) => {
  const records = await contacts.find().sort({ name: 1, _id: 1 }).toArray();
  res.json(records.map(toContact));
});
app.post('/api/contacts', validateContact, async (req, res) => {
  const record = { _id: randomUUID(), ...req.contact };
  await contacts.insertOne(record);
  res.location('/api/contacts/' + record._id).status(201).json(toContact(record));
});
app.get('/api/contacts/:id', async (req, res) => {
  const record = await contacts.findOne({ _id: req.params.id });
  if (!record) return sendMissing(res);
  res.json(toContact(record));
});
app.put('/api/contacts/:id', validateContact, async (req, res) => {
  const record = await contacts.findOneAndUpdate(
    { _id: req.params.id }, { $set: req.contact }, { returnDocument: 'after' }
  );
  if (!record) return sendMissing(res);
  res.json(toContact(record));
});
app.delete('/api/contacts/:id', async (req, res) => {
  const { deletedCount } = await contacts.deleteOne({ _id: req.params.id });
  if (!deletedCount) return sendMissing(res);
  res.status(204).end();
});
app.use(express.static(fileURLToPath(new URL('./public/', import.meta.url))));
app.use((_req, res) => res.status(404).json({ message: 'Маршрут не найден.' }));
app.use((error, _req, res, _next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Некорректный JSON.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Слишком большой запрос.' });
  }
  console.error(error);
  res.status(500).json({ message: 'Ошибка сервера.' });
});

await client.connect();
await db.command({ ping: 1 });
const port = Number(process.env.PORT || 3005);
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => console.log('Contacts API listening on port ' + port));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => server.close(async () => { await client.close(); }));
}
