/**
 * Impor data/db.json ke MySQL Hostinger.
 * Wajib: MYSQL_HOST MYSQL_USER MYSQL_PASSWORD MYSQL_DATABASE
 * Usage: node scripts/migrate-json-to-mysql.js
 */
'use strict';
require('dotenv').config();
const db = require('../db');

(async () => {
  if (!db.mysqlConfigured()) {
    console.error('Isi MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD di Environment Variables.');
    process.exit(1);
  }
  process.env.DB_BACKEND = 'mysql';
  await db.init();
  const data = db.load();
  db.save(data);
  await db.flush();
  const counts = {};
  for (const col of db.COLLECTIONS) counts[col] = (data[col] || []).length;
  console.log('Backend :', db.backend());
  console.log('Database:', process.env.MYSQL_DATABASE);
  console.log('Jumlah  :', counts);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
