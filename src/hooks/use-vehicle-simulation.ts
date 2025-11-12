
'use client';

import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import type { VehicleState, DriveMode, Profile, ChargingLog, SohHistoryEntry, AiState, PredictiveIdleDrainOutput, AcUsageImpactOutput, FiveDayForecast, WeatherData, GetWeatherImpactInput, GetWeatherImpactOutput } from '@/lib/types';
import { defaultState, EV_CONSTANTS, MODE_SETTINGS, defaultAiState } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { getDrivingRecommendation, type DrivingRecommendationInput } from '@/ai/flows/adaptive-driving-recommendations';
import { analyzeDrivingStyle, type AnalyzeDrivingStyleInput } from '@/ai/flows/driver-profiling';
import { predictIdleDrain, type PredictiveIdleDrainInput } from '@/ai/flows/predictive-idle-drain';
import { monitorDriverFatigue, type DriverFatigueInput } from '@/ai/flows/driver-fatigue-monitor';
import { getAcUsageImpact, type AcUsageImpactInput } from '@/ai/flows/ac-usage-impact-forecaster';
import { getWeatherImpact } from '@/ai/flows/weather-impact-forecast';

// Debounce utility
const debounce = (func: (...args: any[]) => void, delay: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};


const keys: Record<string, boolean> = {
  ArrowUp: false,
  ArrowDown: false,
  r: false,
};

function vehicleStateReducer(state: VehicleState, action: Partial<VehicleState>): VehicleState {
  return { ...state, ...action };
}

function aiStateReducer(state: AiState, action: Partial<AiState>): AiState {
    return { ...state, ...action };
}

const generateInitialSohHistory = (): SohHistoryEntry[] => {
    const entries: SohHistoryEntry[] = [];
    return entries;
};

const initialState: VehicleState = {
    ...defaultState,
    odometer: 0,
    sohHistory: generateInitialSohHistory(),
};

export function useVehicleSimulation() {
  const [vehicleState, setVehicleState] = useReducer(vehicleStateReducer, initialState);
  const [aiState, setAiState] = useReducer(aiStateReducer, defaultAiState);

  const { toast } = useToast();
  
  const accelerationRef = useRef<number>(0);
  const requestRef = useRef<number>();
  
  const lastSohHistoryUpdateOdometer = useRef(vehicleState.odometer);
  
  const vehicleStateRef = useRef(vehicleState);
  useEffect(() => {
    vehicleStateRef.current = vehicleState;
  }, [vehicleState]);
  
  const aiStateRef = useRef(aiState);
  useEffect(() => {
    aiStateRef.current = aiState;
  }, [aiState]);


  const setDriveMode = (mode: DriveMode) => {
    setVehicleState({ driveMode: mode, driveModeHistory: [mode, ...vehicleStateRef.current.driveModeHistory].slice(0, 50) as DriveMode[] });
  };

  const toggleAC = () => {
     setVehicleState({ acOn: !vehicleStateRef.current.acOn });
  };

  const setAcTemp = (temp: number) => {
    setVehicleState({ acTemp: temp });
  }

  const setPassengers = (count: number) => {
    setVehicleState({ passengers: count });
  };

  const toggleGoodsInBoot = () => {
    setVehicleState({ goodsInBoot: !vehicleStateRef.current.goodsInBoot });
  };

  const toggleCharging = () => {
    const currentState = vehicleStateRef.current;
    if (currentState.speed > 0 && !currentState.isCharging) {
        toast({
          title: "Cannot start charging",
          description: "Vehicle must be stationary to start charging.",
          variant: "destructive",
        });
        return;
    }

    const isCharging = !currentState.isCharging;
    const now = Date.now();
    let newLogs = [...currentState.chargingLogs];

    if (isCharging) {
      setVehicleState({
        isCharging,
        lastChargeLog: {
          startTime: now,
          startSOC: currentState.batterySOC,
        }
      });
    } else if (currentState.lastChargeLog) {
      const log = currentState.lastChargeLog;
      const energyAdded = (currentState.batterySOC - log.startSOC) / 100 * currentState.packNominalCapacity_kWh;
      const newLog: ChargingLog = {
        startTime: log.startTime,
        endTime: now,
        startSOC: log.startSOC,
        endSOC: currentState.batterySOC,
        energyAdded: Math.max(0, energyAdded),
      };
      newLogs.push(newLog);
      setVehicleState({
        isCharging,
        chargingLogs: newLogs.slice(-10),
        lastChargeLog: undefined,
      });
    }
  };
  const resetTrip = () => {
    const currentState = vehicleStateRef.current;
    if (currentState.activeTrip === 'A') setVehicleState({ tripA: 0 });
    else setVehicleState({ tripB: 0 });
  };
  const setActiveTrip = (trip: 'A' | 'B') => setVehicleState({ activeTrip: trip });

  const switchProfile = (profileName: string) => {
    const currentState = vehicleStateRef.current;
    if (currentState.profiles[profileName]) {
        setVehicleState({
            activeProfile: profileName,
            ...currentState.profiles[profileName]
        });
        toast({ title: `Switched to ${profileName}'s profile.`});
    }
  };

  const addProfile = (profileName: string, profileDetails: Omit<Profile, 'driveMode' | 'acTemp'>) => {
    const currentState = vehicleStateRef.current;
    if (profileName && !currentState.profiles[profileName]) {
        const newProfile: Profile = {
            ...profileDetails,
            driveMode: 'Eco',
            acTemp: 22,
        };
        const newProfiles = { ...currentState.profiles, [profileName]: newProfile };
        setVehicleState({ profiles: newProfiles });
        toast({ title: `Profile ${profileName} added.`});
    }
  };

  const deleteProfile = (profileName: string) => {
    const currentState = vehicleStateRef.current;
    if (profileName && currentState.profiles[profileName] && Object.keys(currentState.profiles).length > 1) {
        const newProfiles = { ...currentState.profiles };
        delete newProfiles[profileName];
        
        let nextProfile = currentState.activeProfile;
        if (currentState.activeProfile === profileName) {
            nextProfile = Object.keys(newProfiles)[0];
        }

        setVehicleState({ profiles: newProfiles });
        switchProfile(nextProfile);
        toast({ title: `Profile ${profileName} deleted.`});
    }
  };
  
  const calculateDynamicRange = useCallback(() => {
    const currentState = vehicleStateRef.current;
    const currentAiState = aiStateRef.current;
    const idealRange = currentState.initialRange * (currentState.batterySOC / 100);

    let penaltyPercentage = { ac: 0, load: 0, temp: 0, driveMode: 0 };
    
    // AC Penalty - now sourced from the AI model if available
    const acImpactKm = currentAiState.acUsageImpact ? Math.abs(currentAiState.acUsageImpact.rangeImpactKm) : 0;
    if (idealRange > 0) {
      penaltyPercentage.ac = acImpactKm / idealRange;
    }

    // Load Penalty
    const passengerPenalty = (currentState.passengers - 1) * 0.015;
    const goodsPenalty = currentState.goodsInBoot ? 0.03 : 0;
    penaltyPercentage.load = passengerPenalty + goodsPenalty;
    
    // Temperature Penalty
    const outsideTemp = currentState.outsideTemp || 22;
    if (outsideTemp < 10) {
        penaltyPercentage.temp = (10 - outsideTemp) * 0.01; // 1% penalty for each degree below 10°C
    } else if (outsideTemp > 25) {
        penaltyPercentage.temp = (outsideTemp - 25) * 0.007; // 0.7% penalty for each degree above 25°C
    }

    // Drive Mode Penalty
    if (currentState.driveMode === 'City') penaltyPercentage.driveMode = 0.07;
    else if (currentState.driveMode === 'Sports') penaltyPercentage.driveMode = 0.18;

    const totalPenaltyPercentage = penaltyPercentage.ac + penaltyPercentage.load + penaltyPercentage.temp + penaltyPercentage.driveMode;

    const predictedRange = idealRange * (1 - totalPenaltyPercentage);
    const totalRangeLoss = idealRange - predictedRange;

    const finalPenalties = {
      ac: acImpactKm,
      load: totalRangeLoss > 0 && totalPenaltyPercentage > 0 ? totalRangeLoss * (penaltyPercentage.load / totalPenaltyPercentage) : 0,
      temp: totalRangeLoss > 0 && totalPenaltyPercentage > 0 ? totalRangeLoss * (penaltyPercentage.temp / totalPenaltyPercentage) : 0,
      driveMode: totalRangeLoss > 0 && totalPenaltyPercentage > 0 ? totalRangeLoss * (penaltyPercentage.driveMode / totalPenaltyPercentage) : 0,
    };
    
    setVehicleState({ range: predictedRange, predictedDynamicRange: predictedRange, rangePenalties: finalPenalties });
  }, []);

  const triggerAcUsageImpact = useCallback(debounce(async () => {
    const currentState = vehicleStateRef.current;
    try {
      const acImpactInput: AcUsageImpactInput = {
        acOn: currentState.acOn,
        acTemp: currentState.acTemp,
        outsideTemp: currentState.outsideTemp,
        recentEfficiency: currentState.recentWhPerKm > 0 ? currentState.recentWhPerKm : 160,
      };
      const acImpactResult = await getAcUsageImpact(acImpactInput);
      setAiState({ acUsageImpact: acImpactResult });
    } catch (error) {
      console.error("Error calling getAcUsageImpact:", error);
      setAiState({ acUsageImpact: null });
    }
  }, 2000), []);

  const triggerFatigueCheck = useCallback(async (currentSpeed: number, currentAcceleration: number) => {
    const currentState = vehicleStateRef.current;
    
    // Update histories with the latest data BEFORE calling the AI
    const speedHistory = [currentSpeed, ...currentState.speedHistory].slice(0, 60);
    const accelerationHistory = [currentAcceleration, ...currentState.accelerationHistory].slice(0, 60);

    // Update the state with the new histories so the next tick has them
    setVehicleState({ speedHistory, accelerationHistory });
    
    if (currentSpeed < 10) {
      // Reset fatigue level if speed is low, but don't clear warning immediately
      setAiState({ fatigueLevel: 0 });
      return;
    }
    
    try {
      const fatigueInput: DriverFatigueInput = {
        speedHistory: speedHistory,
        accelerationHistory: accelerationHistory,
      };
      const fatigueResult = await monitorDriverFatigue(fatigueInput);

      setAiState(prevState => ({
        ...prevState,
        fatigueLevel: fatigueResult.confidence,
        fatigueWarning: fatigueResult.isFatigued ? fatigueResult.reasoning : prevState.fatigueWarning, // Don't clear warning on non-fatigued result
      }));
      if (fatigueResult.confidence < 0.5) {
        setAiState({ fatigueWarning: null });
      }

    } catch (error) {
      console.error("Error calling monitorDriverFatigue:", error);
    }
  }, []);

  const triggerIdlePrediction = useCallback(debounce(async () => {
    const currentState = vehicleStateRef.current;
    if (currentState.speed > 0 || currentState.isCharging) return;
    try {
      const drainInput: PredictiveIdleDrainInput = {
        currentBatterySOC: currentState.batterySOC,
        acOn: currentState.acOn,
        acTemp: currentState.acTemp,
        outsideTemp: currentState.outsideTemp,
        passengers: currentState.passengers,
        goodsInBoot: currentState.goodsInBoot,
      };
      const drainResult = await predictIdleDrain(drainInput);
      setAiState(prevState => ({ ...prevState, idleDrainPrediction: drainResult }));
    } catch (error) {
      console.error("Error calling predictIdleDrain:", error);
    }
  }, 5000), []);

  const lastFatigueCheckTime = useRef(0);

  const updateVehicleState = useCallback(() => {
    const prevState = vehicleStateRef.current;
    const now = Date.now();
    const timeDelta = (now - prevState.lastUpdate) / 1000;
    
    if (timeDelta <= 0) {
      requestRef.current = requestAnimationFrame(updateVehicleState);
      return;
    }

    let newSOC = prevState.batterySOC;
    
    const isActuallyIdle = prevState.speed === 0 && !prevState.isCharging;

    if (isActuallyIdle) {
      const basePhantomDrainPerHour = 0.25; 
      let totalDrainPerHour = basePhantomDrainPerHour;

      if (prevState.acOn) {
        const tempDiff = Math.abs(prevState.outsideTemp - prevState.acTemp);
        const dutyCycle = Math.min(1, tempDiff / 10);
        const acPowerDrain_kW = EV_CONSTANTS.acPower_kW * dutyCycle;
        const acSocDrainPerHour = (acPowerDrain_kW / prevState.packNominalCapacity_kWh) * 100;
        totalDrainPerHour += acSocDrainPerHour;
      }

      const totalDrainPerSecond = totalDrainPerHour / 3600;
      newSOC -= totalDrainPerSecond * timeDelta;
      
    }

    const modeSettings = MODE_SETTINGS[prevState.driveMode];
    let currentAcceleration = accelerationRef.current;

    let targetAcceleration = 0;
    if (keys.ArrowUp) targetAcceleration = modeSettings.accelRate;
    else if (keys.ArrowDown) targetAcceleration = -modeSettings.brakeRate;
    else if (keys.r) targetAcceleration = -modeSettings.strongRegenBrakeRate;
    else if (prevState.speed > 0) targetAcceleration = -EV_CONSTANTS.gentleRegenBrakeRate;

    currentAcceleration += (targetAcceleration - currentAcceleration) * 0.1;
    accelerationRef.current = currentAcceleration;

    let newSpeedKmh = prevState.speed + currentAcceleration * timeDelta * 3.6;
    newSpeedKmh = Math.max(0, newSpeedKmh);
    
    if (newSpeedKmh > modeSettings.maxSpeed && currentAcceleration > 0) {
      if (prevState.speed <= modeSettings.maxSpeed) newSpeedKmh = modeSettings.maxSpeed;
    }
    const speedMs = newSpeedKmh / 3.6;

    const distanceTraveledKm = newSpeedKmh * (timeDelta / 3600);
    
    // Physics-based power calculation
    const fAero = EV_CONSTANTS.dragCoeff * EV_CONSTANTS.frontalArea_m2 * EV_CONSTANTS.airDensity * Math.pow(speedMs, 2) * 0.5;
    const fRoll = EV_CONSTANTS.rollingResistanceCoeff * EV_CONSTANTS.mass_kg * EV_CONSTANTS.gravity;
    const fInertia = EV_CONSTANTS.mass_kg * currentAcceleration;

    const totalTractiveForce = fAero + fRoll + fInertia;
    const tractivePower = totalTractiveForce * speedMs; // Power in Watts
    let instantPower = tractivePower / (1000 * EV_CONSTANTS.drivetrainEfficiency); // Power in kW

    if (instantPower < 0) { // Regenerative Braking
      instantPower *= EV_CONSTANTS.regenEfficiency;
    }
     // Add AC power consumption
    if (prevState.acOn) {
        instantPower += EV_CONSTANTS.acPower_kW * (Math.min(1, Math.abs(prevState.acTemp - prevState.outsideTemp) / 10));
    }


    const energyUsedKwh = Math.max(0, instantPower) * (timeDelta / 3600);
    const energyGainedKwh = Math.min(0, instantPower) * (timeDelta / 3600);

    const socDelta = ((energyUsedKwh + energyGainedKwh) / prevState.packNominalCapacity_kWh) * 100;
    
    if (prevState.isCharging) {
      const chargePerSecond = 1 / 5;
      newSOC += chargePerSecond * timeDelta;
    } else if (!isActuallyIdle) {
      newSOC -= socDelta;
    }
    newSOC = Math.max(0, Math.min(100, newSOC));
    
    const newOdometer = prevState.odometer + distanceTraveledKm;
    
    let newEcoScore = prevState.ecoScore;
    if (newSpeedKmh > 1 && !prevState.isCharging) {
        const currentScore = 100 - Math.abs(currentAcceleration) * 5 - (prevState.recentWhPerKm > 0 ? (prevState.recentWhPerKm / 10) : 0);
        newEcoScore = prevState.ecoScore * 0.9995 + currentScore * 0.0005;
    }

    // Update recentWhPerKm
    const currentWhPerKm = instantPower > 0 && newSpeedKmh > 0 ? (instantPower * 1000) / newSpeedKmh : (distanceTraveledKm > 0 ? 0 : prevState.recentWhPerKm);
    const newRecentWhPerKmWindow = [currentWhPerKm, ...prevState.recentWhPerKmWindow].slice(0, 50);
    const newRecentWhPerKm = newRecentWhPerKmWindow.reduce((a, b) => a + b) / newRecentWhPerKmWindow.length;


    const newVehicleState: Partial<VehicleState> = {
      speed: newSpeedKmh,
      odometer: newOdometer,
      tripA: prevState.activeTrip === 'A' ? prevState.tripA + distanceTraveledKm : prevState.tripA,
      tripB: prevState.activeTrip === 'B' ? prevState.tripB + distanceTraveledKm : prevState.tripB,
      power: instantPower,
      batterySOC: newSOC,
      recentWhPerKm: newRecentWhPerKm,
      recentWhPerKmWindow: newRecentWhPerKmWindow,
      lastUpdate: now,
      displaySpeed: prevState.displaySpeed + (newSpeedKmh - prevState.displaySpeed) * 0.1,
      powerHistory: [instantPower, ...prevState.powerHistory].slice(0, 100),
      ecoScore: newEcoScore,
      packSOH: Math.max(70, prevState.packSOH - Math.abs((prevState.batterySOC - newSOC) * 0.000001)),
      equivalentFullCycles: prevState.equivalentFullCycles + Math.abs((prevState.batterySOC - newSOC) / 100),
    };

    if (newOdometer > lastSohHistoryUpdateOdometer.current + 500) {
        lastSohHistoryUpdateOdometer.current = newOdometer;
        const newSohEntry: SohHistoryEntry = {
            odometer: newOdometer,
            cycleCount: newVehicleState.equivalentFullCycles!,
            avgBatteryTemp: prevState.batteryTemp,
            soh: newVehicleState.packSOH,
            ecoPercent: 100, cityPercent: 0, sportsPercent: 0
        };
        newVehicleState.sohHistory = [...prevState.sohHistory, newSohEntry];
    }
    
    setVehicleState(newVehicleState);

    // Throttled AI calls
    if (now > lastFatigueCheckTime.current + 2000) { // Check every 2 seconds
        triggerFatigueCheck(newSpeedKmh, currentAcceleration);
        lastFatigueCheckTime.current = now;
    }

    requestRef.current = requestAnimationFrame(updateVehicleState);
  }, [triggerAcUsageImpact, triggerFatigueCheck, triggerIdlePrediction]);

  useEffect(() => {
    calculateDynamicRange();
  }, [vehicleState.batterySOC, vehicleState.acOn, vehicleState.acTemp, vehicleState.driveMode, vehicleState.passengers, vehicleState.goodsInBoot, vehicleState.outsideTemp, aiState.acUsageImpact, calculateDynamicRange]);
  
  // Trigger AI flows when their relevant inputs change
  useEffect(() => {
    triggerAcUsageImpact();
  }, [vehicleState.acOn, vehicleState.acTemp, vehicleState.outsideTemp, vehicleState.recentWhPerKm, triggerAcUsageImpact]);

  useEffect(() => {
    triggerIdlePrediction();
  }, [vehicleState.acOn, vehicleState.acTemp, vehicleState.outsideTemp, vehicleState.speed, vehicleState.isCharging, triggerIdlePrediction]);


  const isWeatherImpactRunning = useRef(false);

  useEffect(() => {
    const forecast = vehicleState.weatherForecast;
    if (forecast) {
      triggerWeatherImpactForecast(forecast);
    }

    async function triggerWeatherImpactForecast(forecastData: FiveDayForecast | null) {
      if (isWeatherImpactRunning.current || !forecastData) {
        return;
      }
      isWeatherImpactRunning.current = true;
      try {
        const input: GetWeatherImpactInput = {
          currentSOC: vehicleStateRef.current.batterySOC,
          initialRange: vehicleStateRef.current.initialRange,
          forecast: forecastData.list.map(item => ({
            temp: item.main.temp,
            precipitation: item.weather[0].main,
            windSpeed: item.wind.speed,
          })).slice(0, 5)
        };
        const result = await getWeatherImpact(input);
        setAiState({ weatherImpact: result });
      } catch (error) {
        console.error("Error calling getWeatherImpact:", error);
        setAiState({ weatherImpact: null });
      } finally {
          isWeatherImpactRunning.current = false;
      }
    }
  }, [vehicleState.weatherForecast]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key in keys) { e.preventDefault(); keys[e.key] = true; }
      if (e.key.toLowerCase() === 'c') toggleCharging();
      if (e.key === '1') setDriveMode('Eco');
      if (e.key === '2') setDriveMode('City');
      if (e.key === '3') setDriveMode('Sports');
      if (e.key.toLowerCase() === 'a') toggleAC();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key in keys) { e.preventDefault(); keys[e.key] = false; }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    requestRef.current = requestAnimationFrame(updateVehicleState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state: { ...vehicleState, ...aiState },
    setState: setVehicleState,
    setDriveMode,
    toggleAC,
    setAcTemp,
    toggleCharging,
    resetTrip,
    setActiveTrip,
    switchProfile,
    addProfile,
    deleteProfile,
    setPassengers,
    toggleGoodsInBoot,
  };
}

    

    

