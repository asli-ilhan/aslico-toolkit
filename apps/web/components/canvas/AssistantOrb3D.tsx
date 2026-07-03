'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Float, MeshDistortMaterial } from '@react-three/drei'
import { useTheme } from '../shell/ThemeProvider'

function Orb() {
  const { theme } = useTheme()
  return (
    <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
      <mesh scale={1.2}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color={theme.colors.accent}
          emissive={theme.colors.glow}
          emissiveIntensity={0.3}
          distort={0.35}
          speed={2}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
    </Float>
  )
}

export function AssistantOrb3D() {
  const { reducedMotion } = useTheme()

  if (reducedMotion) {
    return (
      <div
        className="h-14 w-14 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 30%, var(--glow), var(--accent))`,
          boxShadow: '0 0 32px var(--accent-soft)',
        }}
      />
    )
  }

  return (
    <div className="h-14 w-14">
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }} gl={{ alpha: true }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[2, 2, 2]} intensity={1} color="#fff" />
        <Suspense fallback={null}>
          <Orb />
        </Suspense>
      </Canvas>
    </div>
  )
}
