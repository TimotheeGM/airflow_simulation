import React, { useState, useRef } from 'react';
import WindTunnel from './components/WindTunnel';
import AnalysisPanel from './components/AnalysisPanel';
import { ShapeType, SimulationParams, AnalysisResult, Point } from './types';
import { explainSimulation } from './services/geminiService';
import { calculatePhysics } from './services/physics';
import { Settings, Info, PenTool, Box, Circle, Triangle, cpu } from 'lucide-react';

const App: React.FC = () => {
  const [shapeType, setShapeType] = useState<ShapeType>(ShapeType.AIRFOIL);
  const [params, setParams] = useState<SimulationParams>({
    windSpeed: 45,
    angleOfAttack: 5,
    viscosity: 1,
    particleCount: 1200
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [currentShapePoints, setCurrentShapePoints] = useState<Point[]>([]);

  const handleAnalyze = async () => {
    if (currentShapePoints.length < 3) return;
    
    setIsAnalyzing(true);
    try {
      // 1. Run Scientific Physics Engine (Local Math)
      const physicsData = calculatePhysics(
        currentShapePoints, 
        params.windSpeed, 
        params.angleOfAttack
      );

      // 2. Run AI Consultant (Explanation of Data)
      // We pass the calculated data, not an image guess
      const expertExplanation = await explainSimulation(
          physicsData, 
          shapeType, 
          params.angleOfAttack
      );

      // 3. Merge Results
      setAnalysisResult({
        ...physicsData,
        ...expertExplanation
      });

    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-black text-slate-100 overflow-hidden font-sans selection:bg-sky-500/30">
      
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-sky-600/20 border border-sky-500/30 p-1.5 rounded-md">
            <Settings className="w-5 h-5 text-sky-400" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">
            AeroSim <span className="text-sky-500">Pro</span>
          </h1>
        </div>
        
        <div className="flex gap-4 items-center">
            <div className="bg-slate-900 px-3 py-1 rounded text-[10px] font-mono text-slate-400 border border-slate-800 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                PHYSICS ENGINE: ONLINE
            </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Toolbar */}
        <aside className="w-72 bg-slate-950 border-r border-slate-800 p-5 flex flex-col gap-8 overflow-y-auto shrink-0 z-10">
          
          {/* Shape Selection */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Test Subject</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setShapeType(ShapeType.AIRFOIL); setAnalysisResult(null); }}
                className={`p-3 rounded border flex flex-col items-center gap-2 transition-all ${
                  shapeType === ShapeType.AIRFOIL ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="w-full h-6 border border-current rounded-[100%] transform skew-x-12" />
                <span className="text-[10px] font-mono">NACA 0012</span>
              </button>
              
              <button
                onClick={() => { setShapeType(ShapeType.CYLINDER); setAnalysisResult(null); }}
                className={`p-3 rounded border flex flex-col items-center gap-2 transition-all ${
                  shapeType === ShapeType.CYLINDER ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <Circle className="w-5 h-5" />
                <span className="text-[10px] font-mono">CYLINDER</span>
              </button>

              <button
                onClick={() => { setShapeType(ShapeType.PLATE); setAnalysisResult(null); }}
                className={`p-3 rounded border flex flex-col items-center gap-2 transition-all ${
                  shapeType === ShapeType.PLATE ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                 <div className="w-0.5 h-6 bg-current" />
                <span className="text-[10px] font-mono">FLAT PLATE</span>
              </button>

              <button
                onClick={() => { setShapeType(ShapeType.CUSTOM); setAnalysisResult(null); }}
                className={`p-3 rounded border flex flex-col items-center gap-2 transition-all ${
                  shapeType === ShapeType.CUSTOM ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <PenTool className="w-5 h-5" />
                <span className="text-[10px] font-mono">CUSTOM</span>
              </button>
            </div>
          </section>

          {/* Physics Parameters */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Environment</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">VELOCITY (V_inf)</span>
                <span className="text-sky-400">{params.windSpeed} m/s</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                value={params.windSpeed}
                onChange={(e) => setParams({ ...params, windSpeed: parseInt(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">ANGLE OF ATTACK (α)</span>
                <span className="text-sky-400">{params.angleOfAttack}°</span>
              </div>
              <input
                type="range"
                min="-25"
                max="25"
                value={params.angleOfAttack}
                onChange={(e) => setParams({ ...params, angleOfAttack: parseInt(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">TRACER DENSITY</span>
                <span className="text-sky-400">{params.particleCount}</span>
              </div>
              <input
                type="range"
                min="500"
                max="3000"
                step="100"
                value={params.particleCount}
                onChange={(e) => setParams({ ...params, particleCount: parseInt(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>
          </section>

          {/* Info Box */}
          <div className="mt-auto bg-slate-900 p-3 rounded border border-slate-800 text-[10px] text-slate-500 leading-relaxed font-mono">
            <div className="flex items-center gap-2 mb-2 text-slate-300">
                <Info className="w-3 h-3" />
                <span>SIMULATION KERNEL</span>
            </div>
            Running Vortex Panel Method solver (Inviscid Potential Flow) with Boundary Layer drag approximations.
          </div>

        </aside>

        {/* Center: Visualization */}
        <main className="flex-1 p-4 flex flex-col min-w-0 bg-[#020617] relative">
            {/* Overlay Grid Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
            
            <WindTunnel 
                shapeType={shapeType} 
                params={params}
                onShapeData={setCurrentShapePoints}
            />
        </main>

        {/* Right: Analysis */}
        <AnalysisPanel 
            loading={isAnalyzing} 
            result={analysisResult} 
            onAnalyze={handleAnalyze} 
        />

      </div>
    </div>
  );
};

export default App;
