import type { VehicleState, DriveMode } from './types';

export const defaultState: VehicleState = {
  odometer: 0.0,
  tripA: 0.0,
  tripB: 0.0,
  activeTrip: 'A',
  batterySOC: 100.0,
  range: 450,
  driveMode: 'Eco',
  acOn: false,
  acTemp: 22,
  chargingLogs: [],
  speed: 0,
  power: 0,
  efficiency: 0,
  ecoScore: 85,
  batteryCapacity_kWh: 50,
  lastUpdate: Date.now(),
  displaySpeed: 0,
  outsideTemp: 25,
  insideTemp: 25,
  speedHistory: [],
  accelerationHistory: [],
  powerHistory: [],
  energyConsumptionHistory: [],
  driveModeHistory: [],
  lastStyleClassificationTime: 0,
  aggressiveDrivingCounter: 0,
  stabilizerEnabled: true,
  rawPredictedRange: null,
  sohHistory: [],
  packNominalCapacity_kWh: 50,
  packUsableFraction: 0.92,
  packSOH: 100,
  equivalentFullCycles: 0,
  cumulativeEnergyOut_kWh: 0,
  cumulativeEnergyIn_kWh: 0,
  batteryTemp: 30,
  drivetrainEfficiency: 0.9,
  regenEfficiencyDynamic: 0.85,
  thermalThrottleFactor: 1.0,
  regenLimitFactor: 1.0,
  recentWhPerKm: 120,
  recentWhPerKmWindow: Array(50).fill(120),
  styleMetrics: {
    aggression: 0,
    smoothness: 1,
    regenShare: 0,
    harshEvents: 0,
    harshBrakes: 0,
    harshAccel: 0,
  },
  lastDegradationUpdate: 0,
  lastRangeModelUpdate: 0,
  predictedEcoRange: 0,
  predictedDynamicRange: 450,
  limpMode: false,
  powerLimit_kW: 0,
  voltageNominal: 360,
  internalResistance: 0.08,
  lastSOHUpdate: 0,
  lastRangeSpeed: 0,
  lastRawDynamicRange: null,
  isCharging: false,
  profiles: {
    'Pritesh': { driveMode: 'Eco', acTemp: 22 },
    'Alex Doe': { driveMode: 'Eco', acTemp: 22 },
    'Ben Smith': { driveMode: 'City', acTemp: 20 },
    'Chloe Ray': { driveMode: 'Sports', acTemp: 24 },
  },
  activeProfile: 'Pritesh',
  weather: null,
  sohForecast: [],
  drivingRecommendation: 'Start driving to get recommendations.',
  drivingStyle: 'Balanced',
  drivingStyleRecommendations: [],
  passengers: 1,
  goodsInBoot: false,
  fatigueWarning: null,
};

export const EV_CONSTANTS = {
  mass_kg: 1800,
  frontalArea_m2: 2.3,
  dragCoeff: 0.28,
  airDensity: 1.225, // kg/m^3
  rollingResistanceCoeff: 0.01,
  gravity: 9.81,
  drivetrainEfficiency: 0.92, // Motor to wheels
  maxRegenPower_kW: 60,
  chargeRate_kW: 22,
  acPower_kW: 1.8,
  avgPassengerWeight_kg: 75,
  bootGoodsWeight_kg: 50,
};

export const MODE_SETTINGS: Record<
  DriveMode,
  {
    maxSpeed: number; // km/h
    accelRate: number; // m/s^2
    decelRate: number; // m/s^2 (base)
    brakeRate: number; // m/s^2
    regenEfficiency: number; // %
  }
> = {
  Eco: {
    maxSpeed: 100,
    accelRate: 1.4,
    decelRate: 0.8,
    brakeRate: 4.5,
    regenEfficiency: 0.9,
  },
  City: {
    maxSpeed: 130,
    accelRate: 2.2,
    decelRate: 0.5,
    brakeRate: 5.5,
    regenEfficiency: 0.8,
  },
  Sports: {
    maxSpeed: 160,
    accelRate: 4.0,
    decelRate: 0.2,
    brakeRate: 6.5,
    regenEfficiency: 0.7,
  },
};
