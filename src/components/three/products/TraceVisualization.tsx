import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneConfig } from '../../scene/StriaScene';

interface TraceVisualizationProps {
  config: SceneConfig;
}

export function TraceVisualization({ config }: TraceVisualizationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const evidenceChainRef = useRef<THREE.Group>(null);
  const identityNodesRef = useRef<THREE.Mesh[]>([]);
  const particleFlowRef = useRef<THREE.Points>(null);
  const policyGateRef = useRef<THREE.Mesh>(null);

  // Evidence chain geometry - linked blocks representing chain of custody
  const chainGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const blockCount = 12;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < blockCount; i++) {
      const angle = (i / blockCount) * Math.PI * 2;
      const radius = 3.5;
      const y = (i - blockCount / 2) * 0.6;

      // Cube vertices for each block
      const size = 0.35;
      const basePositions = [
        [-size, -size, -size], [size, -size, -size], [size, size, -size], [-size, size, -size],
        [-size, -size, size], [size, -size, size], [size, size, size], [-size, size, size],
      ];

      for (const [bx, by, bz] of basePositions) {
        positions.push(
          bx + radius * Math.cos(angle),
          by + y,
          bz + radius * Math.sin(angle)
        );
      }

      // Color gradient from cyan to pink
      const t = i / (blockCount - 1);
      const color = new THREE.Color().lerpColors(
        new THREE.Color(0x00d4aa),
        new THREE.Color(0xf472b6),
        t
      );
      for (let v = 0; v < 8; v++) {
        colors.push(color.r, color.g, color.b);
      }

      // Cube indices
      const cubeIndices = [
        0, 1, 2, 2, 3, 0, // back
        4, 5, 6, 6, 7, 4, // front
        0, 4, 7, 7, 3, 0, // left
        1, 5, 6, 6, 2, 1, // right
        3, 7, 6, 6, 2, 3, // top
        0, 1, 5, 5, 4, 0, // bottom
      ];
      cubeIndices.forEach(idx => indices.push(idx + i * 8));
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, []);

  const chainMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    metalness: 0.4,
    roughness: 0.3,
    transparent: true,
    opacity: 0.85,
    transmission: 0.4,
    thickness: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    emissive: new THREE.Color(0x00d4aa),
    emissiveIntensity: 0.1,
  }), []);

  // Identity nodes - orbiting the evidence chain
  const nodeGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.18, 2), []);
  const nodeMaterials = useMemo(() => [
    new THREE.MeshPhysicalMaterial({ color: 0x00d4aa, metalness: 0.3, roughness: 0.2, emissive: 0x00d4aa, emissiveIntensity: 0.4, clearcoat: 1 }),
    new THREE.MeshPhysicalMaterial({ color: 0x00ffea, metalness: 0.3, roughness: 0.2, emissive: 0x00ffea, emissiveIntensity: 0.4, clearcoat: 1 }),
    new THREE.MeshPhysicalMaterial({ color: 0xf472b6, metalness: 0.3, roughness: 0.2, emissive: 0xf472b6, emissiveIntensity: 0.4, clearcoat: 1 }),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.3, clearcoat: 1 }),
  ], []);

  // Particle flow - data streaming through the system
  const flowGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = 800;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const lifetimes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      resetParticle(i, positions, velocities, sizes, lifetimes);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
    return geo;
  }, []);

  const flowMaterial = useMemo(() => {
    const mat = new THREE.PointsMaterial({
      color: 0x00d4aa,
      size: 0.08,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.vertexShader = `
        attribute float size;
        attribute float lifetime;
        varying float vLifetime;
        uniform float uTime;
        ${shader.vertexShader}
      `.replace(
        'gl_PointSize = size * ( scale / -mvPosition.z );',
        'vLifetime = lifetime; gl_PointSize = size * lifetime * ( scale / -mvPosition.z );'
      );
      shader.fragmentShader = `
        varying float vLifetime;
        ${shader.fragmentShader}
      `.replace(
        'gl_FragColor = vec4( color, opacity );',
        'gl_FragColor = vec4( color, opacity * vLifetime );'
      );
    };
    return mat;
  }, []);

  // Policy gate - a torus/ring that validates flow
  const gateGeometry = useMemo(() => new THREE.TorusGeometry(2.2, 0.08, 16, 64), []);
  const gateMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0x00d4aa,
    metalness: 0.5,
    roughness: 0.2,
    emissive: 0x00d4aa,
    emissiveIntensity: 0.5,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.7,
  }), []);

  // Animation
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const delta = state.clock.getDelta();

    // Rotate evidence chain slowly
    if (evidenceChainRef.current) {
      evidenceChainRef.current.rotation.y = time * 0.08;
      evidenceChainRef.current.rotation.x = Math.sin(time * 0.3) * 0.15;
    }

    // Animate identity nodes orbiting
    identityNodesRef.current.forEach((node, i) => {
      if (!node) return;
      const angle = time * 0.4 + i * (Math.PI * 2 / 4);
      const radius = 4.2 + Math.sin(time * 0.7 + i) * 0.3;
      node.position.x = Math.cos(angle) * radius;
      node.position.z = Math.sin(angle) * radius;
      node.position.y = Math.sin(time * 1.2 + i) * 1.2;
      node.rotation.x += delta * 0.5;
      node.rotation.y += delta * 0.3;
    });

    // Animate particle flow
    if (particleFlowRef.current) {
      const positions = particleFlowRef.current.geometry.attributes.position.array as Float32Array;
      const velocities = particleFlowRef.current.geometry.attributes.velocity.array as Float32Array;
      const lifetimes = particleFlowRef.current.geometry.attributes.lifetime.array as Float32Array;
      const count = positions.length / 3;

      for (let i = 0; i < count; i++) {
        positions[i * 3] += velocities[i * 3] * delta * 60;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta * 60;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta * 60;

        lifetimes[i] -= delta * 0.8;

        if (lifetimes[i] <= 0) {
          resetParticle(i, positions, velocities, particleFlowRef.current.geometry.attributes.size.array as Float32Array, lifetimes);
        }
      }
      particleFlowRef.current.geometry.attributes.position.needsUpdate = true;
      particleFlowRef.current.geometry.attributes.lifetime.needsUpdate = true;
    }

    // Policy gate pulsing
    if (policyGateRef.current) {
      policyGateRef.current.rotation.x = Math.PI / 2;
      policyGateRef.current.rotation.y = time * 0.15;
      const pulse = Math.sin(time * 2.5) * 0.15 + 0.85;
      policyGateRef.current.scale.setScalar(pulse);
      (policyGateRef.current.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.5 + Math.sin(time * 2.5) * 0.3;
    }

    // Overall group subtle movement
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(time * 0.4) * 0.15;
      groupRef.current.rotation.y = Math.sin(time * 0.15) * 0.05;
    }
  });

  function resetParticle(
    i: number,
    positions: Float32Array,
    velocities: Float32Array,
    sizes: Float32Array,
    lifetimes: Float32Array
  ) {
    // Spawn at random position on a sphere around the chain
    const radius = 4.5 + Math.random() * 2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) + (Math.random() - 0.5) * 3;
    positions[i * 3 + 2] = radius * Math.cos(phi);

    // Velocity toward center, then through gate
    const toCenter = new THREE.Vector3().fromArray(positions, i * 3).normalize().multiplyScalar(-1);
    velocities[i * 3] = toCenter.x * (0.5 + Math.random() * 0.5);
    velocities[i * 3 + 1] = (Math.random() - 0.3) * 0.5;
    velocities[i * 3 + 2] = toCenter.z * (0.5 + Math.random() * 0.5);

    sizes[i] = 0.05 + Math.random() * 0.1;
    lifetimes[i] = 0.5 + Math.random() * 1.5;
  }

  return (
    <group ref={groupRef} position={[0, -0.5, 0]}>
      {/* Evidence Chain - central rotating structure */}
      <group ref={evidenceChainRef} position={[0, 0, 0]}>
        <mesh geometry={chainGeometry} material={chainMaterial} castShadow receiveShadow />
        {/* Connecting lines between blocks */}
        <EvidenceChainLinks count={12} radius={3.5} />
      </group>

      {/* Identity Nodes - orbiting the evidence chain */}
      <group ref={identityNodesRef} position={[0, 0, 0]}>
        {['Agent Identity', 'Human Operator', 'Service Account', 'Policy Posture'].map((label, i) => (
          <IdentityNode
            key={label}
            ref={(el) => { identityNodesRef.current[i] = el!; }}
            geometry={nodeGeometry}
            material={nodeMaterials[i % nodeMaterials.length]}
            label={label}
            index={i}
          />
        ))}
      </group>

      {/* Policy Gate - validation ring */}
      <mesh
        ref={policyGateRef}
        geometry={gateGeometry}
        material={gateMaterial}
        castShadow
      />

      {/* Data Particle Flow */}
      <points ref={particleFlowRef} geometry={flowGeometry} material={flowMaterial} />

      {/* Outer glow ring */}
      <GlowRing radius={5.5} color={0x00d4aa} intensity={0.15} />
    </group>
  );
}

function EvidenceChainLinks({ count, radius }: { count: number; radius: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const angle1 = (i / count) * Math.PI * 2;
      const angle2 = (next / count) * Math.PI * 2;
      const y = (i - count / 2) * 0.6;

      // Link from center of block i to center of block next
      const x1 = 0;
      const x2 = 0;

      positions.push(0, y, radius);
      positions.push(0, y, radius);

      // Color gradient
      const t = i / (count - 1);
      const color = new THREE.Color().lerpColors(new THREE.Color(0x00d4aa), new THREE.Color(0xf472b6), t);
      colors.push(color.r, color.g, color.b, 0.6);
      colors.push(color.r, color.g, color.b, 0.1);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    return geo;
  }, [count, radius]);

  const material = useMemo(() => new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [count, radius]);

  return <line geometry={geometry} material={material} />;
}

interface IdentityNodeProps extends React.HTMLAttributes<THREE.Mesh> {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  label: string;
  index: number;
}

const IdentityNode = React.forwardRef<THREE.Mesh, IdentityNodeProps>((props, ref) => {
  const { geometry, material, label, index, ...rest } = props;
  const labelRef = useRef<HTMLDivElement>(null);

  return (
    <group>
      <mesh ref={ref as any} geometry={geometry} material={material} castShadow {...rest} />
      {/* Label using HTML overlay */}
      <Html position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} style={{ transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', zIndex: 50 }}>
        <div ref={labelRef} style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '9px',
          fontWeight: '500',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#00d4aa',
          textShadow: '0 0 8px #00d4aa',
          whiteSpace: 'nowrap',
          opacity: 0.7,
          transition: 'opacity 0.3s',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
});

function GlowRing({ radius, color, intensity }: { radius: number; color: number; intensity: number }) {
  const geometry = useMemo(() => new THREE.RingGeometry(radius - 0.1, radius + 0.1, 64), [radius]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: intensity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  }), [color, intensity]);

  return <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />;
}