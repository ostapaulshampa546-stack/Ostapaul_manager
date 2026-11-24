"use client";
import { useEffect, useRef, useState } from "react";

type Focus = "restaurant" | "school" | "pme" | undefined;

const CARDS = [
  { key: "restaurant", label: "Restaurant", icon: "🍽️", color: "#E8833A" },
  { key: "school", label: "École", icon: "🎓", color: "#16A34A" },
  { key: "pme", label: "PME", icon: "💼", color: "#1E6BFF" },
] as const;

/** Connexion lente ou économie de données : on n'affiche pas la scène 3D. */
function lightMode() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(c?.saveData || (c?.effectiveType && /(^|-)2g$/.test(c.effectiveType)));
}

function cardTexture(THREE: typeof import("three"), label: string, icon: string, color: string) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 320;
  const g = c.getContext("2d")!;
  const r = 48;
  g.fillStyle = "#ffffff";
  g.beginPath(); g.roundRect(0, 0, 512, 320, r); g.fill();
  g.fillStyle = color; g.fillRect(0, 0, 512, 18);
  g.font = "120px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(icon, 256, 140);
  g.font = "bold 54px Inter, system-ui, sans-serif"; g.fillStyle = "#0B1F4B";
  g.fillText(label, 256, 260);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function Hero3D({ focus, className = "" }: { focus?: Focus; className?: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    if (lightMode()) { setFallback(true); return; }
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      if (disposed) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      } catch { setFallback(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      el.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.setAttribute("aria-hidden", "true");

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      camera.position.set(0, 0, 9);

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 6, 8); scene.add(key);
      const blue = new THREE.PointLight(0x3b82ff, 30, 30); blue.position.set(-5, -2, 4); scene.add(blue);
      const gold = new THREE.PointLight(0xe5bf4f, 25, 30); gold.position.set(5, 3, 3); scene.add(gold);

      // Anneau du logo : bleu électrique + arc doré
      const logo = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.32, 48, 160),
        new THREE.MeshStandardMaterial({ color: 0x1e6bff, metalness: 0.55, roughness: 0.25 }));
      const arc = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.345, 48, 80, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xf2c94c, metalness: 0.45, roughness: 0.25, emissive: 0x6b4e00, emissiveIntensity: 0.6 }));
      const capGeo = new THREE.SphereGeometry(0.345, 32, 16);
      const capMat = arc.material;
      const cap1 = new THREE.Mesh(capGeo, capMat); cap1.position.set(1.6, 0, 0);
      const cap2 = new THREE.Mesh(capGeo, capMat); cap2.position.set(0, 1.6, 0);
      logo.add(ring, arc, cap1, cap2);
      scene.add(logo);

      // Cartes des trois secteurs en orbite
      const cards: { mesh: import("three").Mesh; angle: number; speed: number; radius: number; y: number }[] = [];
      const shape = new THREE.Shape();
      const w = 1.6, h = 1.0, r = 0.16;
      shape.moveTo(-w / 2 + r, -h / 2);
      shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      shape.lineTo(-w / 2 + r, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      const cardGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 });
      cardGeo.center();
      // UV du recto adaptés à la texture
      const uv = cardGeo.attributes.uv as import("three").BufferAttribute;
      const pos = cardGeo.attributes.position as import("three").BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);

      CARDS.forEach((c, i) => {
        const front = new THREE.MeshStandardMaterial({ map: cardTexture(THREE, c.label, c.icon, c.color), roughness: 0.5, metalness: 0.05 });
        const side = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.4, metalness: 0.2 });
        const mesh = new THREE.Mesh(cardGeo, [front, side]);
        const scale = focus ? (focus === c.key ? 1.1 : 0.75) : 0.9;
        mesh.scale.setScalar(scale);
        scene.add(mesh);
        cards.push({ mesh, angle: (i / CARDS.length) * Math.PI * 2, speed: 0.25, radius: 2.75, y: [1.0, -0.15, -1.2][i] });
      });

      // Particules
      const N = 380;
      const pts = new Float32Array(N * 3);
      const cols = new Float32Array(N * 3);
      const cBlue = new THREE.Color(0x3b82ff), cGold = new THREE.Color(0xe5bf4f), cWhite = new THREE.Color(0xffffff);
      for (let i = 0; i < N; i++) {
        const rr = 4 + Math.random() * 6, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        pts.set([rr * Math.sin(ph) * Math.cos(th), rr * Math.sin(ph) * Math.sin(th) * 0.6, rr * Math.cos(ph) - 3], i * 3);
        const col = Math.random() < 0.15 ? cGold : Math.random() < 0.5 ? cBlue : cWhite;
        cols.set([col.r, col.g, col.b], i * 3);
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
      pGeo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
      const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
      scene.add(particles);

      // Interaction : la scène suit la souris / le doigt
      const target = { x: 0, y: 0 };
      const onMove = (e: PointerEvent) => {
        const b = el.getBoundingClientRect();
        target.x = ((e.clientX - b.left) / b.width - 0.5) * 2;
        target.y = ((e.clientY - b.top) / b.height - 0.5) * 2;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const resize = () => {
        const { clientWidth: cw, clientHeight: ch } = el;
        if (!cw || !ch) return;
        renderer.setSize(cw, ch, false);
        camera.aspect = cw / ch;
        camera.position.z = cw / ch < 1 ? 13 : cw < 700 ? 11 : 10;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize); ro.observe(el); resize();

      let visible = true;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.01 });
      io.observe(el);

      const clock = new THREE.Clock();
      let raf = 0;
      const frame = () => {
        raf = requestAnimationFrame(frame);
        if (!visible || document.hidden) { clock.getDelta(); return; }
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        logo.rotation.y += dt * 0.35;
        logo.rotation.x = Math.sin(t * 0.5) * 0.18 + target.y * 0.25;
        logo.position.y = Math.sin(t * 0.8) * 0.08;
        for (const c of cards) {
          c.angle += dt * c.speed;
          c.mesh.position.set(Math.cos(c.angle) * c.radius, c.y + Math.sin(t + c.angle) * 0.12, Math.sin(c.angle) * c.radius * 0.9);
          c.mesh.lookAt(camera.position.x, c.mesh.position.y, camera.position.z); // le recto reste face à la caméra
        }
        particles.rotation.y += dt * 0.02;
        camera.position.x += (target.x * 0.9 - camera.position.x) * 0.04;
        camera.position.y += (-target.y * 0.6 - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      };
      if (reduced) {
        // Mouvement réduit demandé par l'utilisateur : une image fixe
        for (const c of cards) { c.mesh.position.set(Math.cos(c.angle) * c.radius, c.y, Math.sin(c.angle) * c.radius * 0.55); c.mesh.lookAt(camera.position); }
        renderer.render(scene, camera);
      } else frame();

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onMove);
        ro.disconnect(); io.disconnect();
        scene.traverse((o) => {
          const m = o as import("three").Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          mats.forEach((mat) => { (mat as import("three").MeshStandardMaterial).map?.dispose(); mat.dispose(); });
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => { disposed = true; cleanup(); };
  }, [focus]);

  return (
    <div ref={mount} className={`relative ${className}`} role="img" aria-label="Illustration 3D : l'anneau OSTAPAUL entouré des secteurs Restaurant, École et PME">
      {fallback && (
        <svg viewBox="0 0 512 512" className="absolute inset-0 m-auto h-3/4 w-3/4 drop-shadow-2xl" aria-hidden>
          <circle cx="256" cy="256" r="150" fill="none" stroke="#1E6BFF" strokeWidth="44" />
          <path d="M256 106a150 150 0 0 1 150 150" fill="none" stroke="#D4A72C" strokeWidth="44" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
