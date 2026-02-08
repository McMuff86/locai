"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 120;
const CONNECTION_DISTANCE = 2.2;
const FIELD_SIZE = 12;

function Particles() {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * FIELD_SIZE;
      pos[i * 3 + 1] = (Math.random() - 0.5) * FIELD_SIZE;
      pos[i * 3 + 2] = (Math.random() - 0.5) * FIELD_SIZE * 0.5;
      vel[i * 3] = (Math.random() - 0.5) * 0.008;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.008;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
    }
    return { positions: pos, velocities: vel };
  }, []);

  const linePositions = useMemo(
    () => new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 6),
    []
  );
  const lineColors = useMemo(
    () => new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 6),
    []
  );

  useFrame(() => {
    if (!pointsRef.current || !linesRef.current) return;

    const posAttr = pointsRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    // Update positions
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      posArray[ix] += velocities[ix];
      posArray[ix + 1] += velocities[ix + 1];
      posArray[ix + 2] += velocities[ix + 2];

      // Bounce
      for (let j = 0; j < 3; j++) {
        const limit = j === 2 ? FIELD_SIZE * 0.25 : FIELD_SIZE * 0.5;
        if (Math.abs(posArray[ix + j]) > limit) {
          velocities[ix + j] *= -1;
          posArray[ix + j] = Math.sign(posArray[ix + j]) * limit;
        }
      }
    }
    posAttr.needsUpdate = true;

    // Build connections
    let lineIdx = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const dx = posArray[i * 3] - posArray[j * 3];
        const dy = posArray[i * 3 + 1] - posArray[j * 3 + 1];
        const dz = posArray[i * 3 + 2] - posArray[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < CONNECTION_DISTANCE) {
          const alpha = 1 - dist / CONNECTION_DISTANCE;
          const opacity = alpha * 0.35;

          linePositions[lineIdx * 6] = posArray[i * 3];
          linePositions[lineIdx * 6 + 1] = posArray[i * 3 + 1];
          linePositions[lineIdx * 6 + 2] = posArray[i * 3 + 2];
          linePositions[lineIdx * 6 + 3] = posArray[j * 3];
          linePositions[lineIdx * 6 + 4] = posArray[j * 3 + 1];
          linePositions[lineIdx * 6 + 5] = posArray[j * 3 + 2];

          // Teal color matching --primary
          lineColors[lineIdx * 6] = 0.0;
          lineColors[lineIdx * 6 + 1] = 0.78 * opacity;
          lineColors[lineIdx * 6 + 2] = 0.65 * opacity;
          lineColors[lineIdx * 6 + 3] = 0.0;
          lineColors[lineIdx * 6 + 4] = 0.78 * opacity;
          lineColors[lineIdx * 6 + 5] = 0.65 * opacity;

          lineIdx++;
        }
      }
    }

    const lineGeo = linesRef.current.geometry;
    const linePosAttr = lineGeo.attributes.position as THREE.BufferAttribute;
    const lineColAttr = lineGeo.attributes.color as THREE.BufferAttribute;
    (linePosAttr.array as Float32Array).set(linePositions);
    (lineColAttr.array as Float32Array).set(lineColors);
    linePosAttr.needsUpdate = true;
    lineColAttr.needsUpdate = true;
    lineGeo.setDrawRange(0, lineIdx * 2);
  });

  const maxLines = PARTICLE_COUNT * PARTICLE_COUNT;

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.04}
          color="#00c8a8"
          transparent
          opacity={0.6}
          sizeAttenuation
          depthWrite={false}
        />
      </points>

      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[lineColors, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.5} depthWrite={false} />
      </lineSegments>
    </>
  );
}

export default function ParticleField() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Particles />
      </Canvas>
    </div>
  );
}
