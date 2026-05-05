"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { ChatState } from "@/components/chat-panel";
import type { Mesh } from "three";

type Props = {
  state: ChatState;
  activeCitations?: number;
};

const VISUAL_BY_STATE: Record<
  ChatState,
  { spin: number; pulse: number; color: string; jitter: number }
> = {
  idle: { spin: 0.2, pulse: 0.02, color: "#00bcd4", jitter: 0 },
  thinking: { spin: 0.8, pulse: 0.06, color: "#4fc3f7", jitter: 0.01 },
  streaming: { spin: 0.5, pulse: 0.04, color: "#81c784", jitter: 0 },
  error: { spin: 0.3, pulse: 0.03, color: "#ef5350", jitter: 0.02 },
};

function SceneContent({ state, activeCitations = 0 }: Props) {
  const meshRef = useRef<Mesh>(null!);
  const target = VISUAL_BY_STATE[state];
  const current = useRef({ spin: 0.2, pulse: 0.02, jitter: 0 });

  useFrame((_, delta) => {
    const m = meshRef.current;
    if (!m) return;

    current.current.spin += (target.spin - current.current.spin) * delta * 3;
    current.current.pulse += (target.pulse - current.current.pulse) * delta * 3;
    current.current.jitter +=
      (target.jitter - current.current.jitter) * delta * 3;

    const t = performance.now() / 1000;
    m.rotation.y += current.current.spin * delta;
    m.scale.setScalar(
      1 + Math.sin(t * 4 + activeCitations * 0.15) * current.current.pulse,
    );

    const j = current.current.jitter;
    m.position.x = Math.sin(t * 10) * j;
    m.position.y = Math.cos(t * 12) * j;
  });

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[4, 4, 4]} intensity={1.5} color={target.color} />
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color="#111827"
          emissive={target.color}
          emissiveIntensity={1.2}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>
    </>
  );
}

export function Rag3DScene({ state, activeCitations = 0 }: Props) {
  return (
    <div className="h-72 w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-black via-slate-900 to-black">
      <Canvas camera={{ position: [0, 0, 4], fov: 50 }}>
        <SceneContent state={state} activeCitations={activeCitations} />
      </Canvas>
    </div>
  );
}
