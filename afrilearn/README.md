# AFRILEARN — The complete African learning ecosystem

One Next.js application serving **both** the immersive 3D marketing website and the multi-tenant SaaS:

| URL | Component |
|---|---|
| `/`, `/features`, `/ai-teacher`, `/courses`, `/centers`, `/students`, `/pricing`, `/about`, `/faq`, `/contact`, `/privacy`, `/terms` | 3D website (public) |
| `/register`, `/login`, `/forgot-password`, `/reset-password` | Authentication |
| `/app` | Entry point: routes each role to its space (or lets multi-role accounts choose) |
| `/admin/*` | Super Admin |
| `/center/[id]/*` | Center Manager (one private space per center) |
| `/teach/*` | Teacher space |
| `/learn` | Student space (works with or without a center) |
| `/invite/[token]` | Single-use invitation to link an account to a center |

Stack: Next.js 15 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Three.js + React Three Fiber · Framer Motion · Supabase (PostgreSQL, Auth, Row Level Security) · Zod.

**Status: Phase 1 delivered and tested.** See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the five phases and their validation criteria, and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the technical design.

## Run locally

```bash
cd afrilearn
npm install
cp .env.example .env.local        # Supabase URL + anon key (+ service role key for the login guard)
npm run dev
```

Database: apply `supabase/migrations/*.sql` in order (`npx supabase db push` on a linked project, or the SQL editor).
Then make yourself Super Admin once your account exists:

```sql
insert into public.platform_admins (user_id) select id from public.profiles where email = 'you@example.com';
```

In Supabase Auth settings, set the Site URL to your domain and add `https://<domain>/auth/callback` to the redirect URLs.

## Tests

| Command | What it checks | Last result |
|---|---|---|
| `npm run typecheck` | TypeScript strict | ✅ |
| `npm test` | Unit tests: password policy, redirects, validation, 3D map data, "only phase-1 modules marked available" | ✅ 10/10 |
| `PGHOST=… PGPORT=… npm run test:db` | SQL tests on a disposable Postgres: tenant isolation, roles, invitations, capacity, suspension, minors, audit, rate limits | ✅ 69/69 |
| `BASE_URL=… PG_URL=… MAILPIT_URL=… npm run test:e2e` | Real browser against a real Supabase stack (auth + PostgREST + Postgres 17): full journeys for visitor, student, minor, center, teacher, admin, brute force, password reset by e-mail | ✅ 53/53 |

## What is real today vs. coming

Operational (Phase 1): website + 3D, FR/EN, accounts and roles, protected login, password reset, Super Admin, centers, students, teachers, classes, programs, invitations, team, audit log, per-country pricing configuration.

Not yet built, and labelled as such everywhere in the UI: Academy, exams & certificates (phase 2), AI teacher (phase 3), Classroom, Marketplace, Community, payments & subscriptions (phase 4). The AI teacher section on the website is an explicitly labelled design preview, not a working feature. No payment is ever simulated.
