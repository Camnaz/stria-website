import React, { Suspense, lazy } from 'react';
import { Canvas, extend } from '@react-three/fiber';
import * as THREE from 'three';
import { ScrollProgressProvider } from '../hooks/useScrollProgress';

// Extend Three.js objects for JSX
// @ts-ignore --- R3F extend accepts the whole THREE namespace; UniformsUtils is not a constructor but is harmless
extend(THREE);

// Lazy-loaded scene components for code splitting
const StriaScene = lazy(() => import('../scene/StriaScene').then(m => ({ default: m.StriaScene })));
const FloatingNavbar = lazy(() => import('../navbar/FloatingNavbar').then(m => ({ default: m.FloatingNavbar })));

type Surface = 'company' | 'platform' | 'trace' | 'forge' | 'architecture' | 'traceDocs' | 'demo';

interface ThreeCanvasProps {
  children: React.ReactNode;
  sceneType?: Surface;
}

export function ThreeCanvas({ children, sceneType = 'company' }: ThreeCanvasProps) {
  return (
    <ScrollProgressProvider>
      <div className="three-canvas-wrapper" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <Canvas
          camera={{ position: [0, 0, 10], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            logarithmicDepthBuffer: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1,
          }}
          shadows={true}
        >
          <Suspense fallback={<SceneLoadingFallback />}>
            {/* @ts-ignore --- internal 3D component uses different sceneType strings */}
            <StriaScene sceneType={sceneType} />
            {/* @ts-ignore --- internal 3D component uses different sceneType strings */}
            <FloatingNavbar sceneType={sceneType} />
          </Suspense>
        </Canvas>

        {/* HTML content layer - sits on top of Three.js */}
        <div className="html-content-layer" style={{ position: 'relative', zIndex: 10 }}>
          {children}
        </div>
      </div>
    </ScrollProgressProvider>
  );
}

function SceneLoadingFallback() {
  return (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#030303',
      zIndex: 100,
    }}>
      <div style={{
        width: 40, height: 40,
        border: '2px solid rgba(0, 212, 170, 0.2)',
        borderTopColor: '#00d4aa',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
