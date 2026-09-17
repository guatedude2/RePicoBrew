/**
 * Replay a Pico brew CSV through GET /api/pico/log (same wire format as the machine).
 *
 *   pnpm tsx scripts/replay-pico-session.ts
 *   pnpm tsx scripts/replay-pico-session.ts --delay 0.2
 *   pnpm tsx scripts/replay-pico-session.ts --uid <deviceUid> --ses-id <sessionUid>
 *   pnpm tsx scripts/replay-pico-session.ts --stop-before-complete
 *   pnpm tsx scripts/replay-pico-session.ts --csv path/to.csv --dry-run
 */
import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_CSV = join(SCRIPT_DIR, 'fixtures/live_PicoSessionLogs.csv');
const DEFAULT_DB = join(REPO_ROOT, 'prisma/picobrew.db');

type CsvRow = {
  ts: Date;
  wort: number;
  therm: number;
  event: string | null;
  error: number;
  shutScale: string;
};

const { values } = parseArgs({
  options: {
    csv: { type: 'string', default: DEFAULT_CSV },
    'base-url': { type: 'string', default: 'http://localhost:8080' },
    uid: { type: 'string' },
    'ses-id': { type: 'string' },
    delay: { type: 'string', default: '0.15' },
    db: { type: 'string', default: DEFAULT_DB },
    'stop-before-complete': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log(`Replay a Pico session CSV as GET /api/pico/log requests.

Options:
  --csv <path>                 CSV export (default: scripts/fixtures/live_PicoSessionLogs.csv)
  --base-url <url>             Remix origin (default: http://localhost:8080)
  --uid <deviceUid>            Pico device uid (default: latest brew session in prisma/picobrew.db)
  --ses-id <sessionUid>        Session uid / rfid the log endpoint looks up
  --delay <seconds>            Pause between pings (default: 0.15)
  --stop-before-complete       Skip the final "Brew Complete" ping so the batch stays brewing
  --dry-run                    Print requests without sending them
  --db <path>                  SQLite db used for uid/ses-id lookup
`);
  process.exit(0);
}

function parseLogDate(value: string): Date {
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) {
    throw new Error(`Unparseable LogDate: ${value}`);
  }
  return ts;
}

function lookupBrewTarget(dbPath: string): { uid: string; sesId: string } {
  const sql =
    'SELECT Device.uid, Session.uid FROM Session JOIN Device ON Device.id = Session.deviceId WHERE Session.type = 0 ORDER BY Session.id DESC LIMIT 1;';
  try {
    const out = execFileSync('sqlite3', [dbPath, '-separator', '|', sql], { encoding: 'utf8' }).trim();
    const [uid, sesId] = out.split('|');
    if (!uid || !sesId) {
      throw new Error('empty result');
    }
    return { uid, sesId };
  } catch (error) {
    throw new Error(
      `Could not look up a brew session in ${dbPath}. Pass --uid and --ses-id. (${
        error instanceof Error ? error.message : error
      })`,
    );
  }
}

async function readCsv(path: string): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];
  const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  let header: string[] | null = null;

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }
    const cols = line.split(',');
    if (!header) {
      header = cols.map((h) => h.replace(/^\uFEFF/, ''));
      continue;
    }
    const rec: Record<string, string> = {};
    header.forEach((key, i) => {
      rec[key] = cols[i] ?? '';
    });
    const event = rec.Event && rec.Event !== 'NULL' ? rec.Event : null;
    rows.push({
      ts: parseLogDate(rec.LogDate),
      wort: Number.parseInt(rec.WortTemp, 10),
      therm: Number.parseInt(rec.ThermoBlockTemp, 10),
      event,
      error: Number.parseInt(rec.ErrorCode, 10),
      shutScale: rec.ShuttleScaler,
    });
  }

  if (rows.length === 0) {
    throw new Error(`No rows in ${path}`);
  }
  return rows;
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function main() {
  const csvPath = isAbsolute(values.csv!) ? values.csv! : resolve(process.cwd(), values.csv!);
  const delayMs = Math.max(0, Number.parseFloat(values.delay!) * 1000);
  if (Number.isNaN(delayMs)) {
    throw new Error(`Invalid --delay ${values.delay}`);
  }

  const lookedUp = !values.uid || !values['ses-id'] ? lookupBrewTarget(values.db!) : null;
  const uid = values.uid ?? lookedUp!.uid;
  const sesId = values['ses-id'] ?? lookedUp!.sesId;
  const logUrl = new URL('/api/pico/log', values['base-url']).toString();

  const rows = await readCsv(csvPath);
  const filtered = values['stop-before-complete']
    ? rows.filter((row) => !(row.event ?? '').toLowerCase().includes('complete'))
    : rows;
  const endTs = filtered[filtered.length - 1]?.ts ?? rows[rows.length - 1].ts;

  console.log(`Replaying ${filtered.length} pings → ${logUrl}`);
  console.log(`  uid=${uid}`);
  console.log(`  sesId=${sesId}`);
  console.log(`  delay=${delayMs}ms${values['dry-run'] ? '  (dry-run)' : ''}`);

  let step = 'Preparing to Brew';
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < filtered.length; i += 1) {
    const row = filtered[i];
    if (row.event) {
      step = row.event;
      console.log(`[${i + 1}/${filtered.length}] ${step}  wort=${row.wort}  therm=${row.therm}`);
    }

    const url = new URL(logUrl);
    url.searchParams.set('uid', uid);
    url.searchParams.set('sesId', sesId);
    url.searchParams.set('wort', String(row.wort));
    url.searchParams.set('therm', String(row.therm));
    url.searchParams.set('step', step);
    url.searchParams.set('error', String(row.error));
    url.searchParams.set('sesType', '0');
    url.searchParams.set('timeLeft', String(Math.max(0, Math.round((endTs.getTime() - row.ts.getTime()) / 1000))));
    url.searchParams.set('shutScale', row.shutScale);
    if (row.event) {
      url.searchParams.set('event', row.event);
    }

    if (values['dry-run']) {
      ok += 1;
    } else {
      const response = await fetch(url);
      if (response.ok) {
        ok += 1;
      } else {
        fail += 1;
        const body = await response.text();
        console.error(`  HTTP ${response.status}: ${body.slice(0, 240)}`);
        if (fail >= 5) {
          throw new Error('Too many failures, stopping.');
        }
      }
    }

    if (delayMs > 0 && i < filtered.length - 1) {
      await sleep(delayMs);
    }
  }

  console.log(`Done. ok=${ok} fail=${fail}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
