const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, 'data', 'db.json');
const SQLITE_PATH = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(__dirname, 'data', 'app.sqlite');

const COLLECTIONS = [
  'users', 'athletes', 'tests', 'monitoringLogs', 'payments',
  'athleteUsers', 'athleteLinks', 'wellnessLogs', 'injuryReports',
  'sessionOverrides', 'nutritionWeekPlans',
];

const EMPTY_DB = {
  users: [],
  athletes: [],
  tests: [],
  monitoringLogs: [],
  payments: [],
  athleteUsers: [],
  athleteLinks: [],
  wellnessLogs: [],
  injuryReports: [],
  sessionOverrides: [],
  nutritionWeekPlans: [],
  seq: {
    users: 0, athletes: 0, tests: 0, monitoringLogs: 0, payments: 0,
    athleteUsers: 0, athleteLinks: 0, wellnessLogs: 0, injuryReports: 0,
    sessionOverrides: 0, nutritionWeekPlans: 0,
  },
};

function cloneJSON(value) {
  return JSON.parse(JSON.stringify(value));
}

function tableName(col) {
  return 'c_' + String(col).replace(/[^a-zA-Z0-9]/g, '_');
}

function normalize(data) {
  const out = cloneJSON(EMPTY_DB);
  if (!data || typeof data !== 'object') return out;
  for (const col of COLLECTIONS) {
    if (Array.isArray(data[col])) out[col] = data[col];
  }
  if (data.seq && typeof data.seq === 'object') {
    out.seq = Object.assign({}, out.seq, data.seq);
  }
  return out;
}

function readJsonFile() {
  if (!fs.existsSync(JSON_PATH)) return cloneJSON(EMPTY_DB);
  return normalize(JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')));
}

function writeJsonFile(data) {
  const tmpPath = JSON_PATH + '.tmp';
  fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, JSON_PATH);
}

function mysqlConfigured() {
  return !!(process.env.MYSQL_DATABASE && process.env.MYSQL_USER && process.env.MYSQL_PASSWORD);
}

function requestedBackend() {
  return String(process.env.DB_BACKEND || '').toLowerCase().trim();
}

/* ---------- SQLite (Node 22+) ---------- */
let sqliteApi = null;
function getSqliteApi() {
  if (sqliteApi !== null) return sqliteApi;
  try { sqliteApi = require('node:sqlite'); } catch (_) { sqliteApi = false; }
  return sqliteApi;
}
let sqliteHandle = null;
function openSqlite() {
  if (sqliteHandle) return sqliteHandle;
  const api = getSqliteApi();
  if (!api) return null;
  fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
  const db = new api.DatabaseSync(SQLITE_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('CREATE TABLE IF NOT EXISTS kv_seq (name TEXT PRIMARY KEY, value INTEGER NOT NULL)');
  for (const col of COLLECTIONS) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${tableName(col)} (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)`);
  }
  sqliteHandle = db;
  return db;
}
function readSqlite(db) {
  const data = cloneJSON(EMPTY_DB);
  for (const col of COLLECTIONS) {
    const rows = db.prepare(`SELECT id, payload FROM ${tableName(col)} ORDER BY id`).all();
    data[col] = rows.map((r) => {
      try {
        const obj = JSON.parse(r.payload);
        if (obj && obj.id == null) obj.id = r.id;
        return obj;
      } catch (_) { return { id: r.id }; }
    });
  }
  for (const r of db.prepare('SELECT name, value FROM kv_seq').all()) {
    data.seq[r.name] = Number(r.value) || 0;
  }
  return data;
}
function writeSqlite(db, data) {
  const src = normalize(data);
  db.exec('BEGIN');
  try {
    for (const col of COLLECTIONS) {
      db.exec(`DELETE FROM ${tableName(col)}`);
      const ins = db.prepare(`INSERT INTO ${tableName(col)} (id, payload) VALUES (?, ?)`);
      for (const row of src[col]) {
        const id = Number(row && row.id);
        if (!Number.isFinite(id)) continue;
        ins.run(id, JSON.stringify(row));
      }
    }
    const upsert = db.prepare('INSERT INTO kv_seq (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value');
    for (const [name, value] of Object.entries(src.seq)) upsert.run(name, Number(value) || 0);
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw err;
  }
}

/* ---------- MySQL (Hostinger) ---------- */
let mysqlPool = null;
let memoryCache = null;
let writeChain = Promise.resolve();

function mysqlConnConfig() {
  return {
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
  };
}

async function openMysql() {
  if (mysqlPool) return mysqlPool;
  const mysql = require('mysql2/promise');
  mysqlPool = mysql.createPool(mysqlConnConfig());
  const conn = await mysqlPool.getConnection();
  try {
    await conn.query('CREATE TABLE IF NOT EXISTS kv_seq (name VARCHAR(64) PRIMARY KEY, value INT NOT NULL)');
    for (const col of COLLECTIONS) {
      await conn.query(
        `CREATE TABLE IF NOT EXISTS ${tableName(col)} (
          id INT NOT NULL PRIMARY KEY,
          payload LONGTEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
      );
    }
  } finally {
    conn.release();
  }
  return mysqlPool;
}

async function mysqlIsEmpty(pool) {
  const [rows] = await pool.query('SELECT COUNT(*) AS n FROM c_users');
  return !rows || !rows[0] || Number(rows[0].n) === 0;
}

async function readMysql(pool) {
  const data = cloneJSON(EMPTY_DB);
  for (const col of COLLECTIONS) {
    const [rows] = await pool.query(`SELECT id, payload FROM ${tableName(col)} ORDER BY id`);
    data[col] = (rows || []).map((r) => {
      try {
        const obj = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
        if (obj && obj.id == null) obj.id = r.id;
        return obj;
      } catch (_) { return { id: r.id }; }
    });
  }
  const [seqRows] = await pool.query('SELECT name, value FROM kv_seq');
  for (const r of seqRows || []) data.seq[r.name] = Number(r.value) || 0;
  return data;
}

async function writeMysql(pool, data) {
  const src = normalize(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const col of COLLECTIONS) {
      await conn.query(`DELETE FROM ${tableName(col)}`);
      for (const row of src[col]) {
        const id = Number(row && row.id);
        if (!Number.isFinite(id)) continue;
        await conn.query(
          `INSERT INTO ${tableName(col)} (id, payload) VALUES (?, ?)`,
          [id, JSON.stringify(row)]
        );
      }
    }
    for (const [name, value] of Object.entries(src.seq)) {
      await conn.query(
        'INSERT INTO kv_seq (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [name, Number(value) || 0]
      );
    }
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }
}

function enqueueMysqlWrite(data) {
  writeChain = writeChain.then(() => writeMysql(mysqlPool, data)).catch((err) => {
    console.error('[db] gagal tulis MySQL:', err.message);
  });
  return writeChain;
}

/* ---------- Backend selection ---------- */
let activeBackend = 'json';

function pickBackend() {
  const req = requestedBackend();
  if (req === 'json' || req === 'file') return 'json';
  if (req === 'mysql' || req === 'mariadb') return mysqlConfigured() ? 'mysql' : 'json';
  if (req === 'sqlite') return getSqliteApi() ? 'sqlite' : 'json';
  if (mysqlConfigured()) return 'mysql';
  if (getSqliteApi()) return 'sqlite';
  return 'json';
}

function migrateLifetimeMembers(data) {
  if (!data || !Array.isArray(data.users)) return false;
  const { convertLifetimeUserToAnnual } = require('./lib/access');
  let changed = false;
  for (const u of data.users) {
    if (u && u.role === 'coach' && u.hasLifetimeAccess === true) {
      if (convertLifetimeUserToAnnual(u)) changed = true;
    }
  }
  return changed;
}

async function init() {
  activeBackend = pickBackend();
  if (activeBackend === 'mysql') {
    try {
      const pool = await openMysql();
      if (await mysqlIsEmpty(pool) && fs.existsSync(JSON_PATH)) {
        const data = readJsonFile();
        if (COLLECTIONS.some((c) => data[c].length)) {
          await writeMysql(pool, data);
          console.log('[db] Impor db.json → MySQL selesai');
        }
      }
      memoryCache = await readMysql(pool);
      if (migrateLifetimeMembers(memoryCache)) {
        await writeMysql(pool, memoryCache);
        console.log('[db] konversi member lifetime → annual');
      }
      console.log('[db] backend= mysql', process.env.MYSQL_DATABASE);
      return;
    } catch (err) {
      console.error('[db] MySQL gagal, fallback JSON:', err.message);
      activeBackend = 'json';
    }
  }
  if (activeBackend === 'sqlite') {
    const db = openSqlite();
    if (db) {
      const empty = !db.prepare('SELECT COUNT(*) AS n FROM c_users').get().n;
      if (empty && fs.existsSync(JSON_PATH)) {
        const data = readJsonFile();
        if (COLLECTIONS.some((c) => data[c].length)) {
          writeSqlite(db, data);
          console.log('[db] Impor db.json → app.sqlite selesai');
        }
      }
      memoryCache = readSqlite(db);
      if (migrateLifetimeMembers(memoryCache)) {
        writeSqlite(db, memoryCache);
        console.log('[db] konversi member lifetime → annual');
      }
      console.log('[db] backend= sqlite', SQLITE_PATH);
      return;
    }
    activeBackend = 'json';
  }
  memoryCache = fs.existsSync(JSON_PATH) ? readJsonFile() : cloneJSON(EMPTY_DB);
  if (!fs.existsSync(JSON_PATH)) writeJsonFile(memoryCache);
  if (migrateLifetimeMembers(memoryCache)) {
    writeJsonFile(memoryCache);
    console.log('[db] konversi member lifetime → annual');
  }
  console.log('[db] backend= json', JSON_PATH);
}

function load() {
  if (!memoryCache) {
    if (activeBackend === 'sqlite' && openSqlite()) memoryCache = readSqlite(openSqlite());
    else memoryCache = fs.existsSync(JSON_PATH) ? readJsonFile() : cloneJSON(EMPTY_DB);
  }
  return cloneJSON(memoryCache);
}

function save(data) {
  const src = normalize(data);
  memoryCache = src;
  if (activeBackend === 'mysql' && mysqlPool) {
    enqueueMysqlWrite(src);
    return;
  }
  if (activeBackend === 'sqlite') {
    const db = openSqlite();
    if (db) {
      writeSqlite(db, src);
      return;
    }
  }
  writeJsonFile(src);
}

function nextId(data, collection) {
  if (!data.seq) data.seq = {};
  if (data.seq[collection] == null) data.seq[collection] = 0;
  data.seq[collection] += 1;
  return data.seq[collection];
}

function backend() {
  return activeBackend;
}

async function flush() {
  if (activeBackend === 'mysql') await writeChain;
}

module.exports = {
  init, load, save, nextId, backend, flush,
  sqlitePath: () => SQLITE_PATH,
  JSON_PATH, SQLITE_PATH, COLLECTIONS, EMPTY_DB,
  mysqlConfigured,
};
