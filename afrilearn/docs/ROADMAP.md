# AFRILEARN — Development plan and validation criteria

Each phase starts with its scope and validation criteria and ends only when the criteria pass in automated tests.

## Phase 1 — Identity, 3D website, accounts, administration, centers ✅ delivered

| Scope | Validation criterion | Proof |
|---|---|---|
| Visual identity (logo, night blue / royal blue / gold / white, Sora + Inter) shared by site and app | Same tokens in `globals.css` used everywhere | build |
| 3D website: Africa map with city links, books, headphones, laptop, graduation cap; 12 pages; FR/EN | All pages 200, WebGL canvas renders, no JS errors, no horizontal scroll at 390 px | e2e |
| Honest status of modules (nothing unavailable shown as operational) | Only phase-1 modules flagged "available"; AI demo labelled "not operational" | unit + e2e |
| Sign-up with profile choice, login, logout, password reset | Each profile lands in its space; reset e-mail works; new password logs in | e2e |
| Login protection, password policy, minor protection | Lock after 5 failures; weak password refused; under-16 without guardian refused | e2e + SQL |
| Super Admin: users, centers, countries & currencies, plans & per-country prices, website messages, admins, audit | Price set for a country appears on the public pricing page; center suspension blocks writes | e2e + SQL |
| Center Manager: students (auto ID), teachers, classes (capacity), programs, team, invitations, settings, log | Full journey in browser; capacity enforced; invitations single-use and e-mail-bound | e2e + SQL |
| Teacher space | Sees only own classes and their students; cannot open manager space | e2e + SQL |
| Student space (with or without center) | Level & US/UK variant saved; classes visible after invitation | e2e |
| Tenant isolation | Another center gets 404; RLS denies cross-center reads/writes | e2e + SQL |

## Phase 2 — Academy, exams, grades, certificates (next)

Scope: course catalog (course → module → chapter → lesson) with video, audio, PDF (Supabase Storage, compressed renditions); exercises and quizzes (MCQ, gap-fill, matching, ordering) with automatic marking; progress and "resume where you left off"; teacher-authored lessons and homework; timed online exams; written/oral assessments marked by teachers; averages, rankings, report cards; certificates with unique number + public verification page, clearly typed "internal attestation" vs "accredited certification"; placement test.

Validation: a teacher publishes a lesson and a quiz, a student completes it, the score is auto-computed and visible to both; progress resumes after logout; an exam respects its time limit server-side; a certificate number verifies publicly and a forged number does not; all new tables isolated by center (SQL tests).

## Phase 3 — AI Teacher

Scope: provider-agnostic adapters for LLM (e.g. Claude), speech-to-text and text-to-speech (US and UK voices); conversation store; level-adapted (A1–C2) and variant-respecting prompts; voice UI (mic, waveform, speaking animation, transcript, replay); per-turn corrections and error report; pronunciation scoring; usage metering per plan.

Validation: real API round-trips in staging; the variant is respected (UK spelling/vocabulary checks on outputs); usage limits enforced; the UI states clearly when a provider is not configured.

## Phase 4 — Classroom, Marketplace, Community, payments, subscriptions

Scope: virtual classes (WebRTC provider, whiteboard, screen share, chat, recording when allowed); marketplace (publication, orders, commissions, reviews, creator management); community (groups, daily challenges, contests, badges, leaderboards); payment adapters per country (M-Pesa, Airtel Money, Orange Money, MTN MoMo, cards via an aggregator), server-side verification + webhooks, transaction history; subscriptions applying plan limits.

Validation: sandbox payments verified server-side only (a payment is never marked paid without provider confirmation); webhooks idempotent; plan limits enforced in SQL.

## Phase 5 — Hardening and launch

Load tests, security review / penetration test, backups and restore drill, monitoring, legal review per launch country (data protection, minors), production deployment and domain, regional rollout.

## Production prerequisites (owner decisions)

* A Supabase project (EU or nearest region) and a Vercel (or other Node) project + domain.
* SMTP provider for auth e-mails (Supabase's built-in sender is rate-limited).
* Country list and prices to publish (entered in /admin — no code change).
* For later phases: LLM/speech API keys, video provider, payment aggregator accounts.
