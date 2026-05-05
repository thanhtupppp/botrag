"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import { useRef } from "react";
import { Color, MeshStandardMaterial } from "three";
import type { Mesh, PointLight } from "three";
import type { ChatState } from "@/components/chat-panel";

type Props = {
  state: ChatState;
  activeCitations?: number;
};

type GoalParams = {
  spin: number;
  pulseAmp: number;
  pulseFreq: number;
  jitter: number;
  jitterFreq: number;
  emissiveR: number;
  emissiveG: number;
  emissiveB: number;
  emissiveIntensity: number;
  lightIntensity: number;
  lerpSpeed: number;
};

const GOAL: Record<ChatState, GoalParams> = {
  idle: {
    spin: 0.18,
    pulseAmp: 0.018,
    pulseFreq: 1.6,
    jitter: 0,
    jitterFreq: 0,
    emissiveR: 0,
    emissiveG: 0.74,
    emissiveB: 0.83,
    emissiveIntensity: 0.9,
    lightIntensity: 1.2,
    lerpSpeed: 2.5,
  },
  thinking: {
    spin: 1.18,
    pulseAmp: 0.075,
    pulseFreq: 5.4,
    jitter: 0.01,
    jitterFreq: 15,
    emissiveR: 0.31,
    emissiveG: 0.76,
    emissiveB: 0.97,
    emissiveIntensity: 1.75,
    lightIntensity: 2.4,
    lerpSpeed: 6,
  },
  streaming: {
    spin: 0.52,
    pulseAmp: 0.042,
    pulseFreq: 3.05,
    jitter: 0.002,
    jitterFreq: 9,
    emissiveR: 0.51,
    emissiveG: 0.78,
    emissiveB: 0.52,
    emissiveIntensity: 1.15,
    lightIntensity: 1.75,
    lerpSpeed: 3.8,
  },
  error: {
    spin: 0.2,
    pulseAmp: 0.015,
    pulseFreq: 2.8,
    jitter: 0.018,
    jitterFreq: 21,
    emissiveR: 0.94,
    emissiveG: 0.33,
    emissiveB: 0.31,
    emissiveIntensity: 1.45,
    lightIntensity: 2,
    lerpSpeed: 4.5,
  },
};

function SceneContent({ state, activeCitations = 0 }: Props) {
  const meshRef = useRef<Mesh>(null!);
  const lightRef = useRef<PointLight>(null!);
  const current = useRef({
    spin: 0.18,
    pulseAmp: 0.018,
    pulseFreq: 1.6,
    jitter: 0,
    jitterFreq: 0,
    emissiveR: 0,
    emissiveG: 0.74,
    emissiveB: 0.83,
    emissiveIntensity: 0.9,
    lightIntensity: 1.2,
  });
  const emissiveColor = useRef(new Color(0, 0.74, 0.83));
  const lightColor = useRef(new Color(0, 0.74, 0.83));

  useFrame((_: RootState, delta: number) => {
    const m = meshRef.current;
    const l = lightRef.current;
    if (!m || !l) return;

    const goal = GOAL[state];
    const k = Math.min(delta * goal.lerpSpeed, 1);
    const material = m.material as MeshStandardMaterial;

    current.current.spin += (goal.spin - current.current.spin) * k;
    current.current.pulseAmp += (goal.pulseAmp - current.current.pulseAmp) * k;
    current.current.pulseFreq +=
      (goal.pulseFreq - current.current.pulseFreq) * k;
    current.current.jitter += (goal.jitter - current.current.jitter) * k;
    current.current.jitterFreq +=
      (goal.jitterFreq - current.current.jitterFreq) * k;
    current.current.emissiveR +=
      (goal.emissiveR - current.current.emissiveR) * k;
    current.current.emissiveG +=
      (goal.emissiveG - current.current.emissiveG) * k;
    current.current.emissiveB +=
      (goal.emissiveB - current.current.emissiveB) * k;
    current.current.emissiveIntensity +=
      (goal.emissiveIntensity - current.current.emissiveIntensity) * k;
    current.current.lightIntensity +=
      (goal.lightIntensity - current.current.lightIntensity) * k;

    const t = performance.now() / 1000;

    m.rotation.y += current.current.spin * delta;
    m.rotation.x = Math.sin(t * 0.28) * 0.075;
    m.rotation.z = Math.sin(t * 0.18) * 0.03;

    const citationBump = activeCitations * 0.01;
    const pulse =
      Math.sin(t * current.current.pulseFreq) *
      (current.current.pulseAmp + citationBump);
    m.scale.setScalar(1 + pulse);

    if (current.current.jitter > 0.0005) {
      const jitterWave = Math.sin(t * current.current.jitterFreq);
      const jitterWave2 = Math.cos(t * current.current.jitterFreq * 1.13);
      m.position.x = jitterWave * current.current.jitter;
      m.position.y = jitterWave2 * current.current.jitter * 0.85;
    } else {
      m.position.x += (0 - m.position.x) * 0.15;
      m.position.y += (0 - m.position.y) * 0.15;
    }

    emissiveColor.current.setRGB(
      current.current.emissiveR,
      current.current.emissiveG,
      current.current.emissiveB,
    );
    material.emissive.copy(emissiveColor.current);
    material.emissiveIntensity = current.current.emissiveIntensity;

    lightColor.current.setRGB(
      current.current.emissiveR,
      current.current.emissiveG,
      current.current.emissiveB,
    );
    l.color.copy(lightColor.current);
    l.intensity = current.current.lightIntensity;
  });

  return (
    <>
      <ambientLight intensity={0.22} />
      <pointLight ref={lightRef} position={[4, 4, 4]} />
      <pointLight position={[-3, -2, -3]} intensity={0.5} color="#334155" />
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          color="#0b1220"
          metalness={0.7}
          roughness={0.12}
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
