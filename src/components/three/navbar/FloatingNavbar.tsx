import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import { routes, routeMetadata, Surface } from '../../../types/router';

interface NavItem {
  id: Surface;
  label: string;
  shortLabel: string;
  icon?: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'company', label: 'Company', shortLabel: 'CO', icon: '◇' },
  { id: 'platform', label: 'Platform', shortLabel: 'PF', icon: '◆' },
  { id: 'trace', label: 'Trace', shortLabel: 'TR', icon: '◈' },
  { id: 'forge', label: 'Forge', shortLabel: 'FG', icon: '◇' },
  { id: 'architecture', label: 'Architecture', shortLabel: 'AR', icon: '◆' },
  { id: 'traceDocs', label: 'Docs', shortLabel: 'DC', icon: '◈' },
];

const BLADE_WIDTH = 2.8;
const BLADE_HEIGHT = 0.7;
const BLADE_DEPTH = 0.15;
const BLADE_GAP = 0.15;
const TOTAL_WIDTH = NAV_ITEMS.length * (BLADE_WIDTH + BLADE_GAP) - BLADE_GAP;
const START_X = -TOTAL_WIDTH / 2 + BLADE_WIDTH / 2;

interface FloatingNavbarProps {
  sceneType: Surface;
}

export function FloatingNavbar({ sceneType }: FloatingNavbarProps) {
  const [activeIndex, setActiveIndex] = useState(
    NAV_ITEMS.findIndex(item => item.id === sceneType)
  );
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const bladesRef = useRef<THREE.Mesh[]>([]);
  const glowRefs = useRef<THREE.Mesh[]>([]);
  const groupRef = useRef<THREE.Group>(null);

  // Blade geometry and materials
  const bladeGeometry = useMemo(() => new THREE.BoxGeometry(BLADE_WIDTH, BLADE_HEIGHT, BLADE_DEPTH, 4, 4, 1), []);
  const glowGeometry = useMemo(() => new THREE.BoxGeometry(BLADE_WIDTH + 0.1, BLADE_HEIGHT + 0.1, BLADE_DEPTH + 0.2, 4, 4, 1), []);

  const inactiveMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a,
    metalness: 0.3,
    roughness: 0.7,
    transparent: true,
    opacity: 0.85,
    transmission: 0.1,
    thickness: 0.5,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    side: THREE.DoubleSide,
  }), []);

  const activeMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0x00d4aa,
    metalness: 0.2,
    roughness: 0.3,
    transparent: true,
    opacity: 0.95,
    transmission: 0.3,
    thickness: 0.5,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    emissive: new THREE.Color(0x00d4aa),
    emissiveIntensity: 0.3,
    side: THREE.DoubleSide,
  }), []);

  const hoverMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: 0x111111,
    metalness: 0.4,
    roughness: 0.5,
    transparent: true,
    opacity: 0.9,
    transmission: 0.2,
    thickness: 0.5,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
    emissive: new THREE.Color(0x00d4aa),
    emissiveIntensity: 0.15,
    side: THREE.DoubleSide,
  }), []);

  const glowMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0x00d4aa,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  // Animate blades
  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (groupRef.current) {
      // Subtle floating animation for entire navbar
      groupRef.current.position.y = 6.5 + Math.sin(time * 0.8) * 0.08;
      groupRef.current.rotation.x = Math.sin(time * 0.5) * 0.02;
    }

    bladesRef.current.forEach((blade, i) => {
      const isActive = i === activeIndex;
      const isHovered = i === hoverIndex;

      // Blade position animation
      const baseY = isActive ? 0.15 : (isHovered ? 0.08 : 0);
      const floatY = baseY + Math.sin(time * 1.2 + i * 0.5) * (isActive ? 0.03 : 0.015);
      const rotationX = isActive ? 0 : (isHovered ? -0.05 : 0);

      if (blade) {
        blade.position.y = floatY;
        blade.rotation.x = rotationX;
        blade.scale.z = isActive ? 1.2 : (isHovered ? 1.1 : 1);
      }

      // Glow animation
      const glow = glowRefs.current[i];
      if (glow) {
        if (isActive) {
          glow.material.opacity = 0.4 + Math.sin(time * 3) * 0.15;
          glow.scale.setScalar(1.05 + Math.sin(time * 2) * 0.02);
          glow.position.y = 0.18 + Math.sin(time * 1.5) * 0.02;
        } else if (isHovered) {
          glow.material.opacity = 0.2 + Math.sin(time * 2) * 0.1;
          glow.scale.setScalar(1.02);
          glow.position.y = 0.1;
        } else {
          glow.material.opacity = 0;
        }
      }
    });
  });

  const handleNavigate = (id: Surface) => {
    const index = NAV_ITEMS.findIndex(item => item.id === id);
    setActiveIndex(index);
    window.history.pushState({}, '', routes[id]);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <group ref={groupRef} position={[0, 6.5, -4]} rotation={[-0.1, 0, 0]}>
      {NAV_ITEMS.map((item, index) => {
        const isActive = index === activeIndex;
        const isHovered = index === hoverIndex;

        return (
          <group
            key={item.id}
            position={[START_X + index * (BLADE_WIDTH + BLADE_GAP), 0, 0]}
            onPointerOver={() => setHoverIndex(index)}
            onPointerOut={() => setHoverIndex(null)}
            onClick={() => handleNavigate(item.id)}
          >
            {/* Glow effect behind blade */}
            <mesh
              ref={(el) => { glowRefs.current[index] = el!; }}
              geometry={glowGeometry}
              material={glowMaterial}
              position={[0, 0, -0.05]}
              scale={1.1}
            />

            {/* Main blade */}
            <mesh
              ref={(el) => { bladesRef.current[index] = el!; }}
              geometry={bladeGeometry}
              material={isActive ? activeMaterial : (isHovered ? hoverMaterial : inactiveMaterial)}
              castShadow
              receiveShadow
            >
              {/* Edge highlight */}
              <mesh
                geometry={new THREE.EdgesGeometry(bladeGeometry)}
                material={new THREE.LineBasicMaterial({
                  color: isActive ? 0x00ffea : (isHovered ? 0x00d4aa : 0x333333),
                  transparent: true,
                  opacity: isActive ? 0.8 : (isHovered ? 0.5 : 0.15),
                })}
              />
            </mesh>

            {/* Label text - using HTML overlay for crisp text */}
            <Html
              position={[0, 0, 0.25]}
              rotation={[-Math.PI / 2, 0, 0]}
              style={{
                transform: 'translateX(-50%) translateY(-50%)',
                pointerEvents: 'none',
                zIndex: 100,
              }}
            >
              <div className={`nav-blade-label ${isActive ? 'active' : ''} ${isHovered ? 'hovered' : ''}`}
                style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '11px',
                  fontWeight: isActive ? '600' : '400',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: isActive ? '#00ffea' : (isHovered ? '#00d4aa' : '#8b8b9a'),
                  textShadow: isActive
                    ? '0 0 8px #00d4aa, 0 0 16px #00d4aa'
                    : (isHovered ? '0 0 4px #00d4aa' : 'none'),
                  transition: 'all 0.2s ease-out',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.shortLabel}
              </div>
            </Html>

            {/* Full label on hover/active - floating above */}
            {(isActive || isHovered) && (
              <Html
                position={[0, 1.8, 0.3]}
                rotation={[-Math.PI / 2, 0, 0]}
                style={{
                  transform: 'translateX(-50%) translateY(-50%)',
                  pointerEvents: 'none',
                  zIndex: 101,
                }}
              >
                <div className="nav-blade-full-label"
                  style={{
                    fontFamily: '"Inter", sans-serif',
                    fontSize: '13px',
                    fontWeight: '500',
                    letterSpacing: '0.02em',
                    color: '#ffffff',
                    background: 'rgba(10, 10, 10, 0.9)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(0, 212, 170, 0.3)',
                    backdropFilter: 'blur(10px)',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    opacity: isActive ? 1 : 0.9,
                  }}
                >
                  {item.label}
                </div>
              </Html>
            )}

            {/* Active indicator line */}
            {isActive && (
              <mesh
                geometry={new THREE.PlaneGeometry(BLADE_WIDTH * 0.6, 0.04)}
                material={new THREE.MeshBasicMaterial({
                  color: 0x00ffea,
                  transparent: true,
                  opacity: 0.8,
                  depthWrite: false,
                  blending: THREE.AdditiveBlending,
                })}
                position={[0, -0.5, 0.2]}
                rotation={[-Math.PI / 2, 0, 0]}
              />
            )}
          </group>
        );
      })}

      {/* Demo/Request button - floating orb on the right */}
      <Html
        position={[TOTAL_WIDTH / 2 + 2.5, 0, 0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        style={{
          transform: 'translateX(-50%) translateY(-50%)',
          pointerEvents: 'auto',
          zIndex: 102,
        }}
      >
        <button
          onClick={() => handleNavigate('demo')}
          className="nav-demo-btn"
          style={{
            fontFamily: '"Inter", sans-serif',
            fontSize: '13px',
            fontWeight: '600',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: '#030303',
            background: 'linear-gradient(135deg, #00d4aa 0%, #00ffea 100%)',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(0, 212, 170, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            transition: 'all 0.2s ease-out',
            whiteSpace: 'nowrap',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 212, 170, 0.6), inset 0 1px 0 rgba(255,255,255,0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 212, 170, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
          }}
        >
          Request Demo
        </button>
      </Html>
    </group>
  );
}