require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('../db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CODE_ENTER = 13;
const CODE_CTRL_C = 3;
const CODE_BACKSPACE = 127;
const CODE_BACKSPACE_ALT = 8;

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function askHidden(rl, question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let input = '';
    const onData = (char) => {
      const code = char[0];
      if (code === CODE_ENTER) {
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(input);
        return;
      }
      if (code === CODE_CTRL_C) process.exit(1);
      if (code === CODE_BACKSPACE || code === CODE_BACKSPACE_ALT) {
        input = input.slice(0, -1);
        return;
      }
      input += char.toString('utf8');
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const name = (await ask(rl, 'Nama admin: ')).trim();
  const email = (await ask(rl, 'Email admin: ')).trim().toLowerCase();
  const password = await askHidden(rl, 'Password (minimal 8 karakter): ');
  rl.close();

  if (!name || name.length < 2) {
    console.error('Nama wajib diisi (minimal 2 karakter).');
    process.exit(1);
  }
  if (!EMAIL_RE.test(email)) {
    console.error('Email tidak valid.');
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error('Password minimal 8 karakter.');
    process.exit(1);
  }

  const data = db.load();
  if (data.users.some((u) => u.email === email)) {
    console.error('Email sudah terdaftar.');
    process.exit(1);
  }

  const admin = {
    id: db.nextId(data, 'users'),
    name,
    email,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'admin',
    createdAt: new Date().toISOString(),
    trialStartedAt: null,
    hasLifetimeAccess: true,
  };
  data.users.push(admin);
  db.save(data);

  console.log(`Admin "${name}" <${email}> berhasil dibuat.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
