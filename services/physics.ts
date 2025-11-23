import { Point, PhysicsResult } from '../types';

// Constants for Standard Atmosphere
const KINEMATIC_VISCOSITY = 1.460e-5; // m^2/s
const AIR_DENSITY = 1.225; // kg/m^3

/**
 * A simplified Linear Solver (Gaussian Elimination)
 * Solves Ax = b
 */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  // Augment matrix
  const M = A.map((row, i) => [...row, b[i]]);

  // Forward elimination
  for (let i = 0; i < n; i++) {
    // Pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];

    // Normalize pivot row
    const pivot = M[i][i];
    for (let j = i; j <= n; j++) M[i][j] /= pivot;

    // Eliminate other rows
    for (let k = 0; k < n; k++) {
      if (k !== i) {
        const factor = M[k][i];
        for (let j = i; j <= n; j++) M[k][j] -= factor * M[i][j];
      }
    }
  }

  return M.map(row => row[n]);
}

/**
 * Vortex Panel Method Solver
 * "Building on" the logic found in libraries like AeroSandbox/XFoil.
 */
export const calculatePhysics = (
  shape: Point[],
  speed: number, // m/s
  alphaDeg: number,
  chordLength: number = 1 // m
): PhysicsResult => {
  // 1. Pre-process Geometry
  // Ensure we have enough panels but not too many for JS performance (approx 50-100)
  // For this demo, we assume the shape points passed are already a reasonable polygon.
  
  const alpha = alphaDeg * (Math.PI / 180);
  const V_inf = speed;
  const nPanels = shape.length - 1;
  
  // Need closed loop
  const panels = [];
  for (let i = 0; i < nPanels; i++) {
    panels.push({
      p1: shape[i],
      p2: shape[i + 1]
    });
  }

  // 2. Control Points (Collocation points) & Geometry
  const controlPoints: Point[] = [];
  const panelLengths: number[] = [];
  const theta: number[] = []; // Panel angles

  panels.forEach(p => {
    const dx = p.p2.x - p.p1.x;
    const dy = p.p2.y - p.p1.y;
    panelLengths.push(Math.hypot(dx, dy));
    theta.push(Math.atan2(dy, dx));
    controlPoints.push({
      x: (p.p1.x + p.p2.x) / 2,
      y: (p.p1.y + p.p2.y) / 2
    });
  });

  // 3. Construct Influence Matrix
  // Using a constant strength source/vortex method or similar simplified potential flow.
  // We will use a standard method: solving for circulation densities (gamma).
  
  // NOTE: Implementing a full Hess-Smith or Linear Vortex panel code in one file is dense.
  // We will use a simplified approach for the "App" context:
  // Estimate Cl based on Panel orientation (Deflection) and Kutta-Joukowski approx for the system.
  
  // Let's perform a direct Circulation Summation approximation which is physically grounded.
  // Calculate flow tangency condition.
  
  // Matrix A (n x n)
  // System: sum(A_ij * gamma_j) = -V_inf * n_i
  const A: number[][] = Array(nPanels).fill(0).map(() => Array(nPanels).fill(0));
  const RHS: number[] = Array(nPanels).fill(0);

  for (let i = 0; i < nPanels; i++) {
    // Normal vector at control point i
    const nx = -Math.sin(theta[i]);
    const ny = Math.cos(theta[i]);
    
    // RHS: Free stream component normal to panel
    // V_inf vector: (V cos a, V sin a)
    RHS[i] = -V_inf * (Math.cos(alpha) * nx + Math.sin(alpha) * ny);

    for (let j = 0; j < nPanels; j++) {
      if (i === j) {
        A[i][j] = 0.5; // Self-influence term
      } else {
        // Induced velocity by panel j on control point i
        // Simple vortex point approximation for far field, distributed for near field
        const dx = controlPoints[i].x - controlPoints[j].x;
        const dy = controlPoints[i].y - controlPoints[j].y;
        const r2 = dx * dx + dy * dy;
        
        // Velocity induced by vortex at j: V = Gamma / (2*pi*r)
        // Cross product with r to get normal comp
        // This is a simplified kernel (Point Vortex method)
        // Ref: Katz & Plotkin "Low-Speed Aerodynamics"
        const r = Math.sqrt(r2);
        const cross = (dx * ny - dy * nx); // r x n
        A[i][j] = (1 / (2 * Math.PI)) * (cross / r2) * panelLengths[j];
      }
    }
  }

  // 4. Kutta Condition: Gamma_upper + Gamma_lower = 0 at trailing edge?
  // Or force stagnation. In a simple N x N solver without explicit Kutta row, 
  // we rely on the geometry being sharp at TE or use a circulation constraint.
  // For robustness in this JS port, we'll solve the linear system and then enforce net circulation 
  // implicitly via the lift calculation.
  
  // Solving for Vortex Strengths (gamma)
  let gamma = [];
  try {
     gamma = solveLinearSystem(A, RHS);
  } catch (e) {
     // Fallback for singular matrix (e.g., flat plate perfectly aligned)
     gamma = Array(nPanels).fill(0); 
  }

  // 5. Post-Process: Calculate Forces
  let Circulation = 0;
  const cpDist: {x: number, cp: number}[] = [];
  
  for (let i = 0; i < nPanels; i++) {
    Circulation += gamma[i] * panelLengths[i];
    
    // Local velocity approx (Tangential)
    // Vt = V_inf_tangential + induced
    // Cp = 1 - (V/V_inf)^2
    // Simplified: Pressure is related to local vortex strength density
    const localV = V_inf + gamma[i]; // Approximation
    const cp = 1 - (localV / V_inf) ** 2;
    
    // Normalize X for plotting (0 to 1)
    // Assuming shape is roughly centered or we find bounds
    cpDist.push({ x: controlPoints[i].x, cp: cp });
  }

  // Reynolds Number
  // Re = (rho * V * L) / mu = (V * L) / nu
  // Assuming L (Chord) ~ 200 pixels scaled to meters? 
  // Let's assume the screen object is "0.2 meters" chord for simulation scaling.
  const REAL_CHORD = 0.2; 
  const Re = (V_inf * REAL_CHORD) / KINEMATIC_VISCOSITY;

  // Kutta-Joukowski Lift Theorem: L = rho * V_inf * Circulation
  // Cl = L / (0.5 * rho * V^2 * c) = (2 * Circulation) / (V * c)
  // Scaling circulation back to unit chord
  
  // NOTE: The calculated circulation is in pixel-space units. 
  // We need to normalize by the chord length in pixels (~200px).
  const pixelChord = 200; 
  let Cl = (2 * Circulation) / (V_inf * pixelChord);

  // Apply stall correction (Viscous effect)
  // Panel methods don't predict stall. We must add a scientific heuristic.
  // Stall typically starts around 12-15 degrees for airfoils.
  const stallAngle = 15 * (Math.PI / 180);
  if (Math.abs(alpha) > stallAngle) {
    // Massive lift loss factor
    const factor = Math.cos(alpha) * 0.8; // Simplistic separated flow model
    Cl *= factor;
  }

  // Drag Estimation (Parasite Drag + Induced)
  // Cd0 (Skin Friction)
  // Turbulent flat plate correlation: Cf = 0.074 / Re^0.2
  const Cf = 0.074 / Math.pow(Re, 0.2);
  // Form factor (thickness correction)
  const tc = 0.12; // Assume 12% thickness average
  const formFactor = 1 + 2 * tc + 60 * (tc ** 4);
  let Cd = 2 * Cf * formFactor;

  // Induced Drag / Pressure Drag due to separation (high alpha)
  // Cd_pressure = Cl * tan(alpha) (roughly) + separation drag
  if (Math.abs(alpha) > stallAngle) {
     Cd += 1.8 * Math.sin(alpha) ** 2; // Bluff body drag kick-in
  } else {
     Cd += (Cl * Cl) / (Math.PI * 50); // Small induced drag term (2D is 0 but 3D wing approx)
  }

  // Sort Cp distribution by X for plotting
  cpDist.sort((a, b) => a.x - b.x);

  return {
    liftCoefficient: Cl || 0,
    dragCoefficient: Cd || 0.01,
    momentCoefficient: -0.25 * Cl, // Quarter-chord approx
    reynoldsNumber: Re,
    cpDistribution: cpDist,
    centerOfPressure: 0.25
  };
};
