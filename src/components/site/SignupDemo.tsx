"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_STEPS, SCREEN_H, SCREEN_W, STEP_SECONDS, drawScreen } from "./signup-screens";

const TOTAL = STEP_SECONDS * DEMO_STEPS.length;
const TEX_SCALE = 1.5;

/** Connexion lente ou économie de données : version légère sans 3D. */
function lightMode() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(c?.saveData || (c?.effectiveType && /(^|-)2g$/.test(c.effectiveType)));
}

function youtubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/);
  return m?.[1] ?? null;
}

/** Vidéo fournie par le propriétaire : YouTube (chargée seulement au clic, pour économiser les données) ou MP4. */
function OwnerVideo({ url }: { url: string }) {
  const [play, setPlay] = useState(false);
  const id = youtubeId(url);
  if (!id) {
    return <video src={url} controls preload="metadata" playsInline className="aspect-video w-full rounded-2xl bg-black shadow-xl" />;
  }
  return play ? (
    <iframe className="aspect-video w-full rounded-2xl shadow-xl" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
      title="Comment s'inscrire à OSTAPAUL MANAGER" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
  ) : (
    <button type="button" onClick={() => setPlay(true)} className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-navy-950 shadow-xl" aria-label="Lire la vidéo : comment s'inscrire">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" loading="lazy" />
      <span className="absolute inset-0 m-auto flex h-20 w-20 items-center justify-center rounded-full bg-gold-500 text-3xl text-navy-950 shadow-2xl transition group-hover:scale-110">▶</span>
    </button>
  );
}

/** Démonstration animée en 3D : un téléphone qui montre l'inscription, étape par étape. */
function Demo3D({ trial }: { trial: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  const playingRef = useRef(true);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const flat = useRef<HTMLCanvasElement>(null);

  const goTo = useCallback((i: number) => { timeRef.current = i * STEP_SECONDS + 0.01; setStep(i); }, []);
  const toggle = useCallback(() => { playingRef.current = !playingRef.current; setPlaying(playingRef.current); }, []);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { playingRef.current = false; setPlaying(false); }
    let disposed = false;
    let cleanup = () => {};
    let lastStep = -1;

    const screen = document.createElement("canvas");
    screen.width = SCREEN_W * TEX_SCALE; screen.height = SCREEN_H * TEX_SCALE;
    const sg = screen.getContext("2d")!;

    const tick = (dt: number) => {
      if (playingRef.current) timeRef.current = (timeRef.current + dt) % TOTAL;
      const r = drawScreen(sg, timeRef.current, TEX_SCALE, trial);
      if (r.step !== lastStep) { lastStep = r.step; setStep(r.step); }
      if (bar.current) bar.current.style.width = `${(r.progress * 100).toFixed(2)}%`;
    };

    const visibleRef = { v: true };
    const io = new IntersectionObserver(([e]) => { visibleRef.v = e.isIntersecting; }, { threshold: 0.01 });
    io.observe(el);

    const start2d = () => {
      setMode("2d");
      let raf = 0, last = performance.now();
      const loop = (now: number) => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min((now - last) / 1000, 0.05); last = now;
        if (!visibleRef.v || document.hidden) return;
        tick(dt);
        const c = flat.current;
        if (c) { const g = c.getContext("2d")!; g.clearRect(0, 0, c.width, c.height); g.drawImage(screen, 0, 0, c.width, c.height); }
      };
      raf = requestAnimationFrame(loop);
      cleanup = () => cancelAnimationFrame(raf);
    };

    if (lightMode()) { start2d(); return () => { disposed = true; cleanup(); io.disconnect(); }; }

    (async () => {
      const THREE = await import("three");
      if (disposed) return;
      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch { start2d(); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      el.appendChild(renderer.domElement);
      Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block" });
      renderer.domElement.setAttribute("aria-hidden", "true");

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 0, 15);
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 1.8); key.position.set(5, 6, 9); scene.add(key);
      const blue = new THREE.PointLight(0x3b82ff, 40, 30); blue.position.set(-6, -3, 5); scene.add(blue);
      const gold = new THREE.PointLight(0xe5bf4f, 30, 30); gold.position.set(6, 4, 4); scene.add(gold);

      // Téléphone : coque arrondie + écran animé
      const rounded = (w: number, h: number, r: number) => {
        const s = new THREE.Shape();
        s.moveTo(-w / 2 + r, -h / 2);
        s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
        s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
        s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
        s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
        return s;
      };
      const phone = new THREE.Group();
      const bodyGeo = new THREE.ExtrudeGeometry(rounded(3.75, 7.5, 0.6), { depth: 0.32, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 4, curveSegments: 16 });
      bodyGeo.center();
      const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x0b1f4b, metalness: 0.7, roughness: 0.28 }));
      phone.add(body);
      const sw = 3.45, sh = 6.9;
      const screenGeo = new THREE.ShapeGeometry(rounded(sw, sh, 0.42), 16);
      const uv = screenGeo.attributes.uv as import("three").BufferAttribute;
      const pos = screenGeo.attributes.position as import("three").BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + sw / 2) / sw, (pos.getY(i) + sh / 2) / sh);
      const tex = new THREE.CanvasTexture(screen);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const screenMesh = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      screenMesh.position.z = 0.23;
      phone.add(screenMesh);
      // Liseré doré autour de l'écran
      const rim = new THREE.Mesh(new THREE.ShapeGeometry(rounded(sw + 0.08, sh + 0.08, 0.46), 16),
        new THREE.MeshStandardMaterial({ color: 0xe5bf4f, metalness: 0.8, roughness: 0.3 }));
      rim.position.z = 0.225;
      phone.add(rim);
      scene.add(phone);

      // Anneaux et particules en arrière-plan
      const ring = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.05, 16, 160), new THREE.MeshBasicMaterial({ color: 0x163a86, depthTest: false }));
      ring.rotation.x = Math.PI / 2.4; ring.renderOrder = -2; scene.add(ring);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(6.1, 0.035, 16, 160), new THREE.MeshBasicMaterial({ color: 0x5a5440, depthTest: false }));
      ring2.rotation.x = Math.PI / 2.1; ring2.rotation.y = 0.3; ring2.renderOrder = -2; scene.add(ring2);
      const N = 220, pts = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) pts.set([(Math.random() - 0.5) * 22, (Math.random() - 0.5) * 14, -4 - Math.random() * 6], i * 3);
      const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0x9cc0ff, size: 0.05, transparent: true, opacity: 0.8, depthWrite: false }));
      scene.add(particles);

      const target = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        const b = el.getBoundingClientRect();
        target.x = ((e.clientX - b.left) / b.width - 0.5) * 2;
        target.y = ((e.clientY - b.top) / b.height - 0.5) * 2;
      };
      el.addEventListener("pointermove", onMove, { passive: true });
      el.addEventListener("pointerleave", () => { target.x = 0; target.y = 0; });

      const resize = () => {
        const { clientWidth: cw, clientHeight: ch } = el;
        if (!cw || !ch) return;
        renderer.setSize(cw, ch, false);
        camera.aspect = cw / ch;
        camera.position.z = cw / ch < 0.8 ? 17.5 : 15;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize); ro.observe(el); resize();

      const clock = new THREE.Clock();
      let raf = 0;
      const frame = () => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(clock.getDelta(), 0.05);
        if (!visibleRef.v || document.hidden) return;
        const t = clock.elapsedTime;
        tick(dt);
        tex.needsUpdate = true;
        const motion = playingRef.current ? 1 : 0.25;
        phone.rotation.y += ((Math.sin(t * 0.45) * 0.38 * motion + target.x * 0.35) - phone.rotation.y) * 0.06;
        phone.rotation.x += ((Math.sin(t * 0.3) * 0.07 * motion - target.y * 0.2) - phone.rotation.x) * 0.06;
        phone.position.y = Math.sin(t * 0.9) * 0.12 * motion;
        ring.rotation.z += dt * 0.15; ring2.rotation.z -= dt * 0.1;
        particles.rotation.y += dt * 0.01;
        renderer.render(scene, camera);
      };
      frame();

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        el.removeEventListener("pointermove", onMove);
        scene.traverse((o) => {
          const m = o as import("three").Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          mats.forEach((mat) => mat.dispose());
        });
        tex.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => { disposed = true; cleanup(); io.disconnect(); };
  }, [trial]);

  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 shadow-2xl">
      <div className="grid items-center gap-2 md:grid-cols-[1.1fr_1fr]">
        <div ref={mount} className="relative h-[440px] sm:h-[520px]" role="img"
          aria-label="Démonstration animée : un téléphone montre les quatre étapes de l'inscription">
          {mode === "2d" && (
            <div className="absolute inset-0 m-auto h-[400px] w-[212px] rounded-[2.2rem] border-[6px] border-navy-700 bg-white shadow-2xl ring-2 ring-gold-500/60 sm:h-[480px] sm:w-[250px]">
              <canvas ref={flat} width={SCREEN_W} height={SCREEN_H} className="h-full w-full rounded-[1.8rem]" />
            </div>
          )}
        </div>
        <div className="px-5 pb-6 text-white md:py-8 md:pr-8">
          <ol className="space-y-2">
            {DEMO_STEPS.map((s, i) => (
              <li key={s.title}>
                <button type="button" onClick={() => goTo(i)}
                  className={`w-full rounded-xl p-3 text-left transition ${i === step ? "bg-white/10 ring-1 ring-gold-400/70" : "opacity-60 hover:opacity-100"}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === step ? "bg-gold-500 text-navy-950" : "bg-white/15"}`}>{i + 1}</span>
                    <span className="font-bold">{s.title}</span>
                  </div>
                  {i === step && <p className="mt-1.5 pl-11 text-sm text-white/80" aria-live="polite">{i === 3 && trial ? `${s.text.replace("pendant l'essai gratuit", `pendant les ${trial} d'essai gratuit`)}` : s.text}</p>}
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={toggle} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-lg hover:bg-white/25"
              aria-label={playing ? "Mettre en pause" : "Lire"}>{playing ? "❚❚" : "▶"}</button>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"><div ref={bar} className="h-full bg-gold-500" style={{ width: "0%" }} /></div>
            <span className="text-xs text-white/60">20 s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SignupDemo({ trial, videoUrl }: { trial: string; videoUrl?: string | null }) {
  return videoUrl ? <OwnerVideo url={videoUrl} /> : <Demo3D trial={trial} />;
}
