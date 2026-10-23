#!/usr/bin/env node
/**
 * Proves the policies shipped.
 *
 * The local suite proves RLS is *written* correctly. This proves the project
 * everyone will actually use has it turned on — a table created without
 * `enable row level security`, or a migration that half-applied, reads as an
 * open API to anyone holding the anon key, which is a public value.
 *
 * Signed out, every table must come back empty or refused. Empty counts:
 * `select` with no policy returns zero rows rather than an error, and zero
 * rows is the correct answer to "what may a stranger see".
 *
 *   node scripts/verify-prod-rls.mjs
 */

import { readFileSync } from 'node:fs';

const TABLES = [
  'profiles',
  'my_categories',
  'ripples',
  'ripple_audience',
  'ripple_views',
  'links',
  'lists',
  'list_members',
  'pools',
  'pool_members',
  'pool_lanes',
  'lane_mappings',
  'splashes',
  'splash_placements',
  'pool_invites',
  'sessions',
];

/** Env first, then .env.local, so this runs against whatever is linked. */
function config() {
  const env = { ...process.env };
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !env[match[1]]) env[match[1]] = match[2].trim();
    }
  } catch {
    // No .env.local is fine when the values come from the environment.
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('✖ NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.');
    process.exit(1);
  }
  return { url: url.replace(/\/$/, ''), key };
}

const { url, key } = config();

if (url.includes('127.0.0.1') || url.includes('localhost')) {
  console.error(`✖ ${url} is the local stack. Point this at the deployed project.`);
  process.exit(1);
}

console.log(`→ signed out, against ${url}\n`);

let leaked = 0;

for (const table of TABLES) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    // A refusal is the strongest possible answer.
    console.log(`  ✓ ${table} — refused (${response.status})`);
    continue;
  }

  const rows = await response.json();
  if (Array.isArray(rows) && rows.length === 0) {
    console.log(`  ✓ ${table} — empty`);
  } else {
    console.error(`  ✖ ${table} — RETURNED ${rows.length ?? '?'} ROW(S) TO A STRANGER`);
    leaked += 1;
  }
}

// The bucket is private, so an unsigned read of a path that exists must fail
// too. A 400/404 is fine: what matters is that it is not 200 with bytes.
const object = await fetch(`${url}/storage/v1/object/ripple-media/probe.jpg`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
if (object.ok) {
  console.error('  ✖ ripple-media — served an object unsigned');
  leaked += 1;
} else {
  console.log(`  ✓ ripple-media — unsigned read refused (${object.status})`);
}

console.log('');
if (leaked > 0) {
  console.error(`✖ ${leaked} surface(s) reachable signed out. Do not launch this.`);
  process.exit(1);
}
console.log('✓ nothing reachable signed out.');
