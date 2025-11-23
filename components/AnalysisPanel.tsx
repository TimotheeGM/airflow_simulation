import React from 'react';
import { AnalysisResult } from '../types';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Area, AreaChart 
} from 'recharts';
import { Wind, Activity, TrendingUp, AlertTriangle } from 'lucide-react';

interface AnalysisPanelProps {
  loading: boolean;
  result: AnalysisResult | null;
  onAnalyze: () => void;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ loading, result, onAnalyze }) => {
  
  // Prepare Cp data for plotting (invert Y axis typically done in aero, but we'll stick to standard for now)
  const cpData = result?.cpDistribution.map(pt => ({
    x: pt.x.toFixed(0),
    cp: pt.cp
  })) || [];

  return (
    <div className="bg-slate-900 border-l border-slate-700 w-full md:w-[450px] flex flex-col h-full overflow-y-auto shadow-xl z-20">
      <div className="p-6 border-b border-slate-700 bg-slate-800/50">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-400" />
            Flight Computer
        </h2>
        <p className="text-slate-400 text-xs font-mono">
          RUNNING: VORTEX PANEL METHOD SOLVER
        </p>
      </div>

      <div className="p-6 flex-1 flex flex-col gap-6">
        <button
          onClick={onAnalyze}
          disabled={loading}
          className={`w-full py-3 px-4 rounded border font-mono text-sm tracking-wider transition-all uppercase ${
            loading
              ? 'bg-slate-800 border-slate-600 text-slate-500 cursor-wait'
              : 'bg-sky-900/30 border-sky-500 text-sky-400 hover:bg-sky-900/50 shadow-[0_0_15px_rgba(14,165,233,0.3)]'
          }`}
        >
          {loading ? 'CALCULATING...' : 'RUN SIMULATION'}
        </button>

        {result && (
          <div className="space-y-6 animate-fade-in">
            {/* Scientific Values Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <div className="text-slate-500 text-[10px] uppercase mb-1">Lift Coefficient (Cl)</div>
                <div className="text-xl font-mono text-emerald-400">{result.liftCoefficient.toFixed(4)}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <div className="text-slate-500 text-[10px] uppercase mb-1">Drag Coefficient (Cd)</div>
                <div className="text-xl font-mono text-red-400">{result.dragCoefficient.toFixed(5)}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <div className="text-slate-500 text-[10px] uppercase mb-1">L/D Ratio</div>
                <div className="text-xl font-mono text-blue-400">{(result.liftCoefficient / result.dragCoefficient).toFixed(2)}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <div className="text-slate-500 text-[10px] uppercase mb-1">Reynolds No.</div>
                <div className="text-sm font-mono text-slate-300">{result.reynoldsNumber.toExponential(2)}</div>
              </div>
            </div>

            {/* Pressure Distribution Chart */}
            <div className="h-56 w-full bg-slate-950 rounded border border-slate-800 p-2 relative">
              <div className="absolute top-2 left-3 text-[10px] text-slate-500 font-mono z-10">PRESSURE COEFFICIENT (-Cp)</div>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cpData}>
                    <defs>
                        <linearGradient id="colorCp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="x" hide />
                    <YAxis stroke="#475569" fontSize={10} tickFormatter={(val) => val.toFixed(1)} domain={['auto', 'auto']} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', fontSize: '12px' }}
                        itemStyle={{ color: '#38bdf8' }}
                    />
                    <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="cp" stroke="#38bdf8" fillOpacity={1} fill="url(#colorCp)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* AI Explanation */}
            <div className="space-y-3 border-t border-slate-800 pt-4">
                <div className="flex items-center gap-2 text-sky-500 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Expert Analysis</h3>
                </div>
                <div className="text-sm text-slate-300 leading-relaxed font-light">
                    {result.explanation}
                </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-2">
                 <div className="flex items-center gap-2 text-amber-500 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <h3 className="text-xs font-bold uppercase tracking-wider">Recommendations</h3>
                </div>
                <ul className="text-xs text-slate-400 space-y-1 list-none">
                    {result.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex gap-2">
                            <span className="text-amber-500/50">›</span>
                            {rec}
                        </li>
                    ))}
                </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisPanel;
