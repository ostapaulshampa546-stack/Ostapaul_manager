/**
 * Écrans de la démonstration « Comment s'inscrire », dessinés sur un canvas 2D.
 * Utilisés comme texture de l'écran du téléphone 3D, ou directement (mode léger).
 */

export const SCREEN_W = 360;
export const SCREEN_H = 720;
export const STEP_SECONDS = 5;

export const DEMO_STEPS = [
  { title: "Ouvrez le site", text: "Allez sur le site OSTAPAUL MANAGER et touchez « Essai gratuit »." },
  { title: "Créez votre compte", text: "Saisissez votre nom, votre téléphone, votre e-mail et un mot de passe d'au moins 8 caractères." },
  { title: "Créez votre établissement", text: "Choisissez votre secteur (restaurant, école ou PME), donnez son nom et choisissez la formule." },
  { title: "C'est prêt !", text: "Votre espace est créé : utilisez toutes les fonctions pendant l'essai gratuit, sans payer." },
] as const;

const NAVY = "#0B1F4B";
const BLUE = "#1E6BFF";
const GOLD = "#E5BF4F";
const SLATE = "#64748B";
const LINE = "#E2E8F0";

type Ctx = CanvasRenderingContext2D;

function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); }
}

function text(g: Ctx, s: string, x: number, y: number, size: number, color: string, weight = 400, align: CanvasTextAlign = "left") {
  g.font = `${weight} ${size}px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = "alphabetic";
  g.fillText(s, x, y);
}

const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
/** Partie d'un texte « tapée » entre les instants a et b (0..1). */
const typed = (s: string, t: number, a: number, b: number) => s.slice(0, Math.round(s.length * ease((t - a) / (b - a))));

function statusBar(g: Ctx) {
  text(g, "9:41", 22, 30, 13, NAVY, 600);
  rr(g, 140, 12, 80, 24, 12, "#0F172A");
  rr(g, 300, 19, 22, 11, 3, undefined, NAVY);
  rr(g, 302, 21, 15, 7, 2, NAVY);
}

function browserBar(g: Ctx, url: string) {
  rr(g, 14, 44, 332, 32, 16, "#F1F5F9");
  text(g, "🔒 " + url, 180, 65, 12, SLATE, 500, "center");
}

function logo(g: Ctx, x: number, y: number) {
  g.lineWidth = 5;
  g.strokeStyle = BLUE;
  g.beginPath(); g.arc(x + 12, y + 12, 10, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = GOLD;
  g.beginPath(); g.arc(x + 12, y + 12, 10, -Math.PI / 2, 0); g.stroke();
  text(g, "OSTAPAUL", x + 30, y + 12, 13, NAVY, 800);
  text(g, "MANAGER", x + 30, y + 26, 10, GOLD, 700);
}

function button(g: Ctx, label: string, x: number, y: number, w: number, h: number, bg: string, fg: string, pressed: number) {
  const s = 1 - 0.05 * pressed;
  const cx = x + w / 2, cy = y + h / 2;
  g.save();
  g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy);
  g.shadowColor = "rgba(15,23,42,0.18)"; g.shadowBlur = 12 * (1 - pressed); g.shadowOffsetY = 4;
  rr(g, x, y, w, h, h / 2, bg);
  g.restore();
  text(g, label, cx, cy + 5, 15, fg, 700, "center");
}

/** Cercle de « doigt » qui touche l'écran. */
function tap(g: Ctx, x: number, y: number, t: number, at: number) {
  const d = t - at;
  if (d < -0.12 || d > 0.2) return;
  const appear = ease((d + 0.12) / 0.12);
  g.save();
  g.globalAlpha = 0.85 * appear * (d > 0 ? 1 - d / 0.2 : 1);
  rr(g, x - 16, y - 16, 32, 32, 16, "rgba(30,107,255,0.25)", BLUE);
  if (d > 0) {
    g.globalAlpha = 0.5 * (1 - d / 0.2);
    g.beginPath(); g.arc(x, y, 16 + d * 160, 0, Math.PI * 2);
    g.strokeStyle = BLUE; g.lineWidth = 2; g.stroke();
  }
  g.restore();
}

function field(g: Ctx, label: string, value: string, x: number, y: number, w: number, focused: boolean, caret: boolean) {
  text(g, label, x, y, 11, SLATE, 600);
  rr(g, x, y + 6, w, 36, 10, "#FFFFFF", focused ? BLUE : LINE);
  text(g, value, x + 12, y + 30, 14, NAVY, 500);
  if (focused && caret) {
    g.font = "500 14px Inter, system-ui, sans-serif";
    const cw = g.measureText(value).width;
    g.fillStyle = BLUE; g.fillRect(x + 13 + cw, y + 16, 1.5, 18);
  }
}

function home(g: Ctx, t: number, trial: string) {
  browserBar(g, "ostapaul-manager.vercel.app");
  logo(g, 22, 96);
  rr(g, 0, 136, SCREEN_W, 300, 0, NAVY);
  text(g, "Un seul logiciel.", 24, 196, 26, "#FFFFFF", 800);
  text(g, "Trois secteurs.", 24, 228, 26, "#FFFFFF", 800);
  text(g, "Une gestion intelligente.", 24, 260, 26, GOLD, 800);
  text(g, "Restaurants · Écoles · PME", 24, 292, 14, "rgba(255,255,255,0.75)", 500);
  const pressed = t > 0.55 && t < 0.68 ? 1 : 0;
  button(g, `Essai gratuit${trial ? ` de ${trial}` : ""}`, 24, 330, 312, 50, GOLD, NAVY, pressed);
  ["🍽️ Restaurant", "🎓 École", "💼 PME"].forEach((s, i) => {
    rr(g, 24 + i * 106, 462, 96, 78, 14, "#FFFFFF", LINE);
    const [icon, ...rest] = s.split(" ");
    text(g, icon, 72 + i * 106, 495, 22, NAVY, 400, "center");
    text(g, rest.join(" "), 72 + i * 106, 522, 12, NAVY, 600, "center");
  });
  rr(g, 24, 566, 312, 90, 14, "#F8FAFC", LINE);
  text(g, "✓ Sans installation", 40, 596, 13, NAVY, 600);
  text(g, "✓ Fonctionne sur téléphone", 40, 620, 13, NAVY, 600);
  text(g, "✓ Paiement en USD ou CDF", 40, 644, 13, NAVY, 600);
  tap(g, 230, 356, t, 0.6);
}

function signup(g: Ctx, t: number, caret: boolean) {
  browserBar(g, "…/signup");
  logo(g, 22, 96);
  text(g, "Créer votre compte", 24, 166, 22, NAVY, 800);
  const v = [
    ["Nom complet", typed("Marie Kabila", t, 0.05, 0.22)],
    ["Téléphone", typed("+243 81 234 56 78", t, 0.24, 0.4)],
    ["E-mail", typed("marie@exemple.cd", t, 0.42, 0.58)],
    ["Mot de passe", "•".repeat(Math.round(12 * ease((t - 0.6) / 0.14)))],
  ] as const;
  const focus = t < 0.23 ? 0 : t < 0.41 ? 1 : t < 0.59 ? 2 : t < 0.76 ? 3 : -1;
  v.forEach(([l, val], i) => field(g, l, val, 24, 196 + i * 66, 312, focus === i, caret));
  if (t > 0.72) {
    g.globalAlpha = ease((t - 0.72) / 0.06);
    text(g, "✓ Mot de passe solide", 24, 472, 12, "#16A34A", 700);
    g.globalAlpha = 1;
  }
  const pressed = t > 0.84 && t < 0.95 ? 1 : 0;
  button(g, "Créer mon compte", 24, 500, 312, 50, GOLD, NAVY, pressed);
  text(g, "Déjà inscrit ? Se connecter", 180, 584, 13, SLATE, 500, "center");
  tap(g, 180, 525, t, 0.88);
}

function establishment(g: Ctx, t: number, caret: boolean) {
  browserBar(g, "…/onboarding");
  text(g, "Votre établissement", 24, 120, 22, NAVY, 800);
  text(g, "Secteur", 24, 152, 11, SLATE, 600);
  const chosen = t > 0.2 ? 0 : -1;
  ["🍽️|Restaurant", "🎓|École", "💼|PME"].forEach((s, i) => {
    const [icon, label] = s.split("|");
    const on = chosen === i;
    rr(g, 24 + i * 106, 162, 96, 84, 14, on ? "#E8F0FF" : "#FFFFFF", on ? BLUE : LINE);
    text(g, icon, 72 + i * 106, 198, 24, NAVY, 400, "center");
    text(g, label, 72 + i * 106, 228, 12, NAVY, 700, "center");
  });
  tap(g, 72, 204, t, 0.18);
  field(g, "Nom de l'établissement", typed("Restaurant La Belle Vue", t, 0.3, 0.55), 24, 276, 312, t > 0.28 && t < 0.6, caret);
  text(g, "Formule", 24, 356, 11, SLATE, 600);
  ["Basic", "Standard", "Premium"].forEach((s, i) => {
    const on = (t > 0.66 ? 1 : -1) === i;
    rr(g, 24 + i * 106, 366, 96, 40, 12, on ? NAVY : "#FFFFFF", on ? NAVY : LINE);
    text(g, s, 72 + i * 106, 391, 13, on ? "#FFFFFF" : NAVY, 700, "center");
  });
  tap(g, 178, 386, t, 0.64);
  field(g, "Devise principale", "Dollar (USD)", 24, 430, 150, false, false);
  field(g, "Ville", "Kinshasa", 186, 430, 150, false, false);
  const pressed = t > 0.84 && t < 0.95 ? 1 : 0;
  button(g, "Créer et démarrer", 24, 520, 312, 50, GOLD, NAVY, pressed);
  tap(g, 180, 545, t, 0.88);
}

function dashboard(g: Ctx, t: number, trial: string) {
  rr(g, 0, 44, SCREEN_W, 64, 0, NAVY);
  text(g, "Restaurant La Belle Vue", 20, 82, 16, "#FFFFFF", 800);
  text(g, "☰", 330, 84, 20, "#FFFFFF", 400, "center");
  const a = ease(t / 0.25);
  g.globalAlpha = a;
  rr(g, 16, 124, 328, 70, 14, "#DCFCE7", "#86EFAC");
  text(g, "🎉 Bienvenue !", 32, 152, 16, "#166534", 800);
  text(g, `Essai gratuit actif${trial ? ` : ${trial}` : ""}`, 32, 177, 13, "#166534", 600);
  g.globalAlpha = 1;
  const tiles = [["Ventes du jour", "0 $"], ["Commandes", "0"], ["Tables", "12"], ["Stock", "OK"]];
  tiles.forEach(([l, v], i) => {
    const k = ease((t - 0.15 - i * 0.07) / 0.2);
    g.globalAlpha = k;
    const x = 16 + (i % 2) * 168, y = 212 + Math.floor(i / 2) * 96 + (1 - k) * 20;
    rr(g, x, y, 160, 84, 14, "#FFFFFF", LINE);
    text(g, l, x + 14, y + 30, 12, SLATE, 600);
    text(g, v, x + 14, y + 64, 24, NAVY, 800);
  });
  g.globalAlpha = ease((t - 0.5) / 0.2);
  rr(g, 16, 418, 328, 150, 14, "#FFFFFF", LINE);
  text(g, "Ventes de la semaine", 32, 446, 13, NAVY, 700);
  [0.3, 0.5, 0.42, 0.7, 0.55, 0.85, 0.65].forEach((h, i) => {
    const bh = 90 * h * ease((t - 0.55 - i * 0.03) / 0.2);
    rr(g, 36 + i * 42, 552 - bh, 26, bh, 6, i === 5 ? GOLD : BLUE);
  });
  g.globalAlpha = 1;
  if (t > 0.7) {
    g.globalAlpha = ease((t - 0.7) / 0.1);
    rr(g, 16, 588, 328, 52, 26, NAVY);
    text(g, "📲 Invitez votre équipe", 180, 620, 14, "#FFFFFF", 700, "center");
    g.globalAlpha = 1;
  }
}

/**
 * Dessine l'écran à l'instant `time` (secondes depuis le début de la démonstration).
 * Le canvas doit faire SCREEN_W × SCREEN_H multiplié par `scale`.
 */
export function drawScreen(g: Ctx, time: number, scale: number, trial: string) {
  const total = STEP_SECONDS * DEMO_STEPS.length;
  const tt = ((time % total) + total) % total;
  const step = Math.floor(tt / STEP_SECONDS);
  const t = (tt - step * STEP_SECONDS) / STEP_SECONDS;
  const caret = Math.floor(time * 2.5) % 2 === 0;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.clearRect(0, 0, SCREEN_W, SCREEN_H);
  rr(g, 0, 0, SCREEN_W, SCREEN_H, 34, "#FFFFFF");
  g.save();
  g.beginPath(); g.roundRect(0, 0, SCREEN_W, SCREEN_H, 34); g.clip();
  statusBar(g);
  if (step === 0) home(g, t, trial);
  else if (step === 1) signup(g, t, caret);
  else if (step === 2) establishment(g, t, caret);
  else dashboard(g, t, trial);
  // Fondu entre les étapes
  const fade = Math.max(ease(1 - t / 0.06), ease((t - 0.94) / 0.06));
  if (fade > 0) { g.globalAlpha = fade; g.fillStyle = "#FFFFFF"; g.fillRect(0, 40, SCREEN_W, SCREEN_H); g.globalAlpha = 1; }
  // Barre d'accueil
  rr(g, 120, SCREEN_H - 18, 120, 5, 3, "#0F172A");
  g.restore();
  return { step, progress: tt / total };
}
