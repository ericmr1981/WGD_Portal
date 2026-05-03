import { useEffect, useState } from 'react'

export default function GlowBackground() {
  const [orbs, setOrbs] = useState([])

  useEffect(() => {
    setOrbs([
      { top: '10%', left: '80%', size: 400, color: 'rgba(0, 212, 255, 0.08)', delay: 0 },
      { top: '60%', left: '10%', size: 300, color: 'rgba(124, 58, 237, 0.06)', delay: 2.5 },
      { top: '70%', left: '75%', size: 250, color: 'rgba(0, 212, 255, 0.05)', delay: 5 },
    ])
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {orbs.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            top: orb.top,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
            animation: `float 8s ease-in-out ${orb.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
