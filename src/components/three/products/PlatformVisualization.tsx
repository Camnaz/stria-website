import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneConfig } from '../../scene/StriaScene';
import { Html } from '@react-three/drei';

interface PlatformVisualizationProps {
  config: SceneConfig;
}

export function PlatformVisualization({ config }: PlatformVisualizationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const traceOrbitRef = useRef<THREE.Group>(null);
  const forgeOrbitRef = useRef<THREE.Group>(null);
  const bridgeParticlesRef = useRef<THREE.Points>(null);
  const dataPlaneRef = useRef<THREE.Mesh>(null);
  const controlPlaneRef = useRef<THREE.Mesh>(null);
  const trustPlaneRef = useRef<THREE.Mesh>(null);

  // Three planes architecture - representative geometry
  const planeGeometry = useMemo(() => new THREE.CylinderGeometry(4, 4, 0.15, 32, 1, true), []);
  const ringGeometry = useMemo(() => new THREE.TorusGeometry(3.8, 0.06, 16, 64), []);

  const dataPlaneMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0x030303,
    metalness: 0.6,
    roughness: 0.3,
    transparent: true,
    opacity: 0.6,
    emissive: 0x00d4aa,
    emissiveIntensity: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  }), []);

  const controlPlaneMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0x030303,
    metalness: 0.6,
    roughness: 0.3,
    transparent: true,
    opacity: 0.6,
    emissive: 0xf472b6,
    emissiveIntensity: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  }), []);

  const trustPlaneMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0x030303,
    metalness: 0.6,
    roughness: 0.3,
    transparent: true,
    opacity: 0.6,
    emissive: 0xffffff,
    emissiveIntensity: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    side: THREE.DoubleSide,
  }), []);

  // Trace orbit - data ingestion
  const traceNodesCount = 12;
  const traceNodeGeometry = useMemo(() => new THREE.OctahedronGeometry(0.15, 1), []);
  const traceNodeMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0x00d4aa,
    metalness: 0.3,
    roughness: 0.2,
    emissive: 0x00d4aa,
    emissiveIntensity: 0.5,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  }), []);

  // Forge orbit - verified primitives
  const forgeNodesCount = 8;
  const forgeNodeGeometry = useMemo(() => new THREE.BoxGeometry(0.25, 0.25, 0.25, 2, 2, 2), []);
  const forgeNodeMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0xf472b6,
    metalness: 0.5,
    roughness: 0.2,
    emissive: 0xf472b6,
    emissiveIntensity: 0.5,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  }), []);

  // Bridge particles - feedback loop
  const bridgeGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = 300;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count); // 0 = trace->forge, 1 = forge->trace

    for (let i = 0; i < count; i++) {
      phases[i] = Math.random() > 0.5 ? 0 : 1;
      resetBridgeParticle(i, positions, velocities, sizes, phases[i]);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    return geo;
  }, []);

  const bridgeMaterial = useMemo(() => {
    const mat = new THREE.PointsMaterial({
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = `
        attribute float phase;
        attribute float size;
        varying float vPhase;
        uniform float uTime;
        ${shader.vertexShader}
      `.replace(
        'gl_PointSize = size * ( scale / -mvPosition.z );',
        'vPhase = phase; gl_PointSize = size * ( scale / -mvPosition.z );'
      );
      shader.fragmentShader = `
        varying float vPhase;
        ${shader.fragmentShader}
      `.replace(
        'gl_FragColor = vec4( color, opacity );',
        `
        vec3 traceColor = vec3(0.0, 0.83, 0.67);
        vec3 forgeColor = vec3(0.96, 0.45, 0.71);
        vec3 color = mix(traceColor, forgeColor, vPhase);
        gl_FragColor = vec4( color, opacity );
        `
      );
    };
    return mat;
  }, []);

  // Central core - the unified platform
  const coreGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.8, 3), []);
  const coreMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a,
    metalness: 0.8,
    roughness: 0.1,
    transparent: true,
    opacity: 0.9,
    transmission: 0.6,
    thickness: 0.5,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    emissive: 0x00d4aa,
    emissiveIntensity: 0.2,
  }), []);

  const coreWireframeMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0x00ffea,
    wireframe: true,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  // Animation
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const delta = state.clock.getDelta();

    // Three planes rotating at different speeds
    if (dataPlaneRef.current) {
      dataPlaneRef.current.rotation.y = time * 0.15;
      dataPlaneRef.current.position.y = 1.5 + Math.sin(time * 0.5) * 0.1;
      (dataPlaneRef.current.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.15 + Math.sin(time * 1.2) * 0.05;
    }

    if (controlPlaneRef.current) {
      controlPlaneRef.current.rotation.y = -time * 0.12;
      controlPlaneRef.current.position.y = 0;
      (controlPlaneRef.current.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.15 + Math.sin(time * 1.5 + 1) * 0.05;
    }

    if (trustPlaneRef.current) {
      trustPlaneRef.current.rotation.y = time * 0.1;
      trustPlaneRef.current.position.y = -1.5 + Math.sin(time * 0.7) * 0.1;
      (trustPlaneRef.current.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.1 + Math.sin(time * 1.8 + 2) * 0.04;
    }

    // Trace orbit (data plane)
    if (traceOrbitRef.current) {
      traceOrbitRef.current.rotation.y = time * 0.25;
      traceOrbitRef.current.children.forEach((child, i) => {
        const angle = (i / traceNodesCount) * Math.PI * 2 + time * 0.3;
        child.position.x = Math.cos(angle) * 4;
        child.position.z = Math.sin(angle) * 4;
        child.position.y = Math.sin(time * 1.5 + i * 0.5) * 0.3;
        child.rotation.x += delta;
        child.rotation.z += delta * 0.7;
      });
    }

    // Forge orbit (control plane)
    if (forgeOrbitRef.current) {
      forgeOrbitRef.current.rotation.y = -time * 0.2;
      forgeOrbitRef.current.children.forEach((child, i) => {
        const angle = (i / forgeNodesCount) * Math.PI * 2 - time * 0.25;
        child.position.x = Math.cos(angle) * 4;
        child.position.z = Math.sin(angle) * 4;
        child.position.y = Math.sin(time * 1.3 + i * 0.8) * 0.25;
        child.rotation.x += delta * 0.5;
        child.rotation.y += delta * 0.8;
      });
    }

    // Bridge particles - feedback loop
    if (bridgeParticlesRef.current) {
      const positions = bridgeParticlesRef.current.geometry.attributes.position.array as Float32Array;
      const velocities = bridgeParticlesRef.current.geometry.attributes.velocity.array as Float32Array;
      const phases = bridgeParticlesRef.current.geometry.attributes.phase.array as Float32Array;
      const sizes = bridgeParticlesRef.current.geometry.attributes.size.array as Float32Array;
      const count = positions.length / 3;

      for (let i = 0; i < count; i++) {
        positions[i * 3] += velocities[i * 3] * delta * 60;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta * 60;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta * 60;

        const phase = phases[i];
        if (phase === 0) {
          // Trace -> Forge (inward spiral)
          const pos = new THREE.Vector3().fromArray(positions, i * 3);
          const dist = pos.length();
          if (dist < 4.2) {
            phases[i] = 1;
            // Reverse direction
            const idx = i;
            setTimeout(() => {
              if (bridgeParticlesRef.current) {
                const vel = bridgeParticlesRef.current.geometry.attributes.velocity.array as Float32Array;
                const p = new THREE.Vector3().fromArray(positions, idx * 3).normalize();
                vel[idx * 3] = p.x * 0.5;
                vel[idx * 3 + 2] = p.z * 0.5;
                vel[idx * 3 + 1] = 0;
              }
            }, 0);
          }
        } else {
          // Forge -> Trace (outward spiral)
          const pos = new THREE.Vector3().fromArray(positions, i * 3);
          const dist = pos.length();
          if (dist > 4.8) {
            resetBridgeParticle(i, positions, velocities, sizes, 0);
            phases[i] = 0;
          }
        }
      }

      bridgeParticlesRef.current.geometry.attributes.position.needsUpdate = true;
      bridgeParticlesRef.current.geometry.attributes.phase.needsUpdate = true;
    }

    // Core pulsing
    const corePulse = 1 + Math.sin(time * 2) * 0.06;
    if (groupRef.current) {
      groupRef.current.children.forEach(child => {
        if (child.geometry === coreGeometry) {
          child.scale.setScalar(corePulse);
        }
      });
    }

    // Overall subtle movement
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(time * 0.3) * 0.1;
      groupRef.current.rotation.y = Math.sin(time * 0.08) * 0.03;
    }

    if ((bridgeMaterial as any).uniforms?.uTime) {
      (bridgeMaterial as any).uniforms.uTime.value = time;
    }
  });

  function resetBridgeParticle(
    i: number,
    positions: Float32Array,
    velocities: Float32Array,
    sizes: Float32Array,
    phase: number
  ) {
    if (phase === 0) {
      // Start from trace orbit
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * 4.2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      positions[i * 3 + 2] = Math.sin(angle) * 4.2;

      const toCenter = new THREE.Vector3().fromArray(positions, i * 3).normalize().multiplyScalar(-1);
      velocities[i * 3] = toCenter.x * (0.3 + Math.random() * 0.2);
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      velocities[i * 3 + 2] = toCenter.z * (0.3 + Math.random() * 0.2);
    } else {
      // Start from center going out
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * 0.5;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 2] = Math.sin(angle) * 0.5;

      const fromCenter = new THREE.Vector3().fromArray(positions, i * 3).normalize();
      velocities[i * 3] = fromCenter.x * 0.4;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      velocities[i * 3 + 2] = fromCenter.z * 0.4;
    }
    sizes[i] = 0.03 + Math.random() * 0.04;
  }

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Three Planes Architecture */}
      <group position={[0, 1.5, 0]}>
        <mesh ref={dataPlaneRef} geometry={planeGeometry} material={dataPlaneMaterial} receiveShadow />
        <mesh geometry={ringGeometry} material={new THREE.MeshBasicMaterial({
          color: 0x00d4aa,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })} rotation={[-Math.PI / 2, 0, 0]} />
        <Html position={[0, 0.3, 5.5]} rotation={[-Math.PI / 2, 0, 0]} style={{ transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00d4aa', whiteSpace: 'nowrap', textShadow: '0 0 8px #00d4aa' }}>
            DATA PLANE
          </div>
        </Html>
      </group>

      <group position={[0, 0, 0]}>
        <mesh ref={controlPlaneRef} geometry={planeGeometry} material={controlPlaneMaterial} receiveShadow />
        <mesh geometry={ringGeometry} material={new THREE.MeshBasicMaterial({
          color: 0xf472b6,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })} rotation={[-Math.PI / 2, 0, 0]} />
        <Html position={[0, 0.3, 5.5]} rotation={[-Math.PI / 2, 0, 0]} style={{ transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f472b6', whiteSpace: 'nowrap', textShadow: '0 0 8px #f472b6' }}>
            CONTROL PLANE
          </div>
        </Html>
      </group>

      <group position={[0, -1.5, 0]}>
        <mesh ref={trustPlaneRef} geometry={planeGeometry} material={trustPlaneMaterial} receiveShadow />
        <mesh geometry={ringGeometry} material={new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.3,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })} rotation={[-Math.PI / 2, 0, 0]} />
        <Html position={[0, 0.3, 5.5]} rotation={[-Math.PI / 2, 0, 0]} style={{ transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#ffffff', whiteSpace: 'nowrap', textShadow: '0 0 8px #ffffff' }}>
            TRUST PLANE
          </div>
        </Html>
      </group>

      {/* Central Core */}
      <mesh geometry={coreGeometry} material={coreMaterial} castShadow receiveShadow />
      <mesh geometry={coreGeometry} material={coreWireframeMaterial} castShadow receiveShadow />
      <Html position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} style={{ transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', zIndex: 50 }}>
        <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00ffea', whiteSpace: 'nowrap', textShadow: '0 0 12px #00d4aa' }}>
          CORE
        </div>
      </Html>

      {/* Trace Orbit - Data Ingestion */}
      <group ref={traceOrbitRef} position={[0, 1.5, 0]}>
        {[...Array(traceNodesCount)].map((_, i) => (
          <mesh
            key={i}
            geometry={traceNodeGeometry}
            material={traceNodeMaterial}
            castShadow
            position={[Math.cos(i / traceNodesCount * Math.PI * 2) * 4, 0, Math.sin(i / traceNodesCount * Math.PI * 2) * 4]}
          />
        ))}
      </group>

      {/* Forge Orbit - Verified Primitives */}
      <group ref={forgeOrbitRef} position={[0, 0, 0]}>
        {[...Array(forgeNodesCount)].map((_, i) => (
          <mesh
            key={i}
            geometry={forgeNodeGeometry}
            material={forgeNodeMaterial}
            castShadow
            position={[Math.cos(i / forgeNodesCount * Math.PI * 2) * 4, 0, Math.sin(i / forgeNodesCount * Math.PI * 2) * 4]}
          />
        ))}
      </group>

      {/* Bridge Particles - Feedback Loop */}
      <points ref={bridgeParticlesRef} geometry={bridgeGeometry} material={bridgeMaterial} />

      {/* Orbit path indicators */}
      <OrbitPath radius={4} y={1.5} color={0x00d4aa} opacity={0.15} dashed />
      <OrbitPath radius={4} y={0} color={0xf472b6} opacity={0.15} dashed />
    </group>
  );
}

function OrbitPath({ radius, y, color, opacity, dashed }: { radius: number; y: number; color: number; opacity: number; dashed?: boolean }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const points = [];
    const segments = dashed ? 32 : 64;
    for (let i = 0; i <= segments; i++) {
      if (dashed && i % 4 > 1) continue;
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    }
    geo.setFromPoints(points);
    return geo;
  }, [radius, y, dashed]);

  const material = useMemo(() => new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [color, opacity]);

  return <line geometry={geometry} material={material} />;
}