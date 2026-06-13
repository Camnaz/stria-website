import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneConfig } from './StriaScene';

interface ParticleFieldProps {
  density: number;
  color: THREE.Color;
}

export function ParticleField({ density, color }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = Math.floor(2000 * density);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const radius = 8 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      sizes[i] = 0.5 + Math.random() * 1.5;
      alphas[i] = 0.1 + Math.random() * 0.4;

      // Slow drift velocities
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    return geo;
  }, [density]);

  const material = useMemo(() => {
    const mat = new THREE.PointsMaterial({
      color,
      size: 1,
      transparent: true,
      opacity: 0.4,
      vertexColors: false,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uColor = { value: color };
      shader.vertexShader = `
        attribute float size;
        attribute float alpha;
        varying float vAlpha;
        uniform float uTime;
        ${shader.vertexShader}
      `.replace(
        'gl_PointSize = size * ( scale / -mvPosition.z );',
        `
        float pulse = sin(uTime * 0.5 + position.x * 0.5) * 0.3 + 0.7;
        vAlpha = alpha * pulse;
        gl_PointSize = size * pulse * ( scale / -mvPosition.z );
        `
      );
      shader.fragmentShader = `
        varying float vAlpha;
        uniform vec3 uColor;
        ${shader.fragmentShader}
      `.replace(
        'gl_FragColor = vec4( color, opacity );',
        'gl_FragColor = vec4( uColor, vAlpha * opacity );'
      );
    };

    return mat;
  }, [color]);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const time = state.clock.getElapsedTime();
    const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const velocities = pointsRef.current.geometry.attributes.velocity.array as Float32Array;
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      positions[i * 3] += velocities[i * 3];
      positions[i * 3 + 1] += velocities[i * 3 + 1];
      positions[i * 3 + 2] += velocities[i * 3 + 2];

      // Wrap around sphere
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const dist = Math.sqrt(x * x + y * y + z * z);

      if (dist > 20 || dist < 6) {
        const radius = 8 + Math.random() * 12;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;

    // Update shader time uniform
    if ((material as any).uniforms?.uTime) {
      (material as any).uniforms.uTime.value = time;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}