/**
 * Impor data/db.json ke data/app.sqlite
 * Usage: node scripts/migrate-json-to-sqlite.js
 */
'use strict';

const db = require('../db');

const data = db.load();
db.save(data);
const counts = {};
for (const col of db.COLLECTIONS) counts[col] = (data[col] || []).length;
console.log('Backend :', db.backend());
console.log('SQLite  :', db.sqlitePath());
console.log('JSON    :', db.JSON_PATH);
console.log('Jumlah  :', counts);
console.log('Selesai. Aplikasi akan memakai app.sqlite jika Node >= 22 dan DB_BACKEND tidak di-set json.');
