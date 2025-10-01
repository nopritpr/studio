export type DriveMode = 'Eco' | 'City' | 'Sports';

export interface Profile {
  driveMode: DriveMode;
  acTemp: number;
}

export interface ChargingLog {
  startTime: number;
  endTime: number;
  startSOC: number;
  endSOC: number;
  energyAdded: number;
}

export interface SohHistoryEntry {
  odometer: number;
  cycleCount: number;
  avgBatteryTemp: number;
  soh?: number; // SOH is now optional as it might not be present in every entry
  ecoPercent: number;
  cityPercent: number;
  sportsPercent: number;
}


export type VehiclePhysics = {
  acceleration: number;
  inertiaFactor: number;
  brakingApplied: boolean;
  regenActive: boolean;
  regenPower: number;
};

export interface WeatherListItem {
  dt: number;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    sea_level: number;
    grnd_level: number;
    humidity: number;
    temp_kf: number;
  };
  weather: {
    id: number;
    main: string;
    description: string;
    icon: string;
  }[];
  clouds: {
    all: number;
  };
  wind: {
    speed: number;
    deg: number;
    gust: number;
  };
  visibility: number;
  pop: number;
  sys: {
    pod: string;
  };
  dt_txt: string;
}

export interface FiveDayForecast {
  cod: string;
  message: number;
  cnt: number;
  list: WeatherListItem[];
  city: {
    id: number;
    name: string;
    coord: {
      lat: number;
      lon: number;
    };
    country: string;
    population: number;
    timezone: number;
    sunrise: number;
    sunset: number;
  };
}

export interface WeatherData {
  weather: {
    main: string;
    icon: string;
  }[];
  main: {
    temp: number;
    humidity: number;
  };
  wind: {
    speed: number;
  };
  name: string;
}

export interface VehicleState {
  odometer: number;
  tripA: number;
  tripB: number;
  activeTrip: 'A' | 'B';
  batterySOC: number;
  range: number;
  initialRange: number;
  driveMode: DriveMode;
  acOn: boolean;
  acTemp: number;
  passengers: number;
  goodsInBoot: boolean;
  chargingLogs: ChargingLog[];
  lastChargeLog?: { startTime: number; startSOC: number };
  speed: number;
  power: number;
  efficiency: number;
  ecoScore: number;
  batteryCapacity_kWh: number;
  lastUpdate: number;
  displaySpeed: number;
  outsideTemp: number;
  insideTemp: number;
  speedHistory: number[];
  accelerationHistory: number[];
  powerHistory: number[];
  energyConsumptionHistory: number[];
  driveModeHistory: DriveMode[];
  lastStyleClassificationTime: number;
  aggressiveDrivingCounter: number;
  stabilizerEnabled: boolean;
  rawPredictedRange: number | null;
  sohHistory: SohHistoryEntry[];
  packNominalCapacity_kWh: number;
  packUsableFraction: number;
  packSOH: number;
  equivalentFullCycles: number;
  cumulativeEnergyOut_kWh: number;
  cumulativeEnergyIn_kWh: number;
  batteryTemp: number;
  drivetrainEfficiency: number;
  regenEfficiencyDynamic: number;
  thermalThrottleFactor: number;
  regenLimitFactor: number;
  recentWhPerKm: number;
  recentWhPerKmWindow: number[];
  styleMetrics: {
    aggression: number;
    smoothness: number;
    regenShare: number;
    harshEvents: number;
    harshBrakes: number;
    harshAccel: number;
  };
  lastDegradationUpdate: number;
  lastRangeModelUpdate: number;
  predictedEcoRange: number;
  predictedDynamicRange: number;
  limpMode: boolean;
  powerLimit_kW: number;
  voltageNominal: number;
  internalResistance: number;
  lastSOHUpdate: number;
  lastRangeSpeed: number;
  lastRawDynamicRange: number | null;
  isCharging: boolean;
  profiles: Record<string, Profile>;
  activeProfile: string;
  weather: WeatherData | null;
  sohForecast: { odometer: number; soh: number }[];
  drivingRecommendation: string;
  drivingStyle: string;
  drivingStyleRecommendations: string[];
  fatigueWarning: string | null;
}

    