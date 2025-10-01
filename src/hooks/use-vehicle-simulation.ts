'use client';

import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import type { VehicleState, DriveMode, Profile, ChargingLog, SohHistoryEntry } from '@/lib/types';
import { defaultState, EV_CONSTANTS, MODE_SETTINGS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { getDrivingRecommendation } from '@/ai/flows/adaptive-driving-recommendations';
import { analyzeDrivingStyle } from '@/ai/flows/driver-profiling';
import { predictRange } from '@/ai/flows/predictive-range-estimation';
import { forecastSoh } from '@/ai/flows/soh-forecast-flow';
import { monitorDriverFatigue } from '@/ai/flows/driver-fatigue-monitor';

const keys: Record<string, boolean> = {
  ArrowUp: false,
  ArrowDown: false,
  r: false,
};

function stateReducer(state: VehicleState, action: Partial<VehicleState>): VehicleState {
  return { ...state, ...action };
}

export function useVehicleSimulation() {
  const [state, setState] = useReducer(stateReducer, defaultState);
  const { toast } = useToast();
  
  const accelerationRef = useRef<number>(0);
  const requestRef = useRef<number>();
  const stateRef = useRef<VehicleState>(state);
  const lastAiCall = useRef(0);
  const lastFatigueCheck = useRef(0);
  const lastSohHistoryUpdateOdometer = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const callFatigueMonitor = useCallback(async () => {
    const currentState = stateRef.current;
    if (Date.now() - lastFatigueCheck.current < 20000) return; 
    if (currentState.speed < 10) { 
        if (currentState.fatigueWarning) setState({ fatigueWarning: null });
        return;
    };

    lastFatigueCheck.current = Date.now();

    try {
        const fatigueResult = await monitorDriverFatigue({
            speedHistory: currentState.speedHistory.slice(0, 60), 
            accelerationHistory: currentState.accelerationHistory.slice(0, 60),
            harshBrakingEvents: currentState.styleMetrics.harshBrakes,
            harshAccelerationEvents: currentState.styleMetrics.harshAccel,
        });

        if (fatigueResult.isFatigued && fatigueResult.confidence > 0.7) {
            setState({ fatigueWarning: fatigueResult.reasoning });
            setState({ styleMetrics: { ...currentState.styleMetrics, harshBrakes: 0, harshAccel: 0 } });
        } else {
            if (currentState.fatigueWarning) {
                setState({ fatigueWarning: null });
            }
        }
    } catch (error) {
        console.error('Fatigue Monitor AI Flow error:', error);
    }
  }, []);

  const callAI = useCallback(async () => {
    if (Date.now() - lastAiCall.current < 10000) return;
    lastAiCall.current = Date.now();

    const currentState = stateRef.current;
    if (typeof currentState.batterySOC !== 'number' || currentState.batterySOC === null) {
      return;
    }
    try {
      const [rec, style, range, soh] = await Promise.all([
        getDrivingRecommendation({
          drivingStyle: currentState.drivingStyle,
          predictedRange: currentState.predictedDynamicRange,
          batterySOC: currentState.batterySOC,
          acUsage: currentState.acOn,
          driveMode: currentState.driveMode,
          outsideTemperature: currentState.outsideTemp,
        }),
        analyzeDrivingStyle({
          speedHistory: currentState.speedHistory,
          accelerationHistory: currentState.accelerationHistory,
          driveModeHistory: currentState.driveModeHistory as string[],
          ecoScore: currentState.ecoScore,
        }),
        predictRange({
          drivingStyle: currentState.drivingStyle,
          climateControlSettings: {
            acUsage: currentState.acOn ? 100 : 0,
            temperatureSetting: currentState.acTemp,
          },
          weatherData: {
            temperature: currentState.weather?.main.temp || 25,
            precipitation: currentState.weather?.weather[0].main.toLowerCase() || 'sunny',
            windSpeed: currentState.weather?.wind.speed ? currentState.weather.wind.speed * 3.6 : 15,
          },
          historicalData: currentState.speedHistory.map((s, i) => ({
            speed: s,
            powerConsumption: currentState.powerHistory[i] || 0,
          })),
          batteryCapacity: currentState.batteryCapacity_kWh,
          currentBatteryLevel: currentState.batterySOC,
        }),
        forecastSoh({
          historicalData: currentState.sohHistory.length > 0 ? currentState.sohHistory : [{
              odometer: currentState.odometer,
              cycleCount: currentState.equivalentFullCycles,
              avgBatteryTemp: currentState.batteryTemp,
              ecoPercent: 100, cityPercent: 0, sportsPercent: 0
          }],
        }),
      ]);

      setState({
        drivingRecommendation: rec.recommendation,
        drivingStyle: style.drivingStyle,
        drivingStyleRecommendations: style.recommendations,
        predictedDynamicRange: range.estimatedRange,
        sohForecast: soh,
      });

    } catch (error) {
      console.error('AI Flow error:', error);
    }
  }, []);

  const setDriveMode = (mode: DriveMode) => {
    setState({ driveMode: mode });
  };


  const toggleAC = () => {
     setState({ acOn: !stateRef.current.acOn });
  };

  const setAcTemp = (temp: number) => {
    setState({ acTemp: temp });
  }

  const setPassengers = (count: number) => {
    setState({ passengers: count });
  };

  const toggleGoodsInBoot = () => {
    setState({ goodsInBoot: !stateRef.current.goodsInBoot });
  };

  const toggleCharging = () => {
    const currentState = stateRef.current;
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
      // Start charging
      setState({
        isCharging,
        lastChargeLog: {
          startTime: now,
          startSOC: currentState.batterySOC,
        }
      });
    } else if (currentState.lastChargeLog) {
      // Stop charging
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
      setState({
        isCharging,
        chargingLogs: newLogs.slice(-10),
        lastChargeLog: undefined,
      });
    }
  };
  const resetTrip = () => {
    const currentState = stateRef.current;
    if (currentState.activeTrip === 'A') setState({ tripA: 0 });
    else setState({ tripB: 0 });
  };
  const setActiveTrip = (trip: 'A' | 'B') => setState({ activeTrip: trip });
  const togglePerfMode = () => setState({ stabilizerEnabled: !stateRef.current.stabilizerEnabled });

  const switchProfile = (profileName: string) => {
    const currentState = stateRef.current;
    if (currentState.profiles[profileName]) {
        setState({
            activeProfile: profileName,
            ...currentState.profiles[profileName]
        });
        toast({ title: `Switched to ${profileName}'s profile.`});
    }
  };

  const addProfile = (profileName: string) => {
    const currentState = stateRef.current;
    if (profileName && !currentState.profiles[profileName]) {
        const newProfiles = { ...currentState.profiles, [profileName]: { driveMode: 'Eco', acTemp: 22 } as Profile};
        setState({ profiles: newProfiles });
        toast({ title: `Profile ${profileName} added.`});
    }
  }

  const deleteProfile = (profileName: string) => {
    const currentState = stateRef.current;
    if (profileName && currentState.profiles[profileName] && Object.keys(currentState.profiles).length > 1) {
        const newProfiles = { ...currentState.profiles };
        delete newProfiles[profileName];
        
        let nextProfile = currentState.activeProfile;
        if (currentState.activeProfile === profileName) {
            nextProfile = Object.keys(newProfiles)[0];
        }

        setState({ profiles: newProfiles });
        switchProfile(nextProfile);
        toast({ title: `Profile ${profileName} deleted.`});
    }
  };

  const updateVehicleState = useCallback(() => {
    const prevState = stateRef.current;
    const now = Date.now();
    const timeDelta = (now - prevState.lastUpdate) / 1000;
    if (timeDelta <= 0) {
      requestRef.current = requestAnimationFrame(updateVehicleState);
      return;
    }
    
    const modeSettings = MODE_SETTINGS[prevState.driveMode];
    let currentAcceleration = accelerationRef.current;

    let targetAcceleration = 0;
    if (keys.ArrowUp) {
      targetAcceleration = modeSettings.accelRate;
    } else if (keys.ArrowDown) {
      targetAcceleration = -modeSettings.brakeRate;
    } else if (keys.r) {
      targetAcceleration = -modeSettings.strongRegenBrakeRate;
    } else if (prevState.speed > 0) {
      // Gentle deceleration (one-pedal driving feel)
      targetAcceleration = -EV_CONSTANTS.gentleRegenBrakeRate;
    }

    currentAcceleration += (targetAcceleration - currentAcceleration) * 0.1;
    accelerationRef.current = currentAcceleration;

    let newSpeedKmh = prevState.speed + currentAcceleration * timeDelta * 3.6;
    newSpeedKmh = Math.max(0, newSpeedKmh);
    newSpeedKmh = Math.min(newSpeedKmh, modeSettings.maxSpeed);

    const distanceTraveledKm = (newSpeedKmh / 3600) * timeDelta;
    
    // --- Energy Consumption ---
    let consumptionWhPerKm = EV_CONSTANTS.baseConsumption;

    if (prevState.driveMode === 'City') consumptionWhPerKm *= 1.15;
    if (prevState.driveMode === 'Sports') consumptionWhPerKm *= 1.30;
    
    consumptionWhPerKm *= (1 + Math.pow(newSpeedKmh / 80, 2));

    const weightPenalty = ((prevState.passengers - 1) * 0.05) + (prevState.goodsInBoot ? 0.08 : 0);
    consumptionWhPerKm *= (1 + weightPenalty);

    if (prevState.acOn) {
      consumptionWhPerKm *= 1.10;
    }
    
    // Regenerative Braking
    let energyRegeneratedWh = 0;
    if (currentAcceleration < -0.1 && newSpeedKmh > 1) { // Threshold for regen
        const regenPower_W = Math.abs(currentAcceleration * newSpeedKmh * EV_CONSTANTS.regenEfficiency);
        energyRegeneratedWh = (regenPower_W * timeDelta) / 3600;
    }

    const energyConsumedWh = consumptionWhPerKm * distanceTraveledKm;
    const netEnergyConsumedWh = energyConsumedWh - energyRegeneratedWh;
    
    let newSOC = prevState.batterySOC;
    if (!prevState.isCharging) {
      const socChange = (netEnergyConsumedWh / (prevState.packNominalCapacity_kWh * 1000)) * 100;
      newSOC -= socChange;
    } else {
       const chargeSocPerSecond = (EV_CONSTANTS.chargeRate_kW / prevState.packNominalCapacity_kWh) * 100 / 3600;
       newSOC += chargeSocPerSecond * timeDelta;
       newSOC = Math.min(100, newSOC);
    }
    newSOC = Math.max(0, newSOC);
    
    // --- Range Calculation ---
    const newWhPerKmWindow = [...prevState.recentWhPerKmWindow, consumptionWhPerKm];
    if (newWhPerKmWindow.length > 50) newWhPerKmWindow.shift();
    const smoothedWhPerKm = newWhPerKmWindow.reduce((a, b) => a + b, 0) / newWhPerKmWindow.length;
    const remainingEnergy_kWh = (newSOC / 100) * prevState.packUsableFraction * prevState.packNominalCapacity_kWh;
    const newRange = smoothedWhPerKm > 10 ? remainingEnergy_kWh / (smoothedWhPerKm / 1000) : prevState.range;

    const newOdometer = prevState.odometer + distanceTraveledKm;

    const newState: Partial<VehicleState> = {
      speed: newSpeedKmh,
      odometer: newOdometer,
      tripA: prevState.activeTrip === 'A' ? prevState.tripA + distanceTraveledKm : prevState.tripA,
      tripB: prevState.activeTrip === 'B' ? prevState.tripB + distanceTraveledKm : prevState.tripB,
      power: (netEnergyConsumedWh / 1000) / (timeDelta / 3600), // Instantaneous power in kW
      batterySOC: newSOC,
      range: newRange,
      recentWhPerKm: smoothedWhPerKm,
      recentWhPerKmWindow: newWhPerKmWindow,
      lastUpdate: now,
      displaySpeed: prevState.displaySpeed + (newSpeedKmh - prevState.displaySpeed) * 0.1,
      speedHistory: [newSpeedKmh, ...prevState.speedHistory].slice(0, 100),
      accelerationHistory: [currentAcceleration, ...prevState.accelerationHistory].slice(0, 100),
      powerHistory: [(netEnergyConsumedWh / 1000), ...prevState.powerHistory].slice(0, 100),
      driveModeHistory: [prevState.driveMode, ...prevState.driveModeHistory].slice(0, 50) as DriveMode[],
      ecoScore: prevState.ecoScore * 0.9995 + (100 - Math.abs(currentAcceleration) * 5 - (consumptionWhPerKm > 0 ? (consumptionWhPerKm / 10) : 0)) * 0.0005,
      packSOH: Math.max(70, prevState.packSOH - Math.abs((prevState.batterySOC - newSOC) * 0.000001)),
      equivalentFullCycles: prevState.equivalentFullCycles + Math.abs((prevState.batterySOC - newSOC) / 100),
    };

    if (newOdometer > lastSohHistoryUpdateOdometer.current + 50) {
        lastSohHistoryUpdateOdometer.current = newOdometer;
        const newSohEntry: SohHistoryEntry = {
            odometer: newOdometer,
            cycleCount: newState.equivalentFullCycles!,
            avgBatteryTemp: prevState.batteryTemp,
            soh: newState.packSOH,
            ecoPercent: 100, // Placeholder
            cityPercent: 0,
            sportsPercent: 0
        };
        newState.sohHistory = [...prevState.sohHistory, newSohEntry].slice(-20);
    }
    
    setState(newState);
    requestRef.current = requestAnimationFrame(updateVehicleState);
  }, []);

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
    
    setDriveMode(defaultState.driveMode);

    requestRef.current = requestAnimationFrame(updateVehicleState);
    const aiTimer = setInterval(callAI, 10000);
    const fatigueTimer = setInterval(callFatigueMonitor, 5000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      clearInterval(aiTimer);
      clearInterval(fatigueTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    setState,
    setDriveMode,
    toggleAC,
    setAcTemp,
    toggleCharging,
    resetTrip,
    setActiveTrip,
    togglePerfMode,
    switchProfile,
    addProfile,
    deleteProfile,
    setPassengers,
    toggleGoodsInBoot,
  };
}
