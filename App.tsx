import React, { useState, useRef } from 'react';
import WindTunnel from './components/WindTunnel';
import AnalysisPanel from './components/AnalysisPanel';
import { ShapeType, SimulationParams, AnalysisResult, Point } from './types';
import { explainSimulation } from './services/geminiService';
import { calculatePhysics } from './services/physics';
import { Settings, Info, PenTool, Box, Circle, Triangle, Wind } from 'lucide-react';

const App: React.FC = () => {
  const [shapeType, setShapeType] = useState<ShapeType>(ShapeType.PARAGLIDER);
  const [params, setParams] = useState<SimulationParams>({
    windSpeed: 38, // Typical paragliding trim speed km/h approx
    angleOfAttack: 8,
    viscosity: 1,
    particleCount: 2000
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
            <Wind className="w-5 h-5 text-sky-400" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">
            AeroSim <span className="text-sky-500">Para</span>
          </h1>
        </div>
        
        <div className="flex gap-4 items-center">
            <div className="bg-slate-900 px-3 py-1 rounded text-[10px] font-mono text-slate-400 border border-slate-800 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                CFD SOLVER: ONLINE
            </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Toolbar */}
        <aside className="w-72 bg-slate-950 border-r border-slate-800 p-5 flex flex-col gap-8 overflow-y-auto shrink-0 z-10">
          
          {/* Shape Selection */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Paragliding Equipment</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setShapeType(ShapeType.PARAGLIDER); setAnalysisResult(null); }}
                className={`p-3 rounded border flex flex-col items-center gap-2 transition-all ${
                  shapeType === ShapeType.PARAGLIDER ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="w-full h-4 border-t-4 border-current rounded-t-[100%]" />
                <span className="text-[10px] font-mono">WING PROFILE</span>
              </button>
              
              <button
                onClick={() => { setShapeType(ShapeType.POD); setAnalysisResult(null); }}
                className={`p-3 rounded border flex flex-col items-center gap-2 transition-all ${
                  shapeType === ShapeType.POD ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="w-full h-4 bg-current rounded-r-full rounded-l-md" />
                <span className="text-[10px] font-mono">POD HARNESS</span>
              </button>
            </div>

            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-6">Standard Shapes</h3>
             <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => { setShapeType(ShapeType.AIRFOIL); setAnalysisResult(null); }}
                className={`p-2 rounded border flex flex-col items-center gap-1 transition-all ${
                  shapeType === ShapeType.AIRFOIL ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <div className="w-6 h-1 bg-current rounded-full" />
                <span className="text-[9px] font-mono">NACA</span>
              </button>
              <button
                onClick={() => { setShapeType(ShapeType.CYLINDER); setAnalysisResult(null); }}
                className={`p-2 rounded border flex flex-col items-center gap-1 transition-all ${
                  shapeType === ShapeType.CYLINDER ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <Circle className="w-4 h-4" />
                <span className="text-[9px] font-mono">CYLINDER</span>
              </button>
               <button
                onClick={() => { setShapeType(ShapeType.CUSTOM); setAnalysisResult(null); }}
                className={`p-2 rounded border flex flex-col items-center gap-1 transition-all ${
                  shapeType === ShapeType.CUSTOM ? 'bg-sky-500/10 border-sky-500 text-sky-400' : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400'
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span className="text-[9px] font-mono">DRAW</span>
              </button>
            </div>
          </section>

          {/* Physics Parameters */}
          <section className="space-y-6">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Environment (Ultralight)</h3>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">AIRSPEED</span>
                <span className="text-sky-400">{params.windSpeed} km/h</span>
              </div>
              <input
                type="range"
                min="20"
                max="60"
                value={params.windSpeed}
                onChange={(e) => setParams({ ...params, windSpeed: parseInt(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                <span>STALL</span>
                <span>TRIM</span>
                <span>ACCEL</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">ANGLE OF INCIDENCE</span>
                <span className="text-sky-400">{params.angleOfAttack}°</span>
              </div>
              <input
                type="range"
                min="-15"
                max="25"
                value={params.angleOfAttack}
                onChange={(e) => setParams({ ...params, angleOfAttack: parseInt(e.target.value) })}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />
            </div>
          </section>

          {/* Info Box */}
          <div className="mt-auto bg-slate-900 p-3 rounded border border-slate-800 text-[10px] text-slate-500 leading-relaxed font-mono">
            <div className="flex items-center gap-2 mb-2 text-slate-300">
                <Info className="w-3 h-3" />
                <span>HYBRID SOLVER</span>
            </div>
            <ul className="list-disc pl-3 space-y-1">
                <li><strong className="text-slate-400">Visuals:</strong> Lattice Boltzmann (LBM D2Q9) for Turbulence & Separation.</li>
                <li><strong className="text-slate-400">Data:</strong> Vortex Panel Method for Lift/Drag calculation.</li>
            </ul>
          </div>

        </aside>

        {/* Center: Visualization */}
        <main className="flex-1 p-0 flex flex-col min-w-0 bg-[#0f172a] relative">
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