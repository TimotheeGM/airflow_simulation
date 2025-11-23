import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ShapeType, Point, SimulationParams } from '../types';
import { Play, Pause, RotateCcw, AlertTriangle, MousePointer2 } from 'lucide-react';

/**
 * LATTICE BOLTZMANN METHOD (D2Q9) CONSTANTS
 */
const Q = 9;
const ROWS = 100; // Simulation Grid Height (Y)
const COLS = 200; // Simulation Grid Width (X)
const SCALE = 4; // Visual scaling factor (Canvas pixels per Grid cell)

// D2Q9 Basis Vectors
const ex = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const ey = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const w = [
  4 / 9,
  1 / 9, 1 / 9, 1 / 9, 1 / 9,
  1 / 36, 1 / 36, 1 / 36, 1 / 36
];
const opp = [0, 3, 4, 1, 2, 7, 8, 5, 6];

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
  
  // Simulation Control State
  const [isPlaying, setIsPlaying] = useState(true);
  const [isUnstable, setIsUnstable] = useState(false);

  // Simulation State (Persistent across renders)
  const n0 = useRef(new Float32Array(ROWS * COLS * Q)); // Current Distribution
  const n1 = useRef(new Float32Array(ROWS * COLS * Q)); // Next Distribution
  const density = useRef(new Float32Array(ROWS * COLS));
  const ux = useRef(new Float32Array(ROWS * COLS));
  const uy = useRef(new Float32Array(ROWS * COLS));
  const barrier = useRef(new Uint8Array(ROWS * COLS)); // 1 = Solid, 0 = Fluid

  const tracers = useRef<Array<{x: number, y: number}>>([]);
  const activePolygon = useRef<Point[]>([]);
  const animationFrameId = useRef<number>(0);

  // Visualization Buffers (prevent GC thrashing)
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const imageDataRef = useRef<ImageData | null>(null);
  const buf8Ref = useRef<Uint8ClampedArray | null>(null);
  const data32Ref = useRef<Uint32Array | null>(null);

  // --- SHAPE GENERATION LOGIC ---
  const getShapePoints = useCallback((type: ShapeType, width: number, height: number): Point[] => {
    const cx = width / 2;
    const cy = height / 2;
    const points: Point[] = [];

    if (type === ShapeType.AIRFOIL) {
      // NACA 2412 (Cambered)
      const chord = width * 0.4;
      for (let i = 0; i <= 40; i++) {
        const beta = (i / 40) * Math.PI;
        const x = (0.5 * (1 - Math.cos(beta))) * chord;
        const xc = x / chord;
        const yt = 5 * 0.12 * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc ** 2 + 0.2843 * xc ** 3 - 0.1015 * xc ** 4);
        const m = 0.02; const p = 0.4;
        let yc = 0, dyc_dx = 0;
        if (xc < p) {
            yc = (m / (p * p)) * (2 * p * xc - xc * xc);
            dyc_dx = (2 * m / (p * p)) * (p - xc);
        } else {
            yc = (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * xc - xc * xc);
            dyc_dx = (2 * m / ((1 - p) * (1 - p))) * (p - xc);
        }
        const theta = Math.atan(dyc_dx);
        points.push({ x: cx - chord/2 + x - yt * Math.sin(theta), y: cy - (yc + yt * Math.cos(theta)) * chord });
      }
      for (let i = 40; i >= 0; i--) {
        const beta = (i / 40) * Math.PI;
        const x = (0.5 * (1 - Math.cos(beta))) * chord;
        const xc = x / chord;
        const yt = 5 * 0.12 * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc ** 2 + 0.2843 * xc ** 3 - 0.1015 * xc ** 4);
        const m = 0.02; const p = 0.4;
        let yc = 0, dyc_dx = 0;
        if (xc < p) {
            yc = (m / (p * p)) * (2 * p * xc - xc * xc);
            dyc_dx = (2 * m / (p * p)) * (p - xc);
        } else {
            yc = (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * xc - xc * xc);
            dyc_dx = (2 * m / ((1 - p) * (1 - p))) * (p - xc);
        }
        const theta = Math.atan(dyc_dx);
        points.push({ x: cx - chord/2 + x + yt * Math.sin(theta), y: cy - (yc - yt * Math.cos(theta)) * chord });
      }

    } else if (type === ShapeType.PARAGLIDER) {
        const span = width * 0.5;
        const thickness = 14; 
        const arch = 50;
        for(let i=0; i<=50; i++) {
            const t = i/50;
            const x = cx - span/2 + t*span;
            const yBase = cy + Math.sin(t * Math.PI) * -arch;
            points.push({x, y: yBase - thickness/2});
        }
        for(let i=50; i>=0; i--) {
            const t = i/50;
            const x = cx - span/2 + t*span;
            const yBase = cy + Math.sin(t * Math.PI) * -arch;
            points.push({x, y: yBase + thickness/2});
        }

    } else if (type === ShapeType.POD) {
        const len = width * 0.45;
        const h = len * 0.35;
        for (let i = 0; i < 360; i+=10) {
            const rad = i * Math.PI / 180;
            const xVal = Math.cos(rad); 
            const yVal = Math.sin(rad) * Math.pow(Math.sin(rad/2), 0.5);
            points.push({
                x: cx + xVal * (len/2),
                y: cy + yVal * (h) 
            });
        }
    } else if (type === ShapeType.CYLINDER) {
      const r = width * 0.08;
      for (let i = 0; i < 360; i += 15) {
        const rad = (i * Math.PI) / 180;
        points.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) });
      }
    } else if (type === ShapeType.PLATE) {
        const h = height * 0.4;
        const w = 10;
        points.push({x: cx - w/2, y: cy - h/2});
        points.push({x: cx + w/2, y: cy - h/2});
        points.push({x: cx + w/2, y: cy + h/2});
        points.push({x: cx - w/2, y: cy + h/2});
    }
    return points;
  }, []);

  // --- FLUID SIMULATION FUNCTIONS ---

  const initFluid = useCallback(() => {
    const size = ROWS * COLS * Q;
    for (let i = 0; i < size; i++) {
      const dir = i % Q;
      n0.current[i] = w[dir];
      n1.current[i] = w[dir];
    }
    barrier.current.fill(0);
    tracers.current = [];
    for(let i=0; i<1500; i++) {
        tracers.current.push({
            x: Math.random() * COLS,
            y: Math.random() * ROWS
        });
    }
    setIsUnstable(false);
  }, []);

  const rasterizePolygon = useCallback((polygon: Point[], gridWidth: number, gridHeight: number) => {
    barrier.current.fill(0);
    if (polygon.length < 3) return;

    let minX = gridWidth, maxX = 0, minY = gridHeight, maxY = 0;
    const gridPoly = polygon.map(p => ({ x: p.x / SCALE, y: p.y / SCALE }));

    gridPoly.forEach(p => {
        if(p.x < minX) minX = p.x;
        if(p.x > maxX) maxX = p.x;
        if(p.y < minY) minY = p.y;
        if(p.y > maxY) maxY = p.y;
    });

    minX = Math.max(0, Math.floor(minX));
    maxX = Math.min(gridWidth-1, Math.ceil(maxX));
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(gridHeight-1, Math.ceil(maxY));

    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            let inside = false;
            for (let i = 0, j = gridPoly.length - 1; i < gridPoly.length; j = i++) {
                const xi = gridPoly[i].x, yi = gridPoly[i].y;
                const xj = gridPoly[j].x, yj = gridPoly[j].y;
                const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            if (inside) {
                barrier.current[y * COLS + x] = 1;
            }
        }
    }
  }, []);

  const simulate = () => {
    const visc = 0.02;
    const omega = 1 / (3 * visc + 0.5);
    const u0 = Math.min(0.12, params.windSpeed * 0.002);

    // 1. COLLISION & STREAMING PREP
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const idx = y * COLS + x;
            
            if (barrier.current[idx]) continue;

            let d = 0, u_x = 0, u_y = 0;
            for (let i = 0; i < Q; i++) {
                const f = n0.current[idx * Q + i];
                d += f;
                u_x += f * ex[i];
                u_y += f * ey[i];
            }
            
            // Stability Clamp for Density
            if (d < 0.01) d = 0.01; 

            // Inlet (Left)
            if (x === 0) {
                u_x = u0; u_y = 0; d = 1;
                const u2 = u_x * u_x + u_y * u_y;
                for (let i = 0; i < Q; i++) {
                    const eu = ex[i] * u_x + ey[i] * u_y;
                    const eq = w[i] * d * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * u2);
                    n0.current[idx * Q + i] = eq;
                }
            } else {
                 u_x /= d;
                 u_y /= d;
                 
                 // Velocity Clamp (CRITICAL FOR STABILITY)
                 const maxU = 0.35;
                 if (u_x > maxU) u_x = maxU;
                 if (u_x < -maxU) u_x = -maxU;
                 if (u_y > maxU) u_y = maxU;
                 if (u_y < -maxU) u_y = -maxU;
            }

            density.current[idx] = d;
            ux.current[idx] = u_x;
            uy.current[idx] = u_y;

            // BGK Collision
            const u2 = u_x * u_x + u_y * u_y;
            for (let i = 0; i < Q; i++) {
                const eu = ex[i] * u_x + ey[i] * u_y;
                const eq = w[i] * d * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * u2);
                n0.current[idx * Q + i] += omega * (eq - n0.current[idx * Q + i]);
            }
        }
    }

    // 2. STREAMING
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const idx = y * COLS + x;
            if (barrier.current[idx]) continue;

            for (let i = 0; i < Q; i++) {
                const srcX = x - ex[i];
                const srcY = y - ey[i];

                if (srcX >= 0 && srcX < COLS && srcY >= 0 && srcY < ROWS) {
                    const srcIdx = srcY * COLS + srcX;
                    if (barrier.current[srcIdx]) {
                        n1.current[idx * Q + i] = n0.current[idx * Q + opp[i]];
                    } else {
                        n1.current[idx * Q + i] = n0.current[srcIdx * Q + i];
                    }
                } else if (srcY < 0 || srcY >= ROWS) {
                    const wrapY = (srcY + ROWS) % ROWS;
                    const srcIdx = wrapY * COLS + srcX;
                     if (srcX >= 0 && srcX < COLS)
                        n1.current[idx * Q + i] = n0.current[srcIdx * Q + i];
                } 
                else if (srcX < 0) {
                     n1.current[idx * Q + i] = w[i];
                }
            }
        }
    }
    
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
             if (barrier.current[y*COLS+x]) {
                 const idx = y * COLS + x;
                 for(let i=0; i<Q; i++) n1.current[idx*Q+i] = w[i];
             }
        }
    }

    const temp = n0.current;
    n0.current = n1.current;
    n1.current = temp;
  }

  // --- RENDER LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    
    canvas.width = COLS * SCALE;
    canvas.height = ROWS * SCALE;
    
    // Initialize Offscreen Canvas for Visualization
    if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
        offscreenCanvasRef.current.width = COLS;
        offscreenCanvasRef.current.height = ROWS;
        offscreenCtxRef.current = offscreenCanvasRef.current.getContext('2d');
        if (offscreenCtxRef.current) {
            imageDataRef.current = offscreenCtxRef.current.createImageData(COLS, ROWS);
            buf8Ref.current = imageDataRef.current.data;
            data32Ref.current = new Uint32Array(imageDataRef.current.data.buffer);
        }
    }

    // Initial fill
    if (tracers.current.length === 0) initFluid();

    const render = () => {
      // Run Physics only if playing, not drawing, and stable
      if (isPlaying && !isDrawing && !isUnstable) {
          // Reduced steps for better UI responsiveness and stability
          for(let i=0; i<4; i++) simulate();

          // Check for stability (NaN check)
          const testIdx = COLS * (ROWS/2) + 20;
          if (Number.isNaN(ux.current[testIdx]) || !isFinite(ux.current[testIdx])) {
              console.warn("Simulation Unstable - Pausing");
              setIsUnstable(true);
              setIsPlaying(false);
          }
      }

      // Visualization
      const data32 = data32Ref.current;
      if (!data32) return;

      // 0xAABBGGRR (Little Endian)
      for(let i=0; i<COLS*ROWS; i++) {
          if (barrier.current[i]) {
              data32[i] = 0xFF141414; // Dark Gray (Solid)
          } else {
              const vx = ux.current[i];
              const vy = uy.current[i];
              const v2 = vx*vx + vy*vy;
              // Limit speed for color map to avoid wrapping/glitches if unstable
              let speed = Math.sqrt(v2) * 15; 
              if (speed > 1.2) speed = 1.2;

              let r=0, g=0, b=0;
              
              if (speed < 0.25) { 
                  b = 255; 
                  g = (speed * 4 * 150) | 0; 
              } else if (speed < 0.5) { 
                  b = (255 * (1 - (speed-0.25)*4)) | 0;
                  g = (150 + (speed-0.25)*4 * 105) | 0;
              } else if (speed < 0.75) { 
                  g = 255;
                  r = ((speed-0.5)*4 * 255) | 0;
                  b = 0;
              } else { 
                  r = 255;
                  g = (255 * (1 - (speed-0.75)*4)) | 0;
                  b = 0;
              }
              
              data32[i] = (255 << 24) | (b << 16) | (g << 8) | r;
          }
      }

      if (offscreenCtxRef.current && imageDataRef.current) {
          offscreenCtxRef.current.putImageData(imageDataRef.current, 0, 0);
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(offscreenCanvasRef.current, 0, 0, canvas.width, canvas.height);
      }

      // Draw Streamlines
      if (!isUnstable) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          const speedScale = 1.0; 
          
          tracers.current.forEach(t => {
              const gx = Math.floor(t.x);
              const gy = Math.floor(t.y);
              if (gx >= 0 && gx < COLS-1 && gy >= 0 && gy < ROWS-1) {
                  const idx = gy * COLS + gx;
                  if (!barrier.current[idx]) {
                      t.x += ux.current[idx] * COLS * speedScale; 
                      t.y += uy.current[idx] * COLS * speedScale;
                      
                      const screenX = t.x * SCALE;
                      const screenY = t.y * SCALE;
                      ctx.fillRect(screenX, screenY, 2, 2);
                  }
              }
              // Reset tracers that go off screen or randomly
              if (t.x < 0 || t.x > COLS || t.y < 0 || t.y > ROWS || Math.random() < 0.005 || barrier.current[gy*COLS+gx]) {
                  t.x = 0;
                  t.y = Math.random() * ROWS;
              }
          });
      }
      
      // Draw Polygon Outline
      if (activePolygon.current.length > 0) {
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const p0 = activePolygon.current[0];
        ctx.moveTo(p0.x, p0.y);
        for(let i=1; i<activePolygon.current.length; i++) {
            ctx.lineTo(activePolygon.current[i].x, activePolygon.current[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId.current);
  }, [initFluid, params.windSpeed, isPlaying, isDrawing, isUnstable]);

  // --- INTERACTION ---
  useEffect(() => {
    // If shape changes, we should probably reset or at least pause briefly
    // But for smooth UX, let's just update the barrier. 
    // If Custom drawing, we pause explicitly in MouseDown.
    
    let polygon: Point[] = [];
    const w = COLS * SCALE;
    const h = ROWS * SCALE;

    if (shapeType === ShapeType.CUSTOM) {
        polygon = customPoints;
    } else {
        const rawPoints = getShapePoints(shapeType, w, h);
        const cx = w / 2;
        const cy = h / 2;
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

    activePolygon.current = polygon;
    rasterizePolygon(polygon, COLS, ROWS);
    
    if (!isDrawing && polygon.length > 2) {
        onShapeData(polygon);
    }

  }, [shapeType, params.angleOfAttack, getShapePoints, rasterizePolygon, customPoints, isDrawing, onShapeData]);


  const handleMouseDown = (e: React.MouseEvent) => {
    if (shapeType !== ShapeType.CUSTOM) return;
    setIsPlaying(false); // Pause while drawing
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
    // We leave it paused so user can decide when to run it
  };

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair overflow-hidden rounded-xl border border-slate-800 shadow-inner bg-slate-950">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="block w-full h-full object-cover" 
      />
      
      {/* HUD Overlays */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none">
          <div className="flex items-center gap-2">
            <div className="w-24 h-2 rounded-full bg-gradient-to-r from-blue-600 via-green-500 to-red-500 opacity-80 border border-slate-700"></div>
            <span className="text-[10px] text-white font-mono shadow-black drop-shadow-md">VELOCITY</span>
          </div>
      </div>
      
      {/* Control Bar */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-full border border-slate-700 backdrop-blur-md shadow-2xl z-20">
        <button 
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={isUnstable || isDrawing}
            className={`p-2 rounded-full transition-all ${isPlaying ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'} disabled:opacity-50`}
            title={isPlaying ? "Pause Simulation" : "Start Simulation"}
        >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
        </button>
        <div className="w-px h-6 bg-slate-700 mx-1"></div>
        <button 
            onClick={() => initFluid()}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
            title="Reset Simulation Fluid"
        >
            <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Unstable Alert */}
      {isUnstable && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-900/90 border border-red-500 text-white px-6 py-4 rounded-lg shadow-2xl text-center backdrop-blur-sm z-30">
            <div className="flex flex-col items-center gap-2">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <h3 className="font-bold text-lg">Simulation Unstable</h3>
                <p className="text-xs text-red-200 max-w-[200px]">Fluid velocity exceeded stability limits. Try reducing wind speed or smoothing shapes.</p>
                <button 
                    onClick={() => initFluid()}
                    className="mt-3 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-sm font-bold w-full transition-colors"
                >
                    RESET FLUID
                </button>
            </div>
        </div>
      )}

      {/* Custom Draw Hint */}
      {shapeType === ShapeType.CUSTOM && customPoints.length === 0 && !isDrawing && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-center">
            <MousePointer2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-lg font-mono">DRAW MODE</p>
            <p className="text-xs font-mono opacity-50">Click and drag to draw shape</p>
          </div>
      )}
    </div>
  );
};

export default WindTunnel;