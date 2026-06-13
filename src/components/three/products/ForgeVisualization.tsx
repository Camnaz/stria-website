import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneConfig } from '../../scene/StriaScene';
import { Html } from '@react-three/drei';

interface ForgeVisualizationProps {
  config: SceneConfig;
}

export function ForgeVisualization({ config }: ForgeVisualizationProps) {
  const groupRef = useRef<THREE.Group>(null);
  const clusterRefs = useRef<THREE.Group[]>([]);
  const verificationRingRef = useRef<THREE.Mesh>(null);
  const registryBlocksRef = useRef<THREE.Mesh[]>([]);
  const conveyorParticlesRef = useRef<THREE.Points>(null);
  const sandboxRef = useRef<THREE.Mesh>(null);

  // Workflow clusters - raw data entering the system
  const clusterGeometry = useMemo(() => new THREE.DodecahedronGeometry(0.35, 1), []);
  const clusterCount = 8;

  // Verification ring - the validation gate
  const ringGeometry = useMemo(() => new THREE.TorusGeometry(2.5, 0.12, 12, 48), []);
  const ringMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0xf472b6,
    metalness: 0.6,
    roughness: 0.2,
    emissive: 0xf472b6,
    emissiveIntensity: 0.6,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.8,
  }), []);

  // Registry blocks - approved primitives
  const blockGeometry = useMemo(() => new THREE.BoxGeometry(0.6, 0.35, 0.6, 2, 1, 2), []);
  const blockMaterials = useMemo(() => [
    new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0xf472b6, emissiveIntensity: 0.1 }),
    new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0x00d4aa, emissiveIntensity: 0.1 }),
    new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.08 }),
    new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0x00ffea, emissiveIntensity: 0.1 }),
  ], []);

  // Conveyor particles - workflows moving through
  const conveyorGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = 400;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count); // 0=cluster, 1=verification, 2=registry

    for (let i = 0; i < count; i++) {
      const phase = Math.floor(Math.random() * 3);
      phases[i] = phase;
      resetConveyorParticle(i, positions, velocities, sizes, phase);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    return geo;
  }, []);

  const conveyorMaterial = useMemo(() => {
    const mat = new THREE.PointsMaterial({
      size: 0.06,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      shader.attributes.phase = { value: null }; // placeholder
      shader.vertexShader = `
        attribute float phase;
        attribute float size;
        varying float vPhase;
        varying float vSize;
        uniform float uTime;
        ${shader.vertexShader}
      `.replace(
        'gl_PointSize = size * ( scale / -mvPosition.z );',
        'vPhase = phase; vSize = size; gl_PointSize = size * ( scale / -mvPosition.z );'
      );
      shader.fragmentShader = `
        varying float vPhase;
        varying float vSize;
        ${shader.fragmentShader}
      `.replace(
        'gl_FragColor = vec4( color, opacity );',
        `
        vec3 phaseColor;
        if (vPhase < 0.5) phaseColor = vec3(0.0, 0.83, 0.67); // cyan - cluster
        else if (vPhase < 1.5) phaseColor = vec3(0.96, 0.45, 0.71); // pink - verification
        else phaseColor = vec3(0.0, 1.0, 0.92); // teal - registry
        gl_FragColor = vec4( phaseColor, opacity * vSize * 10.0 );
        `
      );
    };
    return mat;
  }, []);

  // Sandbox - isolated execution environment
  const sandboxGeometry = useMemo(() => new THREE.BoxGeometry(3, 2.5, 3, 4, 4, 4), []);
  const sandboxMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a,
    metalness: 0.4,
    roughness: 0.6,
    transparent: true,
    opacity: 0.3,
    transmission: 0.5,
    thickness: 1.0,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
    wireframe: true,
  }), []);

  // Animation
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const delta = state.clock.getDelta();

    // Clusters orbiting on the left
    clusterRefs.current.forEach((cluster, i) => {
      if (!cluster) return;
      const angle = time * 0.3 + i * (Math.PI * 2 / clusterCount);
      const radius = 4.5;
      cluster.position.x = -5.5 + Math.cos(angle) * radius * 0.3;
      cluster.position.z = Math.sin(angle) * radius * 0.3;
      cluster.position.y = Math.sin(time * 0.8 + i) * 0.8;
      cluster.rotation.x += delta * 0.4;
      cluster.rotation.y += delta * 0.6;

      // Pulse individual nodes
      cluster.children.forEach((child, j) => {
        if (child instanceof THREE.Mesh) {
          const pulse = Math.sin(time * 2 + i + j) * 0.1 + 1;
          child.scale.setScalar(pulse);
        }
      });
    });

    // Verification ring
    if (verificationRingRef.current) {
      verificationRingRef.current.rotation.x = Math.PI / 2;
      verificationRingRef.current.rotation.y = time * 0.2;
      const pulse = Math.sin(time * 3) * 0.08 + 1;
      verificationRingRef.current.scale.setScalar(pulse);
      (verificationRingRef.current.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.6 + Math.sin(time * 3) * 0.3;
    }

    // Registry blocks - stacked on the right
    registryBlocksRef.current.forEach((block, i) => {
      if (!block) return;
      const float = Math.sin(time * 0.6 + i) * 0.05;
      block.position.y = (i - 1.5) * 0.6 + float;
      block.rotation.y = Math.sin(time * 0.4 + i * 2) * 0.05;
    });

    // Conveyor particles animation
    if (conveyorParticlesRef.current) {
      const positions = conveyorParticlesRef.current.geometry.attributes.position.array as Float32Array;
      const velocities = conveyorParticlesRef.current.geometry.attributes.velocity.array as Float32Array;
      const phases = conveyorParticlesRef.current.geometry.attributes.phase.array as Float32Array;
      const sizes = conveyorParticlesRef.current.geometry.attributes.size.array as Float32Array;
      const count = positions.length / 3;

      for (let i = 0; i < count; i++) {
        positions[i * 3] += velocities[i * 3] * delta * 60;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta * 60;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta * 60;

        // Phase transitions
        const phase = phases[i];
        if (phase === 0 && positions[i * 3] > -2) {
          // Entering verification
          phases[i] = 1;
          const idx = i;
          setTimeout(() => {
            if (conveyorParticlesRef.current) {
              const vel = conveyorParticlesRef.current.geometry.attributes.velocity.array as Float32Array;
              vel[idx * 3] = 0.8;
              vel[idx * 3 + 1] = (Math.random() - 0.5) * 0.3;
              vel[idx * 3 + 2] = 0;
            }
          }, 0);
        } else if (phase === 1 && positions[i * 3] > 1) {
          // Entering registry
          phases[i] = 2;
          const idx = i;
          setTimeout(() => {
            if (conveyorParticlesRef.current) {
              const vel = conveyorParticlesRef.current.geometry.attributes.velocity.array as Float32Array;
              vel[idx * 3] = 0;
              vel[idx * 3 + 1] = 0;
              vel[idx * 3 + 2] = 0;
            }
          }, 0);
        } else if (phase === 2 && positions[i * 3] > 4) {
          // Reset to cluster
          resetConveyorParticle(i, positions, velocities, sizes, 0);
          phases[i] = 0;
        }
      }

      conveyorParticlesRef.current.geometry.attributes.position.needsUpdate = true;
      conveyorParticlesRef.current.geometry.attributes.phase.needsUpdate = true;
    }

    // Sandbox pulsing
    if (sandboxRef.current) {
      sandboxRef.current.rotation.y = time * 0.05;
      const scale = 1 + Math.sin(time * 1.5) * 0.03;
      sandboxRef.current.scale.setScalar(scale);
    }

    // Overall group movement
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(time * 0.35) * 0.12;
      groupRef.current.rotation.y = Math.sin(time * 0.12) * 0.04;
    }

    // Update shader time
    if ((conveyorMaterial as any).uniforms?.uTime) {
      (conveyorMaterial as any).uniforms.uTime.value = time;
    }
  });

  function resetConveyorParticle(
    i: number,
    positions: Float32Array,
    velocities: Float32Array,
    sizes: Float32Array,
    phase: number
  ) {
    if (phase === 0) {
      // Cluster phase - spawn around clusters
      positions[i * 3] = -7 + Math.random() * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3;
      velocities[i * 3] = 0.3 + Math.random() * 0.3;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.2;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    } else if (phase === 1) {
      // Verification phase
      positions[i * 3] = -2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
      velocities[i * 3] = 0.6;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
    } else {
      // Registry phase
      positions[i * 3] = 2 + Math.random() * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
      velocities[i * 3] = 0.1;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;
    }
    sizes[i] = 0.04 + Math.random() * 0.04;
  }

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Stage 1: Workflow Clusters (left) - raw telemetry */}
      <group position={[-5.5, 0, 0]}>
        <Html position={[0, 2.8, 0]} rotation={[-Math.PI / 2, 0, 0]} style={{ transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00d4aa', textShadow: '0 0 8px #00d4aa', whiteSpace: 'nowrap' }}>
            CLUSTER
          </div>
        </Html>
        {[...Array(clusterCount)].map((_, i) => (
          <WorkflowCluster
            key={i}
            ref={(el) => { clusterRefs.current[i] = el!; }}
            geometry={clusterGeometry}
            index={i}
            count={clusterCount}
          />
        ))}
      </group>

      {/* Conveyor - data flow between stages */}
      <points ref={conveyorParticlesRef} geometry={conveyorGeometry} material={conveyorMaterial} />

      {/* Stage 2: Verification Ring (center) - sandbox testing */}
      <mesh
        ref={verificationRingRef}
        geometry={ringGeometry}
        material={ringMaterial}
        castShadow
      />
      <Html position={[0, 2.8, 0]} rotation={[-Math.PI / 2, 0, 0]} style={{ transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', zIndex: 50 }}>
        <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#f472b6', textShadow: '0 0 8px #f472b6', whiteSpace: 'nowrap' }}>
          VERIFY
        </div>
      </Html>

      {/* Sandbox - isolated execution box */}
      <mesh ref={sandboxRef} geometry={sandboxGeometry} material={sandboxMaterial} castShadow receiveShadow position={[0, 0, 0]} />
      <Html position={[0, -2.8, 0]} rotation={[-Math.PI / 2, 0, 0]} style={{ transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', zIndex: 50 }}>
        <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '9px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#f472b6', whiteSpace: 'nowrap', opacity: 0.6 }}>
          SANDBOX
        </div>
      </Html>

      {/* Stage 3: Registry (right) - approved primitives */}
      <group position={[5.5, 0, 0]}>
        <Html position={[0, 2.8, 0]} rotation={[-Math.PI / 2, 0, 0]} style={{ transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', zIndex: 50 }}>
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '10px', fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00ffea', textShadow: '0 0 8px #00ffea', whiteSpace: 'nowrap' }}>
            REGISTRY
          </div>
        </Html>
        {['Payment\nProcessor', 'Refund\nHandler', 'Fraud\nDetector', 'Audit\nLogger'].map((label, i) => (
          <RegistryBlock
            key={label}
            ref={(el) => { registryBlocksRef.current[i] = el!; }}
            geometry={blockGeometry}
            material={blockMaterials[i % blockMaterials.length]}
            label={label}
            index={i}
          />
        ))}
      </group>

      {/* Connecting arcs between stages */}
      <StageConnector start={-4} end={-1.5} color={0x00d4aa} label="INGEST" />
      <StageConnector start={1.5} end={4} color={0x00ffea} label="DEPLOY" />
    </group>
  );
}

interface WorkflowClusterProps extends React.HTMLAttributes<THREE.Group> {
  geometry: THREE.BufferGeometry;
  index: number;
  count: number;
}

const WorkflowCluster = React.forwardRef<THREE.Group, WorkflowClusterProps>((props, ref) => {
  const { geometry, index, count, ...rest } = props;
  const angle = (index / count) * Math.PI * 2;
  const radius = 1.5;
  const nodes = 5;

  return (
    <group ref={ref} {...rest} position={[Math.cos(angle) * radius, (index - count / 2) * 0.3, Math.sin(angle) * radius]}>
      {[...Array(nodes)].map((_, j) => {
        const nodeAngle = (j / nodes) * Math.PI * 2;
        const nodeRadius = 0.5;
        return (
          <mesh
            key={j}
            geometry={geometry}
            material={new THREE.MeshPhysicalMaterial({
              color: new THREE.Color().lerpColors(new THREE.Color(0x00d4aa), new THREE.Color(0x00ffea), j / nodes),
              metalness: 0.4,
              roughness: 0.3,
              emissive: new THREE.Color().lerpColors(new THREE.Color(0x00d4aa), new THREE.Color(0x00ffea), j / nodes),
              emissiveIntensity: 0.3,
              clearcoat: 1,
              clearcoatRoughness: 0.1,
              transparent: true,
              opacity: 0.85,
            })}
            castShadow
            position={[Math.cos(nodeAngle) * nodeRadius, Math.sin(nodeAngle) * nodeRadius * 0.5, 0]}
            rotation={[0, 0, nodeAngle]}
            scale={0.7}
          />
        );
      })}
      {/* Connecting lines */}
      <ClusterConnections count={nodes} radius={nodeRadius} color={index % 2 === 0 ? 0x00d4aa : 0x00ffea} />
    </group>
  );
});

function ClusterConnections({ count, radius, color }: { count: number; radius: number; color: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];

    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      const angle1 = (i / count) * Math.PI * 2;
      const angle2 = (next / count) * Math.PI * 2;

      positions.push(Math.cos(angle1) * radius, Math.sin(angle1) * radius * 0.5, 0);
      positions.push(Math.cos(angle2) * radius, Math.sin(angle2) * radius * 0.5, 0);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, [count, radius]);

  const material = useMemo(() => new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [color]);

  return <line geometry={geometry} material={material} />;
}

interface RegistryBlockProps extends React.HTMLAttributes<THREE.Mesh> {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  label: string;
  index: number;
}

const RegistryBlock = React.forwardRef<THREE.Mesh, RegistryBlockProps>((props, ref) => {
  const { geometry, material, label, index, ...rest } = props;

  return (
    <group>
      <mesh ref={ref as any} geometry={geometry} material={material} castShadow receiveShadow {...rest} position={[0, 0, 0]} />
      {/* Edge highlight */}
      <mesh geometry={new THREE.EdgesGeometry(geometry)} material={new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.5, depthWrite: false })} />
      <Html position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} style={{ transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', zIndex: 50 }}>
        <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '8px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff', whiteSpace: 'pre', textAlign: 'center', lineHeight: '1.2', opacity: 0.8 }}>
          {label}
        </div>
      </Html>
    </group>
  );
});

function StageConnector({ start, end, color, label }: { start: number; end: number; color: number; label: string }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const points = [];
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(start, 0, 0),
      new THREE.Vector3(start + (end - start) * 0.3, 1.5, 0),
      new THREE.Vector3(start + (end - start) * 0.7, 1.5, 0),
      new THREE.Vector3(end, 0, 0)
    );
    points.push(...curve.getPoints(32));
    geo.setFromPoints(points);
    return geo;
  }, [start, end]);

  const material = useMemo(() => new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }), [color]);

  return (
    <group>
      <line geometry={geometry} material={material} />
      <Html position={[(start + end) / 2, 2.2, 0]} rotation={[-Math.PI / 2, 0, 0]} style={{ transform: 'translateX(-50%) translateY(-50%)', pointerEvents: 'none', zIndex: 50 }}>
        <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '8px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', color: `#${color.toString(16).padStart(6, '0')}`, whiteSpace: 'nowrap', opacity: 0.7 }}>
          {label}
        </div>
      </Html>
    </group>
  );
}