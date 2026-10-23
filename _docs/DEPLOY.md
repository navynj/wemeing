# Shipping Weming

P1's last session: cloud Supabase, Vercel, during.today. Written as a
checklist because it is done once and then referred to when something breaks.

**Read `CLAUDE.md` § "Data is real now" first.** Production has no backups but
the ones we take, and `db reset` is never pointed at it.

## 0. What I cannot do for you

Three things need your browser and your account. Everything else is scripted.

```bash
supabase login                    # opens a browser; run it as `! supabase login`
pnpm dlx vercel login             # or use the dashboard, below
```

The Google Cloud console change in step 3 is by hand, deliberately: it is the
one place where a wrong value fails silently.

## 1. The Supabase project — DONE

**Project `during`, ref `yjwkjvzbbujoapeuyjul`, region `us-west-1`**, in the
Whaleblue Studio org. It already existed; no second project was created.

**G3's second-free-org plan turned out to be unnecessary.** The org holds two
projects — `Plot`, which is INACTIVE (paused, so it does not hold an active
slot), and `during`. Nothing had to be deleted or moved. G3's reasoning still
stands for the day a third project is wanted.

```bash
supabase link --project-ref yjwkjvzbbujoapeuyjul
pnpm backup                       # mandatory; the free tier keeps none
pnpm db:push                      # refuses without a dump from today
```

Applied `0001`–`0004`, `"seeds":[]` — nothing seeded prod. Migration `0003`
created the private `ripple-media` bucket, confirmed present and `public =
false`.

**`0005_splash_pivot` is pending (H20).** It drops the
`ripples_top_level_no_overlap` exclusion constraint, so `pnpm db:push` will
refuse it until the approval from the session brief is passed through, after
today's backup:

```bash
pnpm backup
DURING_DDL_APPROVED='drop the btree_gist exclusion constraint by migration (it now rejects legitimate overlapping records)' pnpm db:push
```

Afterwards the catalogue check below reads one constraint fewer and one
policy more (`splashes belong to their owner`); the four triggers are
unchanged, dormant with inner ripples.

**`0006_date_only_span` is pending too.** It drops the
`ripples_ended_needs_time` check and adds `ripples_ended_needs_date` in its
place, so a fragment can span to an end date with no clock (time is
optional). Approved and applied to the local stack on 2026-09-27; the
DB-backed `date-only-span` suite covers it. Push it with today's backup and
the approval passed through:

```bash
pnpm backup
DURING_DDL_APPROVED='drop the ripples_ended_needs_time check by migration. time is optional. for ripple.' pnpm db:push
``` Existing rows are untouched: every
one keeps its `occurred_on`, and only fragments written from now on can be
unannotated. The Focus lane retires by hand in-app once it is empty; a lane
holding records refuses deletion, so nothing here moves a record.

### Verified live

```bash
pnpm verify:prod        # signed out, every table must be empty or refused
```

All thirteen tables empty, unsigned bucket read refused (400).

**On its own that is a weak signal against an empty database** — every table
is empty regardless, so it cannot tell "RLS on" from "no data". What settles
it is the shipped schema: 13 tables, **13 with RLS enabled, none missing**, 21
policies, 10 functions, all four triggers (`ripples_set_started_at`,
`ripples_check_inner`, `ripples_parent_contains_children`,
`ripples_touch_last_active`) and the `ripples_top_level_no_overlap` exclusion
constraint. Checked against the live catalogue:

```bash
supabase db query --linked "select tgname from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  where not tgisinternal and relname = 'ripples';"
```

`pnpm verify:prod` keeps its value once real records exist, which is when a
missing policy would actually leak something.

Then, signed in on the deployed site, confirm a second account cannot see your
rows. The local suite proves the policies; this proves they shipped.

### Seeds cannot reach it

`pnpm seed:me` runs `docker exec` against the local container — it has no path
to a remote project at all. `pnpm db:reset` refuses outright (see CLAUDE.md
§ "Data is real now"). Neither is a matter of remembering.

### Prod starts empty — her call, made in the deploy session

No data migration. Local records stay local and keep being dumped; production
begins with nothing and fills up from the phone. This doubles as the one eye
check the empty states have never had: the first sign-in shows a zero-record
Home, an empty Lanes and an empty Trail for real rather than in a test.

Carrying the archive over stays possible later — it needs an author_id remap
(local and prod auth are different stacks, so every uuid differs) and a manual
re-upload of media objects. Nothing here forecloses it.

## 2. Auth on the cloud project — DONE

| Field | Value |
| --- | --- |
| Site URL | `https://during.today` |
| Redirect URLs | `https://during.today/auth/callback` |
| Google provider | enabled, same client ID and secret as local |

Set through the Management API rather than the dashboard, three keys at a
time:

```bash
TOKEN="$(security find-generic-password -s 'Supabase CLI' -a supabase -w)"
curl -X PATCH "https://api.supabase.com/v1/projects/<ref>/config/auth" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"site_url":"...","uri_allow_list":"...","external_google_enabled":true,
       "external_google_client_id":"...","external_google_secret":"..."}'
```

The token is the one `supabase login` already stored in the keychain, so
there is no second credential to manage. Verified afterwards that
`mfa_totp_enroll_enabled` is still true — nothing outside those keys moved.

`supabase/config.toml` stays pointed at local — it is the local stack's
config, and changing it would send local sign-ins to production.

**The S0 lesson, restated:** `additional_redirect_urls` is matched as an exact
string and a miss falls back to Site URL **silently**. `lib/site.ts` builds
every redirect from `NEXT_PUBLIC_SITE_URL` for exactly this reason, and the
timezone travels in a cookie rather than a query parameter because a query
string is enough to miss the match.

**Symptom when this is missing:** sign-in returns
`Unsupported provider: provider is not enabled` (a 400, `validation_failed`).
The provider is off, not misconfigured — nothing about the client ID or the
redirect URIs will change it.

### Why not `supabase config push`

`config push` has no scope filter — it is the whole file or nothing, and
`supabase config diff` against this project reports **17 differences**. Most
are local-dev conveniences that have no business on production: MFA enrolment
off, OTP length 6, email confirmations off, Twilio disabled, a smaller pooler.
Pushing two correct values by dragging fifteen wrong ones along is not a
trade worth making, so `config.toml` stays the local stack's config and prod
auth is set in the dashboard.

## 3. Google Cloud console — by hand

<https://console.cloud.google.com/apis/credentials> → the **existing** OAuth
client (no new one; a second client means a second consent record).

**Authorized redirect URIs → Add:**

```
https://<project-ref>.supabase.co/auth/v1/callback
```

That is Supabase's callback, not the app's. The browser goes
Google → Supabase → `during.today/auth/callback`, and Google only ever needs
the middle one. Keep the existing `http://127.0.0.1:54321/auth/v1/callback`
entry: local dev still uses it.

**Do not touch** the consent screen. It stays in **Testing** with your account
as the only test user until P2 — publishing it starts a verification review
that a closed-group app does not need.

## 4. Vercel

Import the repo (`navynj/during`). Framework preset: Next.js.

`vercel.json` sets the build command to `pnpm verify && next build`, so every
deploy runs ESLint, the design-token guard, and the test suite minus the
files that need a live Postgres (`vitest.ci.config.ts` names them).

### Environment variables — all four, Production and Preview

| Name | Value | Reaches |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | browser and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the project's anon key | browser and server |
| `NEXT_PUBLIC_SITE_URL` | `https://during.today` | browser and server |
| `SUPABASE_SERVICE_ROLE_KEY` | the project's service role key | **server only** |

The three `NEXT_PUBLIC_` values reach the browser by design — the anon key is
a public identifier, and RLS is what protects the data.

**`SUPABASE_SERVICE_ROLE_KEY` is server-only and required.** It bypasses RLS,
so it must never be `NEXT_PUBLIC_` and should be marked *Sensitive* in
Vercel. It is needed because the `ripple-media` bucket is private: the
service role signs photo URLs (`lib/media.ts`, after the viewer's own session
has passed the RLS visibility check) and removes objects on delete. Nothing
else imports it, and `lib/env.ts` is the only place it is read.

**The photo incident.** An earlier version of this page said the service key
never goes to Vercel. It was missing on the first photo deploy, the service
client threw a generic "supabaseKey is required" from inside Home's render,
and the whole site was down. Two guards came out of it:

- `instrumentation.ts` checks the four variables once at server startup and
  fails with `Missing <NAME>` — the log says what to set. Every read goes
  through `lib/env.ts`, which names the variable the same way, and no client
  is created at a module's top level, so one missing value cannot poison a
  route's chunk.
- Media signing is fallible per item: a photo that cannot be signed renders
  a quiet placeholder tile, and the page renders. `signOwnMedia` never throws.

**These never go to Vercel:**

- `SUPABASE_AUTH_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_GOOGLE_SECRET` — these
  configure the *local* Supabase stack. In cloud, Supabase holds them.

### Domain

Vercel → Settings → Domains: add the apex and its `www`. Follow the registrar
instructions Vercel prints.

**The domain is nowhere in the repo.** `vercel.json` redirects `www` to the
apex by matching `www\.(?<apex>.*)` and sending the request to `:apex`, so it
works for whatever domain the project is attached to. The app learns its
origin from `NEXT_PUBLIC_SITE_URL` and nothing else — `lib/site.ts` is the
only reader — so one build serves a preview, a local run and production.
`pnpm lint` fails if the production domain appears in `app/`, `features/`,
`components/`, `lib/`, or the config files.

## 5. Prod smoke

Sign in on the phone, then walk the backlog. This is the P1 definition of
done, on the device it was built for:

- [ ] Drop from all three entry points: FAB, timeline slot, lane chip
- [ ] A manual past span → renders as a bundle
- [ ] A plan with a future span → planned, reduced opacity
- [ ] Timer → now band → `/now` → Break (bubbles) → inner drop → Stop
- [ ] A deliberate overlap → the collision is named, with the nest offer
- [ ] An All-day note
- [ ] Edit a note, a time, an end
- [ ] A retroactive inner ripple on a finished session
- [ ] A photo from the phone camera
- [ ] Delete a session that has an inner ripple → both gone, media too
- [ ] Walk Lanes, then the Trail
- [ ] Add to Home Screen → opens standalone, no browser chrome

## Afterwards

**Weekly-ish `pnpm backup` is yours to run.** The free tier keeps no backups;
these dumps are the only copy. Object bytes are not in them — Postgres does
not hold them — so a full restore re-uploads media by hand.
