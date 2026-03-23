'use client'

import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

interface Props {
  traineeName: string
  courseTitle: string
  onContinue: () => void
}

export function CourseCelebrationScreen({ traineeName, courseTitle, onContinue }: Props) {
  const hasFiredRef = useRef(false)

  useEffect(() => {
    if (hasFiredRef.current) return
    hasFiredRef.current = true

    const colours = ['#C9A96E', '#FAF8F4', '#ffffff', '#8B6355', '#7B6B9A', '#6B8C6B', '#9A6B70']

    // Grand multi-burst confetti sequence
    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        origin: { y: 0.5 },
        colors: colours,
        ...opts,
        particleCount: Math.floor(400 * particleRatio),
      })
    }

    // First burst — wide and tall
    fire(0.3, { spread: 160, startVelocity: 65, scalar: 1.2 })
    fire(0.25, { spread: 100, startVelocity: 55 })
    fire(0.2, { spread: 80, decay: 0.91, scalar: 0.9 })

    // Second burst after short delay
    setTimeout(() => {
      fire(0.3, { spread: 140, startVelocity: 60, origin: { x: 0.3, y: 0.5 } } as confetti.Options)
      fire(0.3, { spread: 140, startVelocity: 60, origin: { x: 0.7, y: 0.5 } } as confetti.Options)
    }, 400)

    // Third burst — gentle rain
    setTimeout(() => {
      fire(0.15, { spread: 180, startVelocity: 30, decay: 0.95, scalar: 1.5, origin: { x: 0.5, y: 0.2 } } as confetti.Options)
    }, 800)

    // Fourth burst — finale
    setTimeout(() => {
      fire(0.2, { spread: 200, startVelocity: 50, scalar: 1.1 })
      fire(0.15, { spread: 120, startVelocity: 70, decay: 0.88 })
    }, 1200)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #1C1C1C 0%, #0a0a0a 100%)' }}
    >
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #C9A96E 0%, transparent 70%)' }}
        />
      </div>

      {/* Animated gem */}
      <div className="relative mb-8">
        <div className="text-7xl animate-pulse" style={{ animationDuration: '2s' }}>💎</div>
        <div className="absolute -inset-4 rounded-full animate-ping opacity-10" style={{ backgroundColor: '#C9A96E', animationDuration: '3s' }} />
      </div>

      {/* Course complete headline */}
      <p className="text-gold/60 text-sm tracking-[0.3em] uppercase mb-4 animate-fade-in">Course Complete</p>

      <h1 className="font-serif text-5xl md:text-6xl text-gold mb-4 leading-tight animate-fade-in"
        style={{ animationDelay: '0.2s', textShadow: '0 0 40px rgba(201,169,110,0.3)' }}
      >
        Magnificent.
      </h1>

      {/* Trainee name */}
      <p className="text-white/50 text-lg mb-2">{traineeName}</p>

      {/* Course name */}
      <p className="text-white font-serif text-2xl mb-12 max-w-md leading-snug">
        {courseTitle}
      </p>

      {/* Gold divider */}
      <div className="flex items-center gap-3 mb-12">
        <div className="w-12 h-px bg-gold/30" />
        <div className="w-2 h-2 rounded-full bg-gold/50" />
        <div className="w-12 h-px bg-gold/30" />
      </div>

      <button
        onClick={onContinue}
        className="border-2 border-gold/50 text-gold px-10 py-4 rounded-xl hover:bg-gold/10 hover:border-gold transition-all text-sm tracking-[0.2em] uppercase font-medium"
      >
        Continue
      </button>
    </div>
  )
}
