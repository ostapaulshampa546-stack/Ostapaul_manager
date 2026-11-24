# AFRILEARN — Architecture

```
Browser (phone first) ──► Next.js 15 (Vercel or any Node host)
   │   • public website: server-rendered, 3D hero loaded lazily on the client
   │   • app: server components + server actions (forms work without JS → low bandwidth)
   │   • middleware refreshes the Supabase session and guards private areas
   ▼
Supabase
   • Auth (bcrypt passwords, e-mail confirmation, password recovery, PKCE)
   • PostgreSQL 15+ with Row Level Security on every table  ◄── single source of truth for permissions
   • (phase 2+) Storage for documents, audio, video, certificates
   ▼
External services (later phases, behind adapters): LLM, speech-to-text, text-to-speech, video rooms, Mobile Money aggregators
```

## Multi-tenancy

Every business row carries `center_id`. Access is decided **in the database**, so a bug or a hand-crafted request in the web layer cannot leak another center's data.

| Rule | Mechanism |
|---|---|
| Center data visible only to its members and the Super Admin | `is_center_member()`, `is_center_manager()` in RLS policies |
| Teachers see only their classes and the students enrolled in them | `teacher_sees_class()`, `teacher_sees_student()` |
| Students see only their own record and classes | `my_student_ids()`, `student_in_class()` |
| A class can only use a teacher / program / student of the same center | composite foreign keys `(id, center_id)` |
| Suspended center: read-only | `can_manage_center()` = manager **and** center active |
| Suspended user: loses every right immediately | helpers check `profiles.is_suspended` |
| Clients cannot set `account_type`, `is_suspended`, `user_id`, `student_number` | column-level `GRANT`s + triggers |
| Account ↔ record linking only through a single-use invitation whose e-mail must match | `create_invitation()` / `accept_invitation()`; only the SHA-256 of the token is stored |
| Super Admin actions | `require_platform_admin()` inside each RPC |
| Audit of sensitive changes without copying personal data | `audit_row()` trigger stores ids and changed field names/values |

## Security

* Login guard: 5 failures → account locked 30 min, 30 failures/hour → IP locked; e-mails stored only as SHA-256 (`login_attempts`, service-role only).
* Password policy (`src/lib/password.ts`): length, character mix, common passwords, sequences, repetitions, personal info.
* Minors: under-16 student sign-up requires guardian e-mail + consent (stored with timestamp).
* Contact form: honeypot + DB rate limit (3/hour per e-mail, 30/min global).
* Only same-site redirects (`safeNext`), security headers (HSTS, frame denial, nosniff, referrer policy), no `X-Powered-By`.
* The service-role key is used only for the login guard, never for user data.

## Internationalisation

Dictionaries in `src/lib/i18n/{fr,en}.ts` (English typed against French, so a missing key fails the build). Locale = cookie, else `Accept-Language`, else French; a profile's language is restored at login. Add a language by adding a dictionary.

## Pricing

`plans` (content, features, limits) and `plan_prices` (country × period × amount in the country's currency). **No price lives in the code.** The pricing page shows "price coming soon" when a country has none.

## Performance on limited connections

* App pages: server-rendered HTML, ~105 kB shared JS, no client data fetching.
* 3D: loaded only on the home page via dynamic import, skipped (SVG poster) when WebGL is missing or Save-Data / 2G is detected, lighter grid and no floating objects on phones, paused when off-screen, static with `prefers-reduced-motion`.
* Fonts self-hosted by `next/font`.

## Data model (phase 1)

`currencies`, `countries`, `profiles`, `platform_admins`, `centers`, `memberships`, `teachers`, `students`, `programs`, `classes`, `class_students`, `invitations`, `plans`, `plan_prices`, `leads`, `audit_log`, `login_attempts`.
