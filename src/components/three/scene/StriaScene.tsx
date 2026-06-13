import React, { useMemo } from 'react';
import { Environment, OrbitControls, useFrame } from '@react-three/drei';
import * as THREE from 'three';
import { SceneLighting } from './SceneLighting';
import { ParticleField } from './ParticleField';
import { TraceVisualization } from '../products/TraceVisualization';
import { ForgeVisualization } from '../products/ForgeVisualization';
import { PlatformVisualization } from '../products/PlatformVisualization';

interface StriaSceneProps {
  sceneType: 'home' | 'trace' | 'forge' | 'platform' | 'architecture' | 'docs' | 'demo';
}

export function StriaScene({ sceneType }: StriaSceneProps) {
  const sceneConfig = useMemo(() => getSceneConfig(sceneType), [sceneType]);

  return (
    <>
      {/* Base environment and lighting */}
      <SceneLighting config={sceneConfig} />

      {/* Subtle particle field for atmosphere */}
      <ParticleField density={sceneConfig.particleDensity} color={sceneConfig.particleColor} />

      {/* Scene-specific product visualizations */}
      {sceneConfig.visualization && <sceneConfig.visualization config={sceneConfig} />}

      {/* Camera controls - disabled by default, enable for debugging */}
      <OrbitControls
        enableRotate={false}
        enableZoom={false}
        enablePan={false}
        enabled={false}
      />

      {/* Environment reflection for PBR materials */}
      <Environment
        background={false}
        files={sceneConfig.envMap}
        preset={sceneConfig.envPreset}
        resolution={256}
      />
    </>
  );
}

function getSceneConfig(sceneType: StriaSceneProps['sceneType']) {
  const baseConfig = {
    particleDensity: 0.3,
    particleColor: new THREE.Color(0x00d4aa),
    envPreset: 'warehouse' as const,
    envMap: undefined as string[] | undefined,
  };

  switch (sceneType) {
    case 'home':
      return {
        ...baseConfig,
        visualization: PlatformVisualization,
        cameraPosition: [0, 0, 12],
        cameraTarget: [0, 0, 0],
        ambientIntensity: 0.4,
        keyLightIntensity: 1.2,
        fillLightIntensity: 0.5,
        rimLightIntensity: 0.8,
        keyLightColor: new THREE.Color(0x00d4aa),
        fillLightColor: new THREE.Color(0xf472b6),
        rimLightColor: new THREE.Color(0xffffff),
      };

    case 'trace':
      return {
        ...baseConfig,
        visualization: TraceVisualization,
        particleDensity: 0.5,
        particleColor: new THREE.Color(0x00d4aa),
        cameraPosition: [0, 1.5, 14],
        cameraTarget: [0, 0, 0],
        ambientIntensity: 0.3,
        keyLightIntensity: 1.5,
        fillLightIntensity: 0.4,
        rimLightIntensity: 1.0,
        keyLightColor: new THREE.Color(0x00d4aa),
        fillLightColor: new THREE.Color(0x00aaa0),
        rimLightColor: new THREE.Color(0x00ffea),
      };

    case 'forge':
      return {
        ...baseConfig,
        visualization: ForgeVisualization,
        particleDensity: 0.4,
        particleColor: new THREE.Color(0xf472b6),
        cameraPosition: [2, 1, 12],
        cameraTarget: [0, 0, 0],
        ambientIntensity: 0.35,
        keyLightIntensity: 1.3,
        fillLightIntensity: 0.6,
        rimLightIntensity: 0.9,
        keyLightColor: new THREE.Color(0xf472b6),
        fillLightColor: new THREE.Color(0xff9ec7),
        rimLightColor: new THREE.Color(0xffaaff),
      };

    case 'platform':
      return {
        ...baseConfig,
        visualization: PlatformVisualization,
        particleDensity: 0.35,
        particleColor: new THREE.Color(0x00d4aa),
        cameraPosition: [0, 0.5, 10],
        cameraTarget: [0, 0, 0],
        ambientIntensity: 0.4,
        keyLightIntensity: 1.2,
        fillLightIntensity: 0.5,
        rimLightIntensity: 0.8,
        keyLightColor: new THREE.Color(0x00d4aa),
        fillLightColor: new THREE.Color(0xf472b6),
        rimLightColor: new THREE.Color(0xffffff),
      };

    case 'architecture':
      return {
        ...baseConfig,
        visualization: PlatformVisualization,
        particleDensity: 0.25,
        cameraPosition: [0, 2, 15],
        cameraTarget: [0, 0, 0],
        ambientIntensity: 0.5,
        keyLightIntensity: 1.0,
        fillLightIntensity: 0.5,
        rimLightIntensity: 0.6,
        keyLightColor: new THREE.Color(0xffffff),
        fillLightColor: new THREE.Color(0x00d4aa),
        rimLightColor: new THREE.Color(0xf472b6),
      };

    case 'docs':
      return {
        ...baseConfig,
        visualization: TraceVisualization,
        particleDensity: 0.2,
        cameraPosition: [0, 0.5, 12],
        cameraTarget: [0, 0, 0],
        ambientIntensity: 0.5,
        keyLightIntensity: 0.8,
        fillLightIntensity: 0.4,
        rimLightIntensity: 0.5,
        keyLightColor: new THREE.Color(0x00d4aa),
        fillLightColor: new THREE.Color(0x00aaa0),
        rimLightColor: new THREE.Color(0x00ffea),
      };

    case 'demo':
      return {
        ...baseConfig,
        visualization: undefined,
        particleDensity: 0.15,
        cameraPosition: [0, 0, 12],
        cameraTarget: [0, 0, 0],
        ambientIntensity: 0.6,
        keyLightIntensity: 0.6,
        fillLightIntensity: 0.3,
        rimLightIntensity: 0.4,
        keyLightColor: new THREE.Color(0xf472b6),
        fillLightColor: new THREE.Color(0x00d4aa),
        rimLightColor: new THREE.Color(0xffffff),
      };

    default:
      return baseConfig;
  }
}

// Export types for scene config
export interface SceneConfig {
  visualization?: React.ComponentType<{ config: SceneConfig }>;
  particleDensity: number;
  particleColor: THREE.Color;
  envPreset: 'warehouse' | 'studio' | 'city' | 'forest' | 'apartment';
  envMap?: string[];
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  ambientIntensity: number;
  keyLightIntensity: number;
  fillLightIntensity: number;
  rimLightIntensity: number;
  keyLightColor: THREE.Color;
  fillLightColor: THREE.Color;
  rimLightColor: THREE.Color;
}