#!/usr/bin/env node
// Lockout recovery: sets a new password for a RePicoBrew user straight in the database, without needing to be
// logged in or to know the old password. Run it ON the Pi (over SSH, or with a keyboard and screen):
//
//   cd ~/RePicoBrew && node scripts/reset-password.mjs
//
// It lists the users, asks which one (skipped if there's only one), then asks for the new password twice. The
// password is typed at the prompt (hidden), never passed on the command line, so it stays out of shell history
// and process listings. The running app needs no restart: the next sign-in uses the new password.
//
// Options:
//   --list            just show the users
//   DB_PATH=<file>    use a different database file (default: prisma/picobrew.db)
import { createHmac, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import readline from 'node:readline';
import Database from 'better-sqlite3';

const MIN_LENGTH = 8;
const dbPath = process.env.DB_PATH || 'prisma/picobrew.db';

if (!existsSync(dbPath)) {
  console.error(`Can't find the database at ${dbPath}. Run this from the app folder (cd ~/RePicoBrew).`);
  process.exit(1);
}

const db = new Database(dbPath);
const users = db.prepare('select id, name, email, role from User where deletedAt is null order by id').all();
if (users.length === 0) {
  console.error('There are no users in this database. Finish the first-time setup in the browser instead.');
  process.exit(1);
}

console.log('\nUsers:');
users.forEach((u, i) => console.log(`  ${i + 1}. ${u.name} <${u.email}> (${u.role})`));
if (process.argv.includes('--list')) {
  process.exit(0);
}

// One line-oriented reader for every prompt, so it works both at a keyboard and when input is piped in.
const input = readline.createInterface({ input: process.stdin, terminal: false });
const lines = [];
const waiting = [];
input.on('line', (line) => (waiting.length ? waiting.shift()(line) : lines.push(line)));
input.on('close', () => waiting.splice(0).forEach((resolve) => resolve('')));
const nextLine = () => new Promise((resolve) => (lines.length ? resolve(lines.shift()) : waiting.push(resolve)));

async function ask(question) {
  process.stdout.write(question);
  const answer = await nextLine();
  return answer.trim();
}

// Reads a line without echoing it when attached to a real terminal.
async function askHidden(question) {
  if (!process.stdin.isTTY) {
    return ask(question);
  }
  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve) => {
    let value = '';
    const onData = (chunk) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n' || char === '') {
          process.stdin.setRawMode(false);
          process.stdin.off('data', onData);
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '') {
          process.stdout.write('\n');
          process.exit(130);
        }
        if (char === '' || char === '\b') {
          value = value.slice(0, -1);
        } else {
          value += char;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

let target = users[0];
if (users.length > 1) {
  const choice = await ask('\nWhich user? (number or email): ');
  target = users[Number(choice) - 1] ?? users.find((u) => u.email.toLowerCase() === choice.toLowerCase()) ?? null;
  if (!target) {
    console.error('No such user.');
    process.exit(1);
  }
}
console.log(`\nResetting the password for ${target.name} <${target.email}>.`);

const password = await askHidden(`New password (at least ${MIN_LENGTH} characters): `);
if (password.length < MIN_LENGTH) {
  console.error(`Too short: it needs at least ${MIN_LENGTH} characters. Nothing was changed.`);
  process.exit(1);
}
const confirm = await askHidden('Type it again: ');
if (confirm !== password) {
  console.error("Those don't match. Nothing was changed.");
  process.exit(1);
}

// Same scheme as the app (app/utils/encryption.ts): a fresh random salt, then HMAC-SHA256(salt, password).
const salt = randomUUID().replace(/-/g, '');
const hash = createHmac('sha256', salt).update(password).digest('hex');
db.prepare('update User set password = ?, salt = ?, updatedAt = ? where id = ?').run(
  hash,
  salt,
  new Date().toISOString().replace('Z', '+00:00'),
  target.id,
);

console.log(`\nDone. ${target.email} can now sign in with the new password.`);
process.exit(0);
