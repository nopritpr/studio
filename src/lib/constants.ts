import type { VehicleState, DriveMode } from './types';

export const defaultState: VehicleState = {
  odometer: 0.0,
  tripA: 0.0,
  tripB: 0.0,
  activeTrip: 'A',
  batterySOC: 100.0,
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
  recentWhPerKm: 111,
  recentWhPerKmWindow: [],
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
};

export const EV_CONSTANTS = {
  mass_kg: 1850,
  frontalArea_m2: 2.25,
  dragCoeff: 0.27,
  airDensity: 1.204,
  rollingResistanceCoeff: 0.010,
  gravity: 9.806,
  accessoryBase_kW: 0.25,
  drivetrainEfficiency: 0.9,
  maxRegenPower_kW: 70,
  chargeRate_kW: 22, // Corresponds to approx 1% per 5s for a 50kWh battery
};

export const MODE_SETTINGS: Record<
  DriveMode,
  {
    maxSpeed: number;
    accelRate: number;
    decelRate: number;
    brakeRate: number;
    regenEfficiency: number;
    powerFactor: number;
    baseConsumption: number; // Wh/km
  }
> = {
  Eco: {
    maxSpeed: 45,
    accelRate: 20,
    decelRate: 2.0,
    brakeRate: 15,
    regenEfficiency: 0.9,
    powerFactor: 1.2,
    baseConsumption: 111, // Wh/km to achieve ~450km range on 50kWh
  },
  City: {
    maxSpeed: 75,
    accelRate: 30,
    decelRate: 1.5,
    brakeRate: 25,
    regenEfficiency: 0.8,
    powerFactor: 1.0,
    baseConsumption: 119, // Wh/km to achieve ~420km range
  },
  Sports: {
    maxSpeed: 120,
    accelRate: 50,
    decelRate: 1.0,
    brakeRate: 35,
    regenEfficiency: 0.65,
    powerFactor: 0.8,
    baseConsumption: 125, // Wh/km to achieve ~400km range
  },
};
