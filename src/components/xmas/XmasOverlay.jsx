import React, { useEffect, useRef } from 'react';

export default function XmasOverlay({ active }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    santa: {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      state: 'delivering', // delivering, local_delivery, combat
      pathHistory: [],
      cityIndex: 0,
      localTimer: 0,
      speed: 0.05
    },
    enemies: [], // {x, y, vx, vy, hp, type}
    missiles: [], // {x, y, vx, vy, owner: 'santa'|'enemy'}
    combatTimer: 0,
    mode: 'normal', // normal, combat
    lastFrame: 0
  });

  // More detailed World Map Data (Normalized 0-1)
  const CONTINENTS = [
    // North America
    [[0.08, 0.08], [0.15, 0.04], [0.25, 0.04], [0.35, 0.06], [0.42, 0.04], [0.45, 0.15], [0.38, 0.20], [0.32, 0.25], [0.28, 0.35], [0.25, 0.45], [0.22, 0.42], [0.18, 0.35], [0.12, 0.30], [0.08, 0.25], [0.05, 0.15]],
    // South America
    [[0.26, 0.48], [0.32, 0.46], [0.38, 0.50], [0.42, 0.55], [0.38, 0.65], [0.35, 0.80], [0.32, 0.88], [0.28, 0.85], [0.25, 0.70], [0.22, 0.60], [0.24, 0.52]],
    // Europe
    [[0.45, 0.15], [0.50, 0.10], [0.55, 0.08], [0.58, 0.12], [0.55, 0.20], [0.52, 0.25], [0.48, 0.22], [0.46, 0.25], [0.44, 0.20]],
    // Africa
    [[0.44, 0.30], [0.50, 0.28], [0.55, 0.30], [0.58, 0.35], [0.60, 0.45], [0.58, 0.55], [0.55, 0.65], [0.50, 0.75], [0.45, 0.65], [0.42, 0.55], [0.40, 0.40]],
    // Asia
    [[0.58, 0.12], [0.65, 0.08], [0.75, 0.06], [0.85, 0.08], [0.92, 0.10], [0.95, 0.20], [0.90, 0.35], [0.85, 0.45], [0.78, 0.50], [0.70, 0.45], [0.65, 0.40], [0.60, 0.30]],
    // Australia
    [[0.75, 0.65], [0.82, 0.62], [0.88, 0.65], [0.90, 0.75], [0.85, 0.82], [0.78, 0.80], [0.74, 0.72]],
    // Antarctica
    [[0.10, 0.92], [0.30, 0.90], [0.50, 0.92], [0.70, 0.90], [0.90, 0.92], [0.80, 0.96], [0.50, 0.98], [0.20, 0.96]]
  ];

  const CITIES = [
    { name: "North Pole", x: 0.5, y: 0.05 },
    { name: "New York", x: 0.26, y: 0.28 },
    { name: "London", x: 0.48, y: 0.22 },
    { name: "Moscow", x: 0.60, y: 0.18 },
    { name: "Tokyo", x: 0.88, y: 0.30 },
    { name: "Sydney", x: 0.90, y: 0.75 },
    { name: "Rio", x: 0.35, y: 0.70 },
    { name: "Cape Town", x: 0.55, y: 0.80 }
  ];

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Initialize Santa
    const startCity = CITIES[0];
    stateRef.current.santa.x = startCity.x * window.innerWidth;
    stateRef.current.santa.y = startCity.y * window.innerHeight;
    stateRef.current.santa.cityIndex = 0;
    stateRef.current.lastFrame = Date.now();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const handleKeyDown = (e) => {
      if (e.key === '9' && stateRef.current.mode !== 'combat') {
        startCombatMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const startCombatMode = () => {
      const state = stateRef.current;
      state.mode = 'combat';
      state.combatTimer = Date.now();
      
      // Spawn enemies relative to Santa
      const sx = state.santa.x;
      const sy = state.santa.y;
      
      state.enemies = [
        { x: sx - 100, y: sy - 100, vx: 2, vy: 2, hp: 1 },
        { x: sx + 100, y: sy - 100, vx: -2, vy: 2, hp: 1 },
        { x: sx, y: sy + 150, vx: 0, vy: -2, hp: 1 }
      ];
    };

    const updateSanta = (dt) => {
      const state = stateRef.current;
      const santa = state.santa;
      const w = canvas.width;
      const h = canvas.height;

      // Movement logic based on mode
      if (state.mode === 'combat') {
        const elapsed = Date.now() - state.combatTimer;
        
        // Combat Script
        if (elapsed < 30000) {
          // 0-5s: Evasive maneuvers
          if (elapsed < 5000) {
             santa.x += Math.sin(elapsed * 0.01) * 3;
             santa.y += Math.cos(elapsed * 0.01) * 3;
          } 
          // 5-15s: Avoid missiles
          else if (elapsed < 15000) {
             if (elapsed % 2000 < 50) { // Enemies fire
                state.enemies.forEach(e => {
                   state.missiles.push({
                     x: e.x, y: e.y, 
                     vx: (santa.x - e.x) * 0.005, 
                     vy: (santa.y - e.y) * 0.005,
                     owner: 'enemy'
                   });
                });
             }
             santa.x += Math.sin(elapsed * 0.005) * 5;
          } 
          // 15-25s: Counter attack
          else if (elapsed < 25000) {
             // Fly behind enemies
             const target = state.enemies[0] || {x: w/2, y: h/2};
             santa.x += (target.x - santa.x + 100) * 0.05;
             santa.y += (target.y - santa.y + 100) * 0.05;
             
             if (elapsed % 500 < 50) { // Santa fires
                state.missiles.push({
                   x: santa.x, y: santa.y,
                   vx: (target.x - santa.x) * 0.02,
                   vy: (target.y - santa.y) * 0.02,
                   owner: 'santa'
                });
             }
          }
        } else {
          state.mode = 'normal';
          state.enemies = [];
          state.missiles = [];
        }
      } else {
        // Normal Delivery Logic
        const targetCity = CITIES[santa.cityIndex];
        const tx = targetCity.x * w;
        const ty = targetCity.y * h;
        
        if (santa.state === 'delivering') {
           const dx = tx - santa.x;
           const dy = ty - santa.y;
           const dist = Math.sqrt(dx*dx + dy*dy);
           
           // Very slow movement for "2 hour stream" feel
           // Speed factor needs to be tiny
           const speed = 0.002; 
           
           if (dist < 5) {
             santa.state = 'local_delivery';
             santa.localTimer = Date.now();
           } else {
             santa.x += (dx / dist) * speed;
             santa.y += (dy / dist) * speed;
           }
        } else if (santa.state === 'local_delivery') {
           // Dart around
           const elapsed = Date.now() - santa.localTimer;
           if (elapsed > 10000) { // 10 seconds at a city
              santa.state = 'delivering';
              santa.cityIndex = (santa.cityIndex + 1) % CITIES.length;
           } else {
              santa.x = tx + Math.sin(elapsed * 0.01) * 50;
              santa.y = ty + Math.cos(elapsed * 0.013) * 30;
           }
        }
      }
      
      // Update Path History
      if (Math.random() < 0.05) { // Don't add every frame
         santa.pathHistory.push({x: santa.x, y: santa.y});
         if (santa.pathHistory.length > 500) santa.pathHistory.shift();
      }
    };

    const updateCombatObjects = () => {
       const state = stateRef.current;
       
       // Update Enemies
       if (state.mode === 'combat') {
         const elapsed = Date.now() - state.combatTimer;
         state.enemies.forEach(e => {
            if (elapsed < 5000) { // Approach
               e.x += (state.santa.x - e.x) * 0.01;
               e.y += (state.santa.y - e.y) * 0.01;
            }
         });
       }
       
       // Update Missiles
       state.missiles.forEach((m, i) => {
          m.x += m.vx * 5;
          m.y += m.vy * 5;
          
          // Collision logic simplified
          if (m.owner === 'santa') {
             state.enemies.forEach((e, ei) => {
                const dist = Math.hypot(e.x - m.x, e.y - m.y);
                if (dist < 20) {
                   state.enemies.splice(ei, 1);
                   state.missiles.splice(i, 1);
                }
             });
          }
       });
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // 1. Draw Map
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      CONTINENTS.forEach(cont => {
        ctx.beginPath();
        cont.forEach((p, i) => {
          const px = p[0] * w;
          const py = p[1] * h;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.stroke();
      });

      // 2. Draw Cities
      ctx.fillStyle = 'white';
      ctx.font = '12px monospace';
      CITIES.forEach(city => {
         const cx = city.x * w;
         const cy = city.y * h;
         ctx.beginPath();
         ctx.arc(cx, cy, 3, 0, Math.PI * 2);
         ctx.fill();
         ctx.fillText(city.name, cx + 8, cy + 4);
      });

      const state = stateRef.current;
      const santa = state.santa;

      // 3. Draw Santa Path
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      santa.pathHistory.forEach((p, i) => {
         if (i === 0) ctx.moveTo(p.x, p.y);
         else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. Draw Santa
      ctx.fillStyle = 'red';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'red';
      ctx.beginPath();
      ctx.arc(santa.x, santa.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px monospace';
      ctx.fillText("SANTA", santa.x + 10, santa.y);
      ctx.shadowBlur = 0;

      // 5. Draw Combat Objects
      if (state.mode === 'combat') {
         // Enemies
         ctx.fillStyle = '#00ffff';
         state.enemies.forEach(e => {
            ctx.beginPath();
            ctx.arc(e.x, e.y, 8, 0, Math.PI * 2);
            ctx.fill();
         });

         // Missiles
         state.missiles.forEach(m => {
            ctx.fillStyle = m.owner === 'santa' ? 'red' : '#00ffff';
            ctx.beginPath();
            ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
            ctx.fill();
         });
      }
    };

    const animate = () => {
      const now = Date.now();
      const dt = now - stateRef.current.lastFrame;
      
      updateSanta(dt);
      updateCombatObjects();
      draw();
      
      stateRef.current.lastFrame = now;
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-20"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}