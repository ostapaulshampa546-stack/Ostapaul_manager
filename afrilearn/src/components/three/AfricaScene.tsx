"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { africaDots, CITIES, LINKS, project } from "@/lib/africa";

const ROYAL = new THREE.Color("#2f66ff");
const NIGHT = new THREE.Color("#1a2f7a");
const GOLD = new THREE.Color("#f5b82e");
const WHITE = new THREE.Color("#dfe8ff");

/** Pseudo-random but deterministic (same render on every load). */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function DotMap({ step }: { step: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dots = useMemo(() => africaDots(step), [step]);
  const cityPts = useMemo(() => CITIES.map((c) => project(c.lon, c.lat)), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    dots.forEach(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      const near = Math.min(...cityPts.map(([cx, cy]) => Math.hypot(cx - x, cy - y)));
      const h = 0.04 + hash(lon, lat) * 0.12 + Math.max(0, 0.5 - near) * 0.9;
      m.makeScale(1, 1, h / 0.1);
      m.setPosition(x, y, h / 2);
      mesh.setMatrixAt(i, m);
      color.copy(NIGHT).lerp(ROYAL, Math.min(1, (y + 3.5) / 7 + hash(lat, lon) * 0.25));
      if (near < 0.35) color.lerp(GOLD, 1 - near / 0.35);
      else if (hash(lon * 2, lat) > 0.97) color.copy(WHITE);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [dots, cityPts]);

  const size = step * 0.06;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, dots.length]}>
      <boxGeometry args={[size, size, 0.1]} />
      <meshStandardMaterial metalness={0.35} roughness={0.35} emissive="#0b1a45" emissiveIntensity={0.6} />
    </instancedMesh>
  );
}

function Arc({ from, to, speed, offset }: { from: [number, number]; to: [number, number]; speed: number; offset: number }) {
  const pulse = useRef<THREE.Mesh>(null);
  const { curve, line } = useMemo(() => {
    const a = new THREE.Vector3(from[0], from[1], 0.35);
    const b = new THREE.Vector3(to[0], to[1], 0.35);
    const mid = a.clone().lerp(b, 0.5);
    mid.z += 0.6 + a.distanceTo(b) * 0.35;
    const c = new THREE.QuadraticBezierCurve3(a, mid, b);
    const geo = new THREE.BufferGeometry().setFromPoints(c.getPoints(48));
    const mat = new THREE.LineBasicMaterial({ color: "#ffcc55", transparent: true, opacity: 0.45 });
    return { curve: c, line: new THREE.Line(geo, mat) };
  }, [from, to]);

  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * speed + offset) % 1;
    if (pulse.current) {
      pulse.current.position.copy(curve.getPoint(t));
      const s = 0.6 + Math.sin(t * Math.PI) * 0.8;
      pulse.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      <primitive object={line} />
      <mesh ref={pulse}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshBasicMaterial color="#fff3d1" />
      </mesh>
    </group>
  );
}

function CityMarker({ x, y, delay }: { x: number; y: number; delay: number }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = ((clock.elapsedTime + delay) % 2.4) / 2.4;
    if (ring.current) {
      ring.current.scale.setScalar(0.6 + t * 2.2);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
    }
  });
  return (
    <group position={[x, y, 0.36]}>
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#f5b82e" emissive="#f5b82e" emissiveIntensity={1.2} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.08, 0.1, 32]} />
        <meshBasicMaterial color="#ffcc55" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Floating({ children, position, speed = 1, phase = 0, rotate = 0.3 }:
  { children: React.ReactNode; position: [number, number, number]; speed?: number; phase?: number; rotate?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + phase;
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(t) * 0.18;
      ref.current.rotation.y = Math.sin(t * 0.6) * rotate;
      ref.current.rotation.x = Math.cos(t * 0.5) * rotate * 0.4;
    }
  });
  return <group ref={ref} position={position}>{children}</group>;
}

function Books() {
  const colors = ["#2350e0", "#f5b82e", "#ffffff"];
  return (
    <group rotation={[0.3, 0.6, 0]}>
      {colors.map((c, i) => (
        <group key={c} position={[i * 0.04, i * 0.17, 0]} rotation={[0, i * 0.25, 0]}>
          <mesh>
            <boxGeometry args={[0.95, 0.15, 0.7]} />
            <meshStandardMaterial color={c} roughness={0.5} />
          </mesh>
          <mesh position={[0.03, 0, 0]}>
            <boxGeometry args={[0.92, 0.11, 0.72]} />
            <meshStandardMaterial color="#f7f3e8" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Headphones() {
  return (
    <group rotation={[0.2, -0.5, 0.1]} scale={0.85}>
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[0.5, 0.06, 12, 40, Math.PI]} />
        <meshStandardMaterial color="#e3ebff" metalness={0.6} roughness={0.25} />
      </mesh>
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.16, 24]} />
          <meshStandardMaterial color="#2350e0" metalness={0.3} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function Laptop() {
  return (
    <group rotation={[0.35, 0.5, 0]} scale={0.9}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.3, 0.05, 0.85]} />
        <meshStandardMaterial color="#c9d3ea" metalness={0.7} roughness={0.25} />
      </mesh>
      <group position={[0, 0.4, -0.42]} rotation={[-0.25, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.3, 0.82, 0.04]} />
          <meshStandardMaterial color="#0b1a45" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.025]}>
          <planeGeometry args={[1.18, 0.7]} />
          <meshStandardMaterial color="#2f66ff" emissive="#2f66ff" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[-0.3, 0.12, 0.03]}>
          <planeGeometry args={[0.4, 0.06]} />
          <meshBasicMaterial color="#ffcc55" />
        </mesh>
        <mesh position={[-0.15, -0.02, 0.03]}>
          <planeGeometry args={[0.7, 0.04]} />
          <meshBasicMaterial color="#e3ebff" />
        </mesh>
      </group>
    </group>
  );
}

function GradCap() {
  return (
    <group rotation={[0.4, 0.3, -0.1]} scale={0.8}>
      <mesh position={[0, 0.12, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.95, 0.05, 0.95]} />
        <meshStandardMaterial color="#071233" roughness={0.6} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.3, 0.34, 0.22, 24]} />
        <meshStandardMaterial color="#071233" roughness={0.6} />
      </mesh>
      <mesh position={[0.35, -0.05, 0.1]}>
        <cylinderGeometry args={[0.02, 0.02, 0.35, 8]} />
        <meshStandardMaterial color="#f5b82e" />
      </mesh>
      <mesh position={[0.35, -0.24, 0.1]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#f5b82e" emissive="#f5b82e" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

function Scene({ compact }: { compact: boolean }) {
  const root = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const cityPts = useMemo(() => CITIES.map((c) => project(c.lon, c.lat)), []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const scroll = Math.min(1, window.scrollY / window.innerHeight);
    const targetX = -0.62 + pointer.current.y * 0.08 - scroll * 0.35;
    const targetZ = Math.sin(clock.elapsedTime * 0.15) * 0.06 + pointer.current.x * 0.12;
    g.rotation.x += (targetX - g.rotation.x) * 0.05;
    g.rotation.z += (targetZ - g.rotation.z) * 0.05;
    g.position.y += (-0.2 + scroll * 1.2 - g.position.y) * 0.08;
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 8]} intensity={1.6} />
      <pointLight position={[-4, -2, 3]} intensity={18} color="#2f66ff" />
      <pointLight position={[3, 3, 3]} intensity={10} color="#f5b82e" />
      <group ref={root} rotation={[-0.62, 0, 0]} position={[compact ? 0 : 2.3, -0.2, 0]}>
        <DotMap step={compact ? 1.5 : 1.0} />
        {cityPts.map(([x, y], i) => <CityMarker key={i} x={x} y={y} delay={i * 0.37} />)}
        {LINKS.slice(0, compact ? 6 : LINKS.length).map(([a, b], i) => (
          <Arc key={i} from={cityPts[a]} to={cityPts[b]} speed={0.12 + (i % 4) * 0.03} offset={i * 0.21} />
        ))}
      </group>
      {!compact && (
        <>
          <Floating position={[0.9, -3.0, 0.4]} speed={0.9}><Books /></Floating>
          <Floating position={[5.0, 2.5, -0.4]} speed={1.1} phase={1.3}><Headphones /></Floating>
          <Floating position={[4.9, -2.3, 0.2]} speed={0.8} phase={2.1}><Laptop /></Floating>
          <Floating position={[-4.6, -3.3, -0.4]} speed={1.0} phase={0.7}><GradCap /></Floating>
        </>
      )}
    </>
  );
}

/** Full 3D hero. Pauses when off-screen; lighter on phones; static when the user prefers reduced motion. */
export default function AfricaScene() {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [compact, setCompact] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setCompact(window.innerWidth < 768);
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    if (wrap.current) io.observe(wrap.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrap} className="absolute inset-0" aria-hidden="true">
      <Canvas
        frameloop={reduced ? "demand" : visible ? "always" : "never"}
        dpr={[1, compact ? 1.5 : 1.75]}
        camera={{ position: [0, -0.6, compact ? 11 : 9.2], fov: 42 }}
        gl={{ antialias: !compact, powerPreference: "high-performance", alpha: true }}
      >
        <Scene compact={compact} />
      </Canvas>
    </div>
  );
}
