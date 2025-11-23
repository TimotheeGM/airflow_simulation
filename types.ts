export enum ShapeType {
  AIRFOIL = 'AIRFOIL',
  CYLINDER = 'CYLINDER',
  PLATE = 'PLATE',
  CUSTOM = 'CUSTOM'
}

export interface SimulationParams {
  windSpeed: number; // m/s
  angleOfAttack: number; // degrees
  viscosity: number; // relative factor (1.460e-5 standard air)
  particleCount: number;
}

export interface CpPoint {
  x: number;
  cp: number;
}

export interface PhysicsResult {
  liftCoefficient: number;
  dragCoefficient: number;
  momentCoefficient: number;
  reynoldsNumber: number;
  cpDistribution: CpPoint[]; // Pressure distribution for plotting
  centerOfPressure: number;
}

export interface AnalysisResult extends PhysicsResult {
  explanation: string;
  recommendations: string[];
}

export interface Point {
  x: number;
  y: number;
}
