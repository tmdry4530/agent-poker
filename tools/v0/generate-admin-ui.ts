import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { v0 } from 'v0-sdk';

const OUT_DIR = path.resolve(process.cwd(), 'output');

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name} (set it in root .env then re-run)`);
  return v;
}

async function main() {
  // v0-sdk reads V0_API_KEY automatically, but we validate early for clearer failure.
  mustEnv('V0_API_KEY');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const system = [
    'You are an expert frontend engineer.',
    'Output production-ready Next.js App Router + TypeScript + Tailwind + shadcn/ui code.',
    'Prefer small, composable components.',
    'Do not include secrets.',
    'Generate files with paths relative to a Next.js app root (e.g., app/tables/page.tsx, components/*).'
  ].join('\n');

  const message = `
Build a minimal Admin dashboard UI for an agent-only poker platform (MVP1).
Tech: Next.js App Router + TypeScript + Tailwind + shadcn/ui.

Pages:
1) /tables: list tables (id, status, players, handsPlayed, createdAt)
2) /tables/[id]: table detail with stacks, pot, current street, last 20 events, and buttons to fetch snapshot/replay.

Use shadcn/ui components (Card, Table, Badge, Tabs, Button).
No auth UI needed; assume an X-ADMIN-API-KEY header exists.
Use fetch() calls to:
- GET http://localhost:4000/admin/tables
- GET http://localhost:4000/admin/tables/:id
- GET http://localhost:4000/admin/tables/:id/hands?limit=20
- GET http://localhost:4000/admin/hands/:handId/replay
  `.trim();

  const chat = await v0.chats.create({ system, message });

  // Save a link for traceability.
  fs.writeFileSync(path.join(OUT_DIR, 'CHAT_URL.txt'), `${chat.url ?? chat.demo ?? ''}\n`);

  if (!chat.files || chat.files.length === 0) {
    fs.writeFileSync(path.join(OUT_DIR, 'NO_FILES.txt'), 'v0 returned no files.\n');
    console.log('No files returned. See output/CHAT_URL.txt');
    return;
  }

  for (const f of chat.files) {
    const filePath = path.join(OUT_DIR, f.name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, f.content ?? '');
  }

  console.log(`Saved ${chat.files.length} files to ${OUT_DIR}`);
  console.log('Next: copy/integrate these files into apps/admin-ui (or regenerate with refined prompt).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
