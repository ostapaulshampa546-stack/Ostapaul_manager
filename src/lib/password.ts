/**
 * Politique de mots de passe OSTAPAUL MANAGER.
 * - 8 caractères minimum, 72 maximum (limite de bcrypt, utilisé par Supabase Auth pour le hachage) ;
 * - tous les caractères sont autorisés, y compris les espaces et caractères spéciaux (phrases de passe) ;
 * - moins de 12 caractères : au moins 3 types parmi minuscules, majuscules, chiffres, spéciaux/espaces ;
 *   12 caractères ou plus : au moins 2 types (ex. « ma maison est belle ») ;
 * - refus des mots de passe courants, des suites (123456, azerty…), des répétitions
 *   et de ceux qui contiennent le nom ou l'e-mail de l'utilisateur.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const COMMON = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "0123456789", "987654321", "111111", "000000", "00000000",
  "11111111", "121212", "123123", "123321", "654321", "666666", "696969", "112233", "159753", "147258369",
  "password", "password1", "password123", "passw0rd", "motdepasse", "motdepasse1", "mot2passe", "azerty", "azertyuiop",
  "azerty123", "qwerty", "qwertyuiop", "qwerty123", "abc123", "abcdef", "abcd1234", "iloveyou", "jetaime", "jetaime1",
  "admin", "admin123", "administrateur", "welcome", "bienvenue", "letmein", "monkey", "dragon", "football", "soleil",
  "loulou", "doudou", "chouchou", "princesse", "nicolas", "marseille", "sunshine", "master", "superman", "batman",
  "kinshasa", "kinshasa1", "congo", "congo123", "rdcongo", "lubumbashi", "goma", "matadi", "kisangani", "mbujimayi",
  "jesus", "jesus123", "jesuschrist", "dieu", "dieuestbon", "amen", "emmanuel", "christ", "gloire", "alleluia",
  "ostapaul", "ostapaul123", "manager", "manager123", "school", "ecole", "restaurant", "entreprise", "pme",
  "changeme", "secret", "test", "test123", "user", "utilisateur", "default", "login", "access", "pass", "pass1234",
]);

const SEQUENCES = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "azertyuiop", "qsdfghjklm", "wxcvbn", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "");
}

function isSequence(p: string) {
  if (p.length < 4) return false;
  for (const seq of SEQUENCES) {
    const rev = [...seq].reverse().join("");
    if (seq.includes(p) || rev.includes(p)) return true;
  }
  return false;
}

export type PasswordCheck = { ok: boolean; errors: string[] };

export function checkPassword(password: string, context: { email?: string; name?: string } = {}): PasswordCheck {
  const errors: string[] = [];
  const bytes = new TextEncoder().encode(password).length;
  if ([...password].length < PASSWORD_MIN) errors.push(`Au moins ${PASSWORD_MIN} caractères.`);
  if (bytes > PASSWORD_MAX) errors.push(`${PASSWORD_MAX} caractères maximum.`);
  if (/^\s|\s$/.test(password)) errors.push("Pas d'espace au début ni à la fin.");

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const len = [...password].length;
  if (len < 12 && classes < 3) errors.push("Moins de 12 caractères : mélangez au moins 3 types (minuscules, majuscules, chiffres, caractères spéciaux ou espaces).");
  if (len >= 12 && classes < 2) errors.push("Mélangez au moins 2 types de caractères (lettres et chiffres, espaces ou caractères spéciaux).");

  const n = normalize(password);
  const stripped = n.replace(/[0-9!@#$%^&*._\-+=?]+$/, ""); // « password2024! » -> « password »
  if (COMMON.has(n) || COMMON.has(stripped)) errors.push("Ce mot de passe est trop courant et facile à deviner.");
  if (/^(.)\1+$/.test(n) || /^(.{1,3})\1{2,}$/.test(n)) errors.push("Évitez les répétitions (aaaaaa, abcabc…).");
  if (isSequence(n) || isSequence(stripped)) errors.push("Évitez les suites de caractères (123456, abcdef, azerty…).");

  const local = context.email?.split("@")[0];
  const parts = [local, ...(context.name ?? "").split(/\s+/)].filter((x): x is string => Boolean(x) && x!.length >= 4).map(normalize);
  if (parts.some((p) => n.includes(p))) errors.push("Le mot de passe ne doit pas contenir votre nom ou votre e-mail.");

  return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
}

export const PASSWORD_HINT = "8 caractères minimum. Espaces et caractères spéciaux autorisés. Évitez les mots de passe courants (123456, azerty…). Conseil : une phrase de 12 caractères ou plus.";
