import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SceneConfig } from './StriaScene';

interface SceneLightingProps {
  config: SceneConfig;
}

export function SceneLighting({ config }: SceneLightingProps) {
  const lights = useMemo(() => {
    const ambient = new THREE.AmbientLight(0xffffff, config.ambientIntensity);

    const keyLight = new THREE.DirectionalLight(config.keyLightColor, config.keyLightIntensity);
    keyLight.position.set(5, 10, 7);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -15;
    keyLight.shadow.camera.right = 15;
    keyLight.shadow.camera.top = 15;
    keyLight.shadow.camera.bottom = -15;
    keyLight.shadow.bias = -0.0001;

    const fillLight = new THREE.DirectionalLight(config.fillLightColor, config.fillLightIntensity);
    fillLight.position.set(-8, 5, -5);

    const rimLight = new THREE.DirectionalLight(config.rimLightColor, config.rimLightIntensity);
    rimLight.position.set(0, -8, -10);

    // Point lights for accent highlights
    const accentLight1 = new THREE.PointLight(config.keyLightColor, 0.8, 20);
    accentLight1.position.set(-6, 3, 4);

    const accentLight2 = new THREE.PointLight(config.fillLightColor, 0.6, 15);
    accentLight2.position.set(6, -2, 4);

    return { ambient, keyLight, fillLight, rimLight, accentLight1, accentLight2 };
  }, [config]);

  // Subtle light animation
  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    lights.keyLight.position.x = 5 + Math.sin(time * 0.3) * 2;
    lights.keyLight.position.z = 7 + Math.cos(time * 0.2) * 1.5;
    lights.accentLight1.intensity = 0.8 + Math.sin(time * 1.5) * 0.2;
    lights.accentLight2.intensity = 0.6 + Math.cos(time * 1.2) * 0.15;
  });

  return (
    <>
      <ambientLight {...lights.ambient} />
      <directionalLight {...lights.keyLight} />
      <directionalLight {...lights.fillLight} />
      <directionalLight {...lights.rimLight} />
      <pointLight {...lights.accentLight1} />
      <pointLight {...lights.accentLight2} />
    </>
  );
}