'use client'

import P5 from 'p5'
import { useEffect, useRef } from 'react'
import type p5 from 'p5'
import { useTheme } from '../shell/ThemeProvider'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
}

export function P5Sketch() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let instance: p5 | null = null
    let particles: Particle[] = []
    const particleCount = 60

    const sketch = (p: p5) => {
      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight)
        p.pixelDensity(Math.min(window.devicePixelRatio, 2))
        p.clear()
        particles = Array.from({ length: particleCount }, () => ({
          x: p.random(p.width),
          y: p.random(p.height),
          vx: p.random(-0.3, 0.3),
          vy: p.random(-0.3, 0.3),
          size: p.random(2, 5),
          color: p.random() > 0.5 ? theme.canvas.particle : theme.canvas.particleAlt,
        }))
      }

        p.draw = () => {
        p.clear()
        p.noStroke()

        for (const particle of particles) {
          particle.x += particle.vx
          particle.y += particle.vy

          if (particle.x < 0 || particle.x > p.width) particle.vx *= -1
          if (particle.y < 0 || particle.y > p.height) particle.vy *= -1

          const col = p.color(particle.color)
          col.setAlpha(90)
          p.fill(col)
          p.circle(particle.x, particle.y, particle.size)
        }

        // subtle connections
        p.strokeWeight(1.15)
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const a = particles[i]
            const b = particles[j]
            const d = p.dist(a.x, a.y, b.x, b.y)
            if (d < 130) {
              const lineCol = p.color(theme.colors.accent)
              lineCol.setAlpha(p.map(d, 0, 130, 52, 0))
              p.stroke(lineCol)
              p.line(a.x, a.y, b.x, b.y)
            }
          }
        }
      }

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight)
      }
    }

    instance = new P5(sketch, container)

    return () => {
      instance?.remove()
    }
  }, [theme])

  return <div ref={containerRef} className="fixed inset-0 -z-10" aria-hidden />
}
