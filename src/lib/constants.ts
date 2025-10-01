
import type { VehicleState, DriveMode } from './types';

export const defaultState: VehicleState = {
  odometer: 0.0,
  tripA: 0.0,
  tripB: 0.0,
  activeTrip: 'A',
  batterySOC: 100.0,
  range: 450,
  initialRange: 450,
  driveMode: 'Eco',
  acOn: false,
  acTemp: 22,
  passengers: 1,
  goodsInBoot: false,
  chargingLogs: [],
  speed: 0,
  power: 0,
  efficiency: 0,
  ecoScore: 85,
  batteryCapacity_kWh: 75,
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
  sohHistory: [
    {
      odometer: 0,
      cycleCount: 0,
      avgBatteryTemp: 25,
      soh: 100,
      ecoPercent: 100,
      cityPercent: 0,
      sportsPercent: 0,
    },
  ],
  packNominalCapacity_kWh: 75,
  packUsableFraction: 0.95,
  packSOH: 100,
  equivalentFullCycles: 0,
  cumulativeEnergyOut_kWh: 0,
  cumulativeEnergyIn_kWh: 0,
  batteryTemp: 30,
  drivetrainEfficiency: 0.9,
  regenEfficiencyDynamic: 0.85,
  thermalThrottleFactor: 1.0,
  regenLimitFactor: 1.0,
  recentWhPerKm: 158.33,
  recentWhPerKmWindow: Array(50).fill(158.33),
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
    'Pritesh': { id: 'USR-001', driveMode: 'Eco', acTemp: 22, phone: '555-1234', age: 34 },
    'Alex Doe': { id: 'USR-002', driveMode: 'Eco', acTemp: 22, phone: '555-5678', age: 28 },
    'Ben Smith': { id: 'USR-003', driveMode: 'City', acTemp: 20, phone: '555-8765', age: 45 },
    'Chloe Ray': { id: 'USR-004', driveMode: 'Sports', acTemp: 24, phone: '555-4321', age: 31 },
  },
  activeProfile: 'Pritesh',
  weather: null,
  sohForecast: [],
  drivingRecommendation: 'Start driving to get recommendations.',
  drivingStyle: 'Balanced',
  drivingStyleRecommendations: [],
 fatigueWarning: null,
  fatigueLevel: 0,
};

export const EV_CONSTANTS = {
  mass_kg: 1960,
  frontalArea_m2: 2.4,
  dragCoeff: 0.23,
  airDensity: 1.225, // kg/m^3
  rollingResistanceCoeff: 0.009,
  gravity: 9.81,
  drivetrainEfficiency: 0.9,
  regenEfficiency: 0.7, // Realistic regen efficiency
  chargeRate_kW: 22,
  acPower_kW: 1.5,
  baseConsumption: 158.33, // Wh/km for 450km range on 71.25kWh usable
  cityModeConsumption: 169.64, // Wh/km for 420km range
  sportsModeConsumption: 187.5, // Wh/km for 380km range
  gentleRegenBrakeRate: 0.8, // m/s^2 for one-pedal driving feel
};

export const MODE_SETTINGS: Record<
  DriveMode,
  {
    maxSpeed: number; // km/h
    accelRate: number; // m/s^2
    brakeRate: number; // m/s^2
    strongRegenBrakeRate: number; // m/s^2
  }
> = {
  Eco: {
    maxSpeed: 45,
    accelRate: 1.2,
    brakeRate: 4.0,
    strongRegenBrakeRate: 5.0,
  },
  City: {
    maxSpeed: 75,
    accelRate: 2.0,
    brakeRate: 5.0,
    strongRegenBrakeRate: 6.0,
  },
  Sports: {
    maxSpeed: 120,
    accelRate: 3.5,
    brakeRate: 6.0,
    strongRegenBrakeRate: 7.0,
  },
};

    