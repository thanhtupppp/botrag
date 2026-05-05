"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { ChatState } from "@/components/chat-panel";
import type { Mesh } from "three";

type Props = {
  state: ChatState;
};

function SceneContent({ state }: Props) {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const speed =
      state === "idle"
        ? 0.15
        : state === "thinking"
          ? 0.6
          : state === "streaming"
            ? 0.35
            : 0;

    meshRef.current.rotation.y += speed * delta;
    meshRef.current.rotation.x += speed * delta * 0.35;
  });

  const color = useMemo(() => {
    if (state === "error") return "#ef4444";
    if (state === "streaming") return "#22c55e";
    if (state === "thinking") return "#a855f7";
    return "#60a5fa";
  }, [state]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 5]} intensity={1.3} color={color} />
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.1, 1]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.35} />
      </mesh>
    </>
  );
}

export function Rag3DScene({ state }: Props) {
  return (
    <div className="h-72 w-full overflow-hidden rounded-3xl border border-white/10 bg-black/60">
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }}>
        <SceneContent state={state} />
      </Canvas>
    </div>
  );
}
