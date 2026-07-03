'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import type { Group, Mesh } from 'three'

interface GlyphMeshProps {
  moduleId: string
  primary: string
  glow: string
}

function GlyphMesh({ moduleId, primary, glow }: GlyphMeshProps) {
  const meshRef = useRef<Mesh>(null)
  const groupRef = useRef<Group>(null)

  useFrame((state) => {
    const target = groupRef.current ?? meshRef.current
    if (!target) return
    const t = state.clock.elapsedTime
    target.rotation.y = t * 0.45
    target.rotation.x = Math.sin(t * 0.35) * 0.2
  })

  const emissive = glow
  const color = primary

  switch (moduleId) {
    case 'transcription':
      return (
        <mesh ref={meshRef}>
          <torusKnotGeometry args={[0.42, 0.11, 96, 12]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.55} metalness={0.6} roughness={0.25} />
        </mesh>
      )
    case 'doc-editor':
      return (
        <mesh ref={meshRef} rotation={[0.4, 0.5, 0]}>
          <boxGeometry args={[0.7, 0.9, 0.06]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.4} metalness={0.3} roughness={0.4} />
        </mesh>
      )
    case 'job-agent':
      return (
        <group ref={groupRef}>
          <mesh ref={meshRef} position={[0, 0.05, 0]}>
            <boxGeometry args={[0.75, 0.5, 0.35]} />
            <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.45} metalness={0.5} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <boxGeometry args={[0.75, 0.08, 0.35]} />
            <meshStandardMaterial color={glow} emissive={emissive} emissiveIntensity={0.6} metalness={0.4} roughness={0.2} />
          </mesh>
        </group>
      )
    case 'calendar':
      return (
        <mesh ref={meshRef}>
          <torusGeometry args={[0.45, 0.08, 32, 48]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.5} metalness={0.55} roughness={0.28} />
        </mesh>
      )
    case 'voice-assistant':
      return (
        <mesh ref={meshRef}>
          <icosahedronGeometry args={[0.5, 1]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.65} metalness={0.35} roughness={0.2} wireframe />
        </mesh>
      )
    case 'newsletter':
      return (
        <group ref={groupRef}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, i * 0.14 - 0.14, i * 0.05]}>
              <boxGeometry args={[0.65, 0.1, 0.45]} />
              <meshStandardMaterial color={i === 1 ? glow : color} emissive={emissive} emissiveIntensity={0.35 + i * 0.1} metalness={0.4} roughness={0.35} />
            </mesh>
          ))}
        </group>
      )
    case 'culture-tracker':
      return (
        <mesh ref={meshRef}>
          <octahedronGeometry args={[0.52, 0]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.5} metalness={0.45} roughness={0.3} />
        </mesh>
      )
    case 'travel-scout':
      return (
        <mesh ref={meshRef}>
          <torusKnotGeometry args={[0.38, 0.12, 64, 12]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.45} metalness={0.5} roughness={0.25} />
        </mesh>
      )
    case 'language-tutor':
      return (
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.48, 32, 32]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.45} metalness={0.5} roughness={0.25} wireframe />
        </mesh>
      )
    default:
      return (
        <mesh ref={meshRef}>
          <dodecahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.4} metalness={0.4} roughness={0.35} />
        </mesh>
      )
  }
}

interface ModuleGlyphCanvasProps {
  moduleId: string
  size: number
  primary: string
  glow: string
}

export default function ModuleGlyphCanvas({ moduleId, size, primary, glow }: ModuleGlyphCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.2], fov: 42 }}
      style={{ width: size, height: size }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.35} />
      <pointLight position={[2, 2, 2]} intensity={1.2} color={glow} />
      <pointLight position={[-2, -1, 1]} intensity={0.5} color={primary} />
      <Float speed={1.8} rotationIntensity={0.35} floatIntensity={0.4}>
        <GlyphMesh moduleId={moduleId} primary={primary} glow={glow} />
      </Float>
    </Canvas>
  )
}
