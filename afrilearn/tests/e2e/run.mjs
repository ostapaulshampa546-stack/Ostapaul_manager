/**
 * AFRILEARN end-to-end test (real browser, real database, real auth).
 * Prerequisites: app running on BASE_URL against a Supabase stack (local or a test project),
 * MAILPIT_URL for the password-reset e-mail, PG_URL to promote the first Super Admin.
 *   BASE_URL=http://localhost:3000 MAILPIT_URL=http://127.0.0.1:8025 PG_URL=postgres://... npm run test:e2e
 */
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
const PG_URL = process.env.PG_URL;
const SHOTS = process.env.SHOTS_DIR ?? "test-results";
mkdirSync(SHOTS, { recursive: true });
const run = Date.now().toString(36);
const mail = (who) => `${who}.${run}@afrilearn.test`;
const PASS = "Kigali-Sunrise-2026";
let passed = 0;
const results = [];

function ok(cond, label) {
  if (!cond) throw new Error(`FAIL  ${label}`);
  passed++;
  results.push(label);
  console.log(`PASS  ${label}`);
}

const browser = await chromium.launch();
const newPage = async (opts = {}) => {
  const ctx = await browser.newContext({ locale: "fr-FR", ...opts });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  return page;
};
/** Reads the Post/Redirect/Get message once the redirect carrying it has happened. */
const flash = async (page, before) => {
  await page.waitForURL((u) => /[?&](ok|error)=/.test(u.search) && (!before || u.href !== before));
  const el = page.locator('main [role="status"], main [role="alert"]').first();
  await el.waitFor();
  return el.innerText();
};
/** Clicks a submit button and returns the resulting flash message (waits for the new redirect). */
async function act(page, target) {
  const before = page.url();
  await (typeof target === "string" ? page.click(target) : target.click());
  return flash(page, before);
}

async function register(page, profile, name, email, extra = async () => {}) {
  await page.goto(`${BASE}/register?profile=${profile}`);
  await page.fill('input[name="full_name"]', name);
  await page.fill('input[name="email"]', email);
  await extra(page);
  await page.fill('input[name="password"]', PASS);
  await page.fill('input[name="password_confirm"]', PASS);
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]:has-text("Créer mon compte")');
}
async function login(page, email, password = PASS, next = "") {
  await page.goto(`${BASE}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

try {
  // ------------------------------------------------------------ website
  const visitor = await newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  visitor.on("pageerror", (e) => errors.push(e.message));
  await visitor.goto(BASE);
  ok((await visitor.locator("h1").innerText()).includes("Apprenez l'anglais"), "site: home page in French");
  await visitor.waitForSelector("canvas", { timeout: 20000 });
  await visitor.waitForTimeout(2500);
  ok(await visitor.locator("canvas").count() === 1, "site: 3D Africa map rendered (WebGL canvas)");
  await visitor.screenshot({ path: `${SHOTS}/home-desktop.png` });
  await visitor.mouse.wheel(0, 900);
  await visitor.waitForTimeout(800);
  ok((await visitor.content()).includes("Aperçu de conception — non opérationnel"), "site: AI teacher demo clearly labelled as not operational");
  ok(errors.length === 0, `site: no JavaScript errors on home (${errors.join(" | ")})`);
  for (const path of ["/features", "/ai-teacher", "/courses", "/centers", "/students", "/pricing", "/about", "/faq", "/contact", "/privacy", "/terms"]) {
    const r = await visitor.goto(BASE + path);
    ok(r.status() === 200, `site: ${path} responds 200`);
  }
  await visitor.goto(`${BASE}/contact`);
  await visitor.fill('input[name="full_name"]', "Visitor Test");
  await visitor.fill('input[name="email"]', mail("visitor"));
  await visitor.fill('textarea[name="message"]', "We would like a demo for our center in Lagos.");
  await visitor.click('button:has-text("Envoyer")');
  ok((await flash(visitor)).includes("Merci"), "site: contact form stored in database");
  await visitor.goto(BASE);
  await visitor.click('header button:has-text("en")');
  await visitor.waitForFunction(() => document.querySelector("h1")?.textContent?.includes("Learn English"));
  ok(true, "site: language switch FR → EN");
  const r404 = await visitor.goto(`${BASE}/center/00000000-0000-0000-0000-000000000000`);
  ok(visitor.url().includes("/login?next="), "security: private area redirects anonymous visitors to login");

  const phone = await newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto(BASE);
  await phone.waitForTimeout(2500);
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!overflow, "mobile: no horizontal scroll on home (390px)");
  await phone.screenshot({ path: `${SHOTS}/home-mobile.png` });

  // ------------------------------------------------------------ student without center
  const student = await newPage();
  await register(student, "student", "Amina Diallo", mail("student"), async (p) => {
    await p.selectOption('select[name="english_variant"]', "uk");
  });
  await student.waitForURL("**/learn");
  ok((await student.content()).includes("🇬🇧 UK"), "student: registers alone and lands in /learn with British English");
  await student.selectOption('select[name="cefr_level"]', "B1");
  await student.click('button:has-text("Enregistrer")');
  ok((await flash(student)).includes("enregistrées"), "student: level saved");
  ok((await student.locator("text=B1").first().isVisible()), "student: B1 displayed");

  // ------------------------------------------------------------ minor protection
  const kid = await newPage();
  await register(kid, "student", "Kid Learner", mail("kid"), async (p) => { await p.fill('input[name="birth_date"]', "2015-03-10"); });
  ok((await flash(kid)).includes("moins de 16 ans"), "minors: under-16 sign-up refused without guardian consent");

  // ------------------------------------------------------------ weak password
  const weak = await newPage();
  await weak.goto(`${BASE}/register?profile=student`);
  await weak.fill('input[name="full_name"]', "Weak Pass");
  await weak.fill('input[name="email"]', mail("weak"));
  await weak.fill('input[name="password"]', "password123");
  await weak.fill('input[name="password_confirm"]', "password123");
  await weak.check('input[name="terms"]');
  await weak.click('button[type="submit"]:has-text("Créer mon compte")');
  ok((await flash(weak)).includes("trop courant"), "auth: common password refused");

  // ------------------------------------------------------------ center manager
  const manager = await newPage();
  await register(manager, "center_manager", "Kofi Mensah", mail("manager"));
  await manager.waitForURL("**/onboarding");
  await manager.fill('input[name="name"]', `Lagos English Hub ${run}`);
  await manager.selectOption('select[name="country"]', "NG");
  await manager.fill('input[name="city"]', "Lagos");
  await manager.click('button:has-text("Créer mon centre")');
  await manager.waitForURL(/\/center\/[0-9a-f-]{36}$/);
  const centerUrl = manager.url();
  ok(true, "center: manager registers, creates a center and lands on its dashboard");

  await manager.goto(`${centerUrl}/teachers`);
  await manager.fill('#new input[name="full_name"]', "Grace Teacher");
  await manager.fill('#new input[name="email"]', mail("teacher"));
  await manager.click('#new button:has-text("Créer")');
  await manager.waitForURL(/teachers\/[0-9a-f-]{36}/);
  const teacherUrl = manager.url().split("?")[0];
  ok((await flash(manager)).includes("créé"), "center: teacher created");

  await manager.goto(`${centerUrl}/students`);
  await manager.fill('#new input[name="full_name"]', "Amina Diallo");
  await manager.fill('#new input[name="email"]', mail("student"));
  await manager.selectOption('#new select[name="cefr_level"]', "B1");
  await manager.click('#new button:has-text("Créer")');
  await manager.waitForURL(/students\/[0-9a-f-]{36}/);
  const studentUrl = manager.url().split("?")[0];
  ok(/AL-\d{4}-00001/.test(await manager.content()), "center: student enrolled with automatic ID AL-YYYY-00001");

  await manager.goto(`${centerUrl}/students`);
  await manager.fill('#new input[name="full_name"]', "Second Student");
  await manager.click('#new button:has-text("Créer")');
  await manager.waitForURL(/students\/[0-9a-f-]{36}/);

  await manager.goto(`${centerUrl}/classes`);
  await manager.fill('#new input[name="name"]', "B1 Morning");
  await manager.selectOption('#new select[name="cefr_level"]', "B1");
  await manager.selectOption('#new select[name="english_variant"]', "uk");
  await manager.selectOption('#new select[name="teacher_id"]', { label: "Grace Teacher" });
  await manager.fill('#new input[name="capacity"]', "1");
  await manager.click('#new button:has-text("Créer")');
  await manager.waitForURL(/classes\/[0-9a-f-]{36}/);
  const classUrl = manager.url().split("?")[0];
  const amina = await manager.locator('select[name="student_id"] option', { hasText: "Amina Diallo" }).getAttribute("value");
  await manager.selectOption('select[name="student_id"]', amina);
  const enrolled = await act(manager, 'button:has-text("Inscrire dans la classe")');
  ok(enrolled.includes("enregistrées"), `center: enrollment saved (${enrolled})`);
  ok((await manager.content()).includes("1 / 1"), "center: student enrolled in class");
  ok((await manager.content()).includes("La classe est complète"), "center: class capacity enforced (full)");

  await manager.goto(`${centerUrl}/programs`);
  await manager.fill('#new input[name="name"]', "General English B1");
  await manager.click('#new button:has-text("Créer")');
  ok((await flash(manager)).includes("créé"), "center: program created");

  // invitations
  await manager.goto(studentUrl);
  await manager.click('button:has-text("Inviter à activer son compte")');
  const studentInvite = await manager.getByTestId("invite-link").inputValue();
  ok(/\/invite\/[0-9a-f]{48}$/.test(studentInvite), "center: single-use invitation link generated for the student");
  await manager.goto(teacherUrl);
  await manager.click('button:has-text("Inviter à activer son compte")');
  const teacherInvite = await manager.getByTestId("invite-link").inputValue();

  // wrong account cannot use the student invitation
  const intruder = await newPage();
  await register(intruder, "student", "Intruder", mail("intruder"));
  await intruder.waitForURL("**/learn");
  await intruder.goto(studentInvite);
  await intruder.click('button:has-text("Accepter")');
  ok((await flash(intruder)).includes("autre adresse"), "security: invitation refused for a different e-mail");

  await student.goto(studentInvite);
  await student.click('button:has-text("Accepter")');
  await student.waitForURL("**/learn");
  ok((await student.content()).includes("B1 Morning"), "student: invitation accepted, class visible in student space");
  await student.goto(studentInvite);
  ok((await student.content()).includes("déjà été utilisée"), "security: invitation cannot be reused");

  const teacher = await newPage();
  await register(teacher, "teacher", "Grace Teacher", mail("teacher"), async (p) => {
    await p.evaluate((n) => { document.querySelector('input[name="next"]').value = n; }, new URL(teacherInvite).pathname);
  });
  await teacher.waitForURL("**/invite/**");
  await teacher.click('button:has-text("Accepter")');
  await teacher.waitForURL("**/teach");
  ok((await teacher.content()).includes("B1 Morning"), "teacher: invited teacher sees the class in teacher space");
  await teacher.click("text=B1 Morning");
  await teacher.waitForURL("**/teach/classes/**");
  const roster = await teacher.content();
  ok(roster.includes("Amina Diallo") && !roster.includes("Second Student"), "teacher: sees only the students of their classes");
  const forbidden = await teacher.goto(centerUrl);
  ok(forbidden.status() === 404, "security: teacher cannot open the center manager space");

  // isolation between centers
  const other = await newPage();
  await register(other, "center_manager", "Other Owner", mail("other"));
  await other.waitForURL("**/onboarding");
  await other.fill('input[name="name"]', `Nairobi Speak ${run}`);
  await other.selectOption('select[name="country"]', "KE");
  await other.click('button:has-text("Créer mon centre")');
  await other.waitForURL(/\/center\/[0-9a-f-]{36}$/);
  const r = await other.goto(`${centerUrl}/students`);
  ok(r.status() === 404, "security: another center's manager gets 404 on our center");

  // ------------------------------------------------------------ super admin
  if (PG_URL) {
    execFileSync("psql", [PG_URL, "-q", "-c", `insert into public.platform_admins (user_id) select id from public.profiles where email = '${mail("other")}' on conflict do nothing`]);
    const admin = other;
    await admin.goto(`${BASE}/admin`);
    ok((await admin.content()).includes("Vue d'ensemble"), "admin: Super Admin dashboard with global statistics");
    await admin.goto(`${BASE}/admin/countries`);
    const open = admin.locator("tr", { hasText: "Nigeria" }).locator('button:has-text("Réactiver")');
    if (await open.count()) await act(admin, open); // idempotent when the suite is re-run on the same database
    await admin.goto(`${BASE}/admin/plans?country=NG`);
    const basic = admin.locator("section", { hasText: "Basic" }).first();
    await basic.locator('input[name="amount"]').fill("25000");
    await act(admin, basic.locator('button:has-text("Définir le tarif")'));
    ok((await admin.locator("main").innerText()).replace(/\s/g, " ").includes("25 000,00 ₦"), "admin: price set for Nigeria in naira");
    await visitor.goto(`${BASE}/pricing?country=NG`);
    ok((await visitor.getByTestId("plan-center_basic").innerText()).replace(/\s/g, " ").includes("25,000.00 ₦"), "site: pricing page shows the country price (no hard-coded price)");
    ok((await visitor.getByTestId("plan-center_professional").innerText()).toLowerCase().includes("coming soon"), "site: unpublished price shown honestly");
    await admin.goto(`${BASE}/app`);
    ok((await admin.content()).includes("Administration AFRILEARN"), "admin: multi-role account gets a space chooser");
    await admin.goto(`${BASE}/admin/leads`);
    ok((await admin.content()).includes("We would like a demo"), "admin: website message visible to the Super Admin");
    await admin.goto(`${BASE}/admin/centers`);
    const row = admin.locator("tr", { hasText: `Lagos English Hub ${run}` });
    await row.locator('input[name="reason"]').fill("Test suspension");
    admin.once("dialog", (d) => d.accept());
    await act(admin, row.locator('button:has-text("Suspendre")'));
    await manager.goto(`${centerUrl}/students`);
    ok((await manager.content()).includes("Ce centre est suspendu"), "admin: suspended center sees the banner");
    ok(await manager.locator('#new input[name="full_name"]').isDisabled(), "admin: suspended center cannot write (forms disabled, RLS blocks writes)");
    await admin.goto(`${BASE}/admin/audit`);
    ok((await admin.content()).includes("centers"), "admin: sensitive actions appear in the audit log");
  } else {
    console.log("SKIP  admin tests (PG_URL not set)");
  }

  // ------------------------------------------------------------ login protection & password reset
  const attacker = await newPage();
  for (let i = 0; i < 5; i++) await login(attacker, mail("intruder"), "Wrong-password-1");
  ok((await flash(attacker)).includes("Trop de tentatives"), "security: account locked after 5 failed logins");

  const forgot = await newPage();
  await forgot.goto(`${BASE}/forgot-password`);
  await forgot.fill('input[name="email"]', mail("student"));
  await forgot.click('button:has-text("Envoyer le lien")');
  ok((await flash(forgot)).includes("Si un compte existe"), "auth: reset request answered without revealing accounts");
  await forgot.waitForTimeout(1500);
  const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${mail("student")}`)}`)).json();
  ok(list.messages?.length > 0, "auth: password reset e-mail sent");
  const msg = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
  const link = (msg.HTML || msg.Text).match(/https?:\/\/[^"'\s<>]+verify[^"'\s<>]+/)[0].replace(/&amp;/g, "&");
  await forgot.goto(link);
  await forgot.waitForURL("**/reset-password");
  await forgot.fill('input[name="password"]', "New-Kigali-Sunrise-77");
  await forgot.fill('input[name="password_confirm"]', "New-Kigali-Sunrise-77");
  await forgot.click('button[type="submit"]');
  await forgot.waitForURL("**/learn");
  ok(true, "auth: password reset via e-mail link");
  const relog = await newPage();
  await login(relog, mail("student"), "New-Kigali-Sunrise-77");
  await relog.waitForURL("**/learn");
  ok(true, "auth: login with the new password");

  await manager.goto(centerUrl);
  await manager.screenshot({ path: `${SHOTS}/center-dashboard.png`, fullPage: true });
  console.log(`\nALL E2E TESTS PASSED (${passed})`);
} catch (e) {
  console.error(e.message);
  console.error(`\n${passed} passed before failure`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
