import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ShapeType, Point, SimulationParams } from '../types';

interface WindTunnelProps {
  shapeType: ShapeType;
  params: SimulationParams;
  onShapeData: (points: Point[]) => void;
}

const WindTunnel: React.FC<WindTunnelProps> = ({ shapeType, params, onShapeData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [customPoints, setCustomPoints] = useState<Point[]>([]);
  
  // Track the currently active polygon for export
  const activePolygon = useRef<Point[]>([]);

  // Internal physics state for PARTICLES (Visual only)
  const particles = useRef<Array<{ x: number; y: number; vx: number; vy: number; age: number; life: number }>>([]);
  const animationFrameId = useRef<number>(0);

  // Generate standard shapes
  const getShapePoints = useCallback((type: ShapeType, width: number, height: number): Point[] => {
    const cx = width / 2;
    const cy = height / 2;
    const points: Point[] = [];

    if (type === ShapeType.AIRFOIL) {
      // NACA 0012 symmetric airfoil
      const chord = 240;
      // Upper surface
      for (let i = 0; i <= 40; i++) {
        const x = (i / 40) * chord;
        const xc = x / chord;
        const yt = 5 * 0.12 * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc ** 2 + 0.2843 * xc ** 3 - 0.1015 * xc ** 4);
        const y = yt * chord;
        points.push({ x: cx - chord / 2 + x, y: cy - y });
      }
      // Lower surface (back to front)
      for (let i = 40; i >= 0; i--) {
        const x = (i / 40) * chord;
        const xc = x / chord;
        const yt = 5 * 0.12 * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc ** 2 + 0.2843 * xc ** 3 - 0.1015 * xc ** 4);
        const y = -yt * chord;
        points.push({ x: cx - chord / 2 + x, y: cy - y });
      }
    } else if (type === ShapeType.CYLINDER) {
      const r = 70;
      for (let i = 0; i < 360; i += 10) {
        const rad = (i * Math.PI) / 180;
        points.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) });
      }
    } else if (type === ShapeType.PLATE) {
        const h = 160;
        const w = 12;
        points.push({x: cx - w/2, y: cy - h/2});
        points.push({x: cx + w/2, y: cy - h/2});
        points.push({x: cx + w/2, y: cy + h/2});
        points.push({x: cx - w/2, y: cy + h/2});
    }
    return points;
  }, []);

  const initParticles = useCallback((count: number, width: number, height: number) => {
    particles.current = [];
    for (let i = 0; i < count; i++) {
      particles.current.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        age: Math.random() * 100,
        life: 50 + Math.random() * 100
      });
    }
  }, []);

  const isInside = (p: Point, polygon: Point[]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const distToSegment = (p: Point, v: Point, w: Point) => {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = containerRef.current;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        initParticles(params.particleCount, canvas.width, canvas.height);
      }
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const render = () => {
      ctx.fillStyle = '#020617'; // slate-950
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const gridSize = 50;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Prepare Polygon
      let polygon: Point[] = [];
      if (shapeType === ShapeType.CUSTOM) {
        polygon = customPoints;
      } else {
        const rawPoints = getShapePoints(shapeType, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const rad = (params.angleOfAttack * Math.PI) / 180;
        polygon = rawPoints.map(p => {
          const dx = p.x - cx;
          const dy = p.y - cy;
          return {
            x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
            y: cy + dx * Math.sin(rad) + dy * Math.cos(rad)
          };
        });
      }
      
      // Update Ref for Parent
      activePolygon.current = polygon;
      // We don't call onShapeData here to avoid infinite loops, we call it on change events/init

      // Particles
      const speed = params.windSpeed * 0.8;
      ctx.lineWidth = 2;

      particles.current.forEach(p => {
        if (p.x > canvas.width || p.age > p.life) {
          p.x = 0;
          p.y = Math.random() * canvas.height;
          p.vx = speed;
          p.vy = 0;
          p.age = 0;
          if (polygon.length > 2 && isInside(p, polygon)) {
            p.y = Math.random() * canvas.height; // simple respawn
          }
        }

        let dx = speed;
        let dy = 0;

        // Interaction
        if (polygon.length > 2) {
            let cx = 0, cy = 0;
            polygon.forEach(pt => { cx += pt.x; cy += pt.y });
            cx /= polygon.length;
            cy /= polygon.length;

            const distToCenter = Math.hypot(p.x - cx, p.y - cy);
            if (distToCenter < 400) {
                let minDist = Infinity;
                for (let i = 0; i < polygon.length; i++) {
                    const p1 = polygon[i];
                    const p2 = polygon[(i + 1) % polygon.length];
                    const d = distToSegment(p, p1, p2);
                    if (d < minDist) minDist = d;
                }

                if (minDist < 80) {
                    const influence = (1 - minDist / 80);
                    const dirX = p.x - cx;
                    const dirY = p.y - cy;
                    const len = Math.hypot(dirX, dirY);
                    dx += (dirX / len) * influence * speed * 2.5;
                    dy += (dirY / len) * influence * speed * 2.5;
                    dx += influence * speed * 0.8; 
                }
                
                // Turbulent Wake visual
                if (p.x > cx && Math.abs(p.y - cy) < 60) {
                     const turb = (Math.abs(params.angleOfAttack) / 30) * 4;
                     dy += (Math.random() - 0.5) * turb * speed;
                }
            }
        }

        p.vx += (dx - p.vx) * 0.15;
        p.vy += (dy - p.vy) * 0.15;
        p.x += p.vx;
        p.y += p.vy;
        p.age++;

        const vel = Math.hypot(p.vx, p.vy);
        const normVel = Math.min(1.2, vel / speed);
        
        // Gradient color based on velocity (Scientific rainbow map: Blue=Slow, Red=Fast)
        const hue = 240 - (normVel * 240); 
        ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.6)`;
        
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 2, p.y - p.vy * 2);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      });

      // Draw Shape
      if (polygon.length > 0) {
        ctx.fillStyle = '#334155'; // slate-700
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(polygon[0].x, polygon[0].y);
        for (let i = 1; i < polygon.length; i++) {
          ctx.lineTo(polygon[i].x, polygon[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (shapeType === ShapeType.CUSTOM && isDrawing) {
           ctx.fillStyle = '#ef4444';
           polygon.forEach(p => {
               ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
           });
        }
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [shapeType, params, customPoints, isDrawing, getShapePoints, initParticles]);

  // Export shape data whenever relevant props change
  useEffect(() => {
     if (!isDrawing && activePolygon.current.length > 2) {
         onShapeData(activePolygon.current);
     }
  }, [shapeType, params, isDrawing, customPoints, onShapeData]);


  const handleMouseDown = (e: React.MouseEvent) => {
    if (shapeType !== ShapeType.CUSTOM) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setIsDrawing(true);
    setCustomPoints([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || shapeType !== ShapeType.CUSTOM) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCustomPoints(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top }]);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair overflow-hidden rounded-xl border border-slate-800 shadow-inner bg-slate-950">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="block"
      />
      {shapeType === ShapeType.CUSTOM && customPoints.length === 0 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-center">
            <p className="text-lg font-mono">DRAW MODE</p>
            <p className="text-xs font-mono opacity-50">Create closed loop geometry</p>
          </div>
      )}
    </div>
  );
};

export default WindTunnel;
