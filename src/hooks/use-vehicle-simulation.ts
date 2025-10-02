
'use client';

import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import type { VehicleState, DriveMode, Profile, ChargingLog, SohHistoryEntry, AiState, PredictiveIdleDrainOutput, AcUsageImpactOutput } from '@/lib/types';
import { defaultState, EV_CONSTANTS, MODE_SETTINGS, defaultAiState } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { getDrivingRecommendation, type DrivingRecommendationInput } from '@/ai/flows/adaptive-driving-recommendations';
import { analyzeDrivingStyle, type AnalyzeDrivingStyleInput } from '@/ai/flows/driver-profiling';
import { predictIdleDrain, type PredictiveIdleDrainInput } from '@/ai/flows/predictive-idle-drain';
import { monitorDriverFatigue, type DriverFatigueInput } from '@/ai/flows/driver-fatigue-monitor';
import { getAcUsageImpact, type AcUsageImpactInput } from '@/ai/flows/ac-usage-impact-forecaster';
import { googleAI } from '@genkit-ai/google-genai';

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
    const idealRange = currentState.initialRange * (currentState.batterySOC / 100);

    const penalties = { ac: 0, load: 0, temp: 0, driveMode: 0 };
    let totalPenaltyFactor = 1;

    if (currentState.acOn) {
      const tempDiffFromOptimal = Math.abs(currentState.acTemp - (currentState.outsideTemp || 22));
      const acFactor = 1.05 + (tempDiffFromOptimal / 10) * 0.05;
      totalPenaltyFactor *= acFactor;
      penalties.ac = idealRange * (1 - 1/acFactor);
    }
    
    const passengerFactor = 1 + (currentState.passengers - 1) * 0.015;
    const goodsFactor = currentState.goodsInBoot ? 1.03 : 1;
    const loadFactor = passengerFactor * goodsFactor;
    if (loadFactor > 1) {
      totalPenaltyFactor *= loadFactor;
      penalties.load = idealRange * (1 - 1/loadFactor);
    }

    const outsideTemp = currentState.outsideTemp || 22;
    const tempDiff = Math.abs(22 - outsideTemp);
    if (tempDiff > 5) {
      const tempFactor = 1 + (tempDiff - 5) * 0.008;
      totalPenaltyFactor *= tempFactor;
      penalties.temp = idealRange * (1 - 1/tempFactor);
    }
    
    let modeFactor = 1;
    if (currentState.driveMode === 'City') modeFactor = 1.07;
    else if (currentState.driveMode === 'Sports') modeFactor = 1.18;
    if (modeFactor > 1) {
      totalPenaltyFactor *= modeFactor;
      penalties.driveMode = idealRange * (1 - 1/modeFactor);
    }
    
    const predictedRange = idealRange / totalPenaltyFactor;
    const totalCalculatedPenalty = penalties.ac + penalties.load + penalties.temp + penalties.driveMode;
    const totalActualPenalty = Math.max(0, idealRange - predictedRange);

    if (totalCalculatedPenalty > 0) {
      const ratio = totalActualPenalty / totalCalculatedPenalty;
      penalties.ac *= ratio;
      penalties.load *= ratio;
      penalties.temp *= ratio;
      penalties.driveMode *= ratio;
    }
    
    setVehicleState({ range: predictedRange, rangePenalties: penalties });
  }, []);

  const isIdlePredictionRunning = useRef(false);
  const triggerIdlePrediction = useCallback(async () => {
    if (isIdlePredictionRunning.current) return;
    isIdlePredictionRunning.current = true;
    
    try {
        const currentState = vehicleStateRef.current;
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
    } finally {
        isIdlePredictionRunning.current = false;
    }
  }, []);


  const isAcImpactRunning = useRef(false);
  const triggerAcImpactForecast = useCallback(async () => {
      if (isAcImpactRunning.current) return;
      isAcImpactRunning.current = true;

      try {
          const currentState = vehicleStateRef.current;
          const acImpactInput: AcUsageImpactInput = {
              acOn: currentState.acOn,
              acTemp: currentState.acTemp,
              outsideTemp: currentState.outsideTemp,
              recentWhPerKm: currentState.recentWhPerKm > 0 ? currentState.recentWhPerKm : 160,
          };
          const acImpactResult = await getAcUsageImpact(acImpactInput);
          setAiState(prevState => ({...prevState, acUsageImpact: acImpactResult }));
      } catch (error) {
          console.error("Error calling getAcUsageImpact:", error);
          setAiState(prevState => ({...prevState, acUsageImpact: null}));
      } finally {
          isAcImpactRunning.current = false;
      }
  }, []);

  const idleStartTimeRef = useRef<number | null>(null);

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
      if (idleStartTimeRef.current === null) {
        idleStartTimeRef.current = now;
      }
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
      
    } else {
       idleStartTimeRef.current = null;
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

    const distanceTraveledKm = newSpeedKmh * (timeDelta / 3600);
    const speed_ms = newSpeedKmh / 3.6;
    const mass_kg_total = EV_CONSTANTS.mass_kg + (prevState.passengers * 70) + (prevState.goodsInBoot ? 50 : 0);
    const F_drag = 0.5 * EV_CONSTANTS.dragCoeff * EV_CONSTANTS.frontalArea_m2 * EV_CONSTANTS.airDensity * Math.pow(speed_ms, 2);
    const F_rolling = EV_CONSTANTS.rollingResistanceCoeff * mass_kg_total * EV_CONSTANTS.gravity;
    const F_acceleration = mass_kg_total * currentAcceleration;
    const F_total = F_drag + F_rolling + F_acceleration;

    let power_motor_kW: number;
    if (F_total > 0) power_motor_kW = (F_total * speed_ms) / (1000 * EV_CONSTANTS.drivetrainEfficiency);
    else power_motor_kW = (F_total * speed_ms * EV_CONSTANTS.regenEfficiency) / 1000;
    
    const ac_power_kW = prevState.acOn ? EV_CONSTANTS.acPower_kW : 0;
    const netPower_kW = power_motor_kW + ac_power_kW;

    if (prevState.isCharging) {
      const chargePerSecond = 1 / 5;
      newSOC += chargePerSecond * timeDelta;
    } else if (!isActuallyIdle) {
      const energyChange_kWh = netPower_kW * (timeDelta / 3600);
      const socChange = (energyChange_kWh / prevState.packNominalCapacity_kWh) * 100;
      newSOC -= socChange;
    }
    newSOC = Math.max(0, Math.min(100, newSOC));
    
    const newOdometer = prevState.odometer + distanceTraveledKm;
    const instantPower = netPower_kW;
    
    let newEcoScore = prevState.ecoScore;
    if (newSpeedKmh > 1 && !prevState.isCharging) {
        const currentScore = 100 - Math.abs(currentAcceleration) * 5 - (prevState.recentWhPerKm > 0 ? (prevState.recentWhPerKm / 10) : 0);
        newEcoScore = prevState.ecoScore * 0.9995 + currentScore * 0.0005;
    }

    const newVehicleState: Partial<VehicleState> = {
      speed: newSpeedKmh,
      odometer: newOdometer,
      tripA: prevState.activeTrip === 'A' ? prevState.tripA + distanceTraveledKm : prevState.tripA,
      tripB: prevState.activeTrip === 'B' ? prevState.tripB + distanceTraveledKm : prevState.tripB,
      power: instantPower,
      batterySOC: newSOC,
      recentWhPerKm: instantPower > 0 && newSpeedKmh > 0 ? (instantPower * 1000) / newSpeedKmh : 0,
      lastUpdate: now,
      displaySpeed: prevState.displaySpeed + (newSpeedKmh - prevState.displaySpeed) * 0.1,
      speedHistory: [newSpeedKmh, ...prevState.speedHistory].slice(0, 100),
      accelerationHistory: [currentAcceleration, ...prevState.accelerationHistory].slice(0, 100),
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
    requestRef.current = requestAnimationFrame(updateVehicleState);
  }, []);

  useEffect(() => {
    calculateDynamicRange();
  }, [vehicleState.batterySOC, vehicleState.acOn, vehicleState.acTemp, vehicleState.driveMode, vehicleState.passengers, vehicleState.goodsInBoot, vehicleState.outsideTemp, calculateDynamicRange]);

  useEffect(() => {
    // Run once on mount
    triggerAcImpactForecast();
    triggerIdlePrediction();

    const aiInterval = setInterval(() => {
      const currentState = vehicleStateRef.current;
      const isIdle = currentState.speed === 0 && !currentState.isCharging;
      
      triggerAcImpactForecast();

      if (isIdle) {
        // Only trigger if it has been idle for a bit
        if (idleStartTimeRef.current && (Date.now() - idleStartTimeRef.current > 3000)) {
            triggerIdlePrediction();
        }
      }
    }, 5000); // Run every 5 seconds

    return () => clearInterval(aiInterval);
  }, [triggerIdlePrediction, triggerAcImpactForecast]);

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
