'use client';

import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import type { VehicleState, VehiclePhysics, DriveMode, Profile, ChargingLog } from '@/lib/types';
import { defaultState, EV_CONSTANTS, MODE_SETTINGS } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import {
  getDrivingRecommendation,
} from '@/ai/flows/adaptive-driving-recommendations';
import { analyzeDrivingStyle } from '@/ai/flows/driver-profiling';
import { predictRange } from '@/ai/flows/predictive-range-estimation';
import { forecastSoh } from '@/ai/flows/soh-forecast-flow';

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
  const physicsRef = useRef<VehiclePhysics>({
    acceleration: 0,
    inertiaFactor: 0.98,
    brakingApplied: false,
    regenActive: false,
    regenPower: 0,
  });

  const callAI = useCallback(async () => {
    if (typeof state.batterySOC !== 'number' || state.batterySOC === null) {
      return;
    }
    try {
      const [rec, style, range, soh] = await Promise.all([
        getDrivingRecommendation({
          drivingStyle: state.drivingStyle,
          predictedRange: state.predictedDynamicRange,
          batterySOC: state.batterySOC,
          acUsage: state.acOn,
          driveMode: state.driveMode,
          outsideTemperature: state.outsideTemp,
        }),
        analyzeDrivingStyle({
          speedHistory: state.speedHistory,
          accelerationHistory: state.accelerationHistory,
          driveModeHistory: state.driveModeHistory as string[],
          ecoScore: state.ecoScore,
        }),
        predictRange({
          drivingStyle: state.drivingStyle,
          climateControlSettings: {
            acUsage: state.acOn ? 100 : 0,
            temperatureSetting: state.acTemp,
          },
          weatherData: {
            temperature: state.weather?.main.temp || 25,
            precipitation: state.weather?.weather[0].main.toLowerCase() || 'sunny',
            windSpeed: state.weather?.wind.speed ? state.weather.wind.speed * 3.6 : 15,
          },
          historicalData: state.speedHistory.map((s, i) => ({
            speed: s,
            powerConsumption: state.powerHistory[i] || 0,
          })),
          batteryCapacity: state.batteryCapacity_kWh,
          currentBatteryLevel: state.batterySOC,
        }),
        forecastSoh({
          historicalData: state.sohHistory.map(h => ({...h, ecoPercent: 0, cityPercent: 0, sportsPercent: 0})),
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
  }, [state.drivingStyle, state.predictedDynamicRange, state.batterySOC, state.acOn, state.driveMode, state.outsideTemp, state.speedHistory, state.accelerationHistory, state.driveModeHistory, state.ecoScore, state.acTemp, state.powerHistory, state.batteryCapacity_kWh, state.sohHistory, state.weather]);


  const updateVehicleState = useCallback(() => {
    const now = Date.now();
    const timeDelta = (now - state.lastUpdate) / 1000;
    if (timeDelta <= 0) {
        requestAnimationFrame(updateVehicleState);
        return;
    }

    let newState: Partial<VehicleState> = { lastUpdate: now };
    const physics = physicsRef.current;
    const modeSettings = MODE_SETTINGS[state.driveMode];

    // --- Acceleration & Speed ---
    let targetAcceleration = 0;
    if (keys.ArrowUp) {
      targetAcceleration = modeSettings.accelRate;
      physics.brakingApplied = false;
      physics.regenActive = false;
    } else if (keys.ArrowDown) {
      targetAcceleration = -modeSettings.brakeRate;
      physics.brakingApplied = true;
      physics.regenActive = false;
    } else {
      // Natural deceleration (inertia + regen)
      physics.brakingApplied = false;
      targetAcceleration = -modeSettings.decelRate;
      physics.regenActive = true;
    }

    if (keys.r) { // Stronger regen
        targetAcceleration -= 10;
        physics.regenActive = true;
    }

    physics.acceleration += (targetAcceleration - physics.acceleration) * 0.1;
    
    let newSpeed = state.speed + physics.acceleration * timeDelta;
    newSpeed *= physics.inertiaFactor;
    newSpeed = Math.max(0, Math.min(modeSettings.maxSpeed, newSpeed));

    // --- Odometer & Trip ---
    const distanceTraveled = (newSpeed * timeDelta) / 3600;
    newState.odometer = (state.odometer || 0) + distanceTraveled;
    if(state.activeTrip === 'A') {
        newState.tripA = (state.tripA || 0) + distanceTraveled;
    } else {
        newState.tripB = (state.tripB || 0) + distanceTraveled;
    }

    // --- Power & Battery ---
    const speed_mps = newSpeed / 3.6;
    const aeroDrag = 0.5 * EV_CONSTANTS.airDensity * EV_CONSTANTS.frontalArea_m2 * EV_CONSTANTS.dragCoeff * Math.pow(speed_mps, 2);
    const rollingResistance = EV_CONSTANTS.rollingResistanceCoeff * EV_CONSTANTS.mass_kg * EV_CONSTANTS.gravity;
    const accelerationForce = EV_CONSTANTS.mass_kg * physics.acceleration;
    const motorForce = aeroDrag + rollingResistance + accelerationForce;
    
    let motorPower_kW = (motorForce * speed_mps) / 1000;

    let acPower_kW = state.acOn ? 0.5 + Math.abs(state.outsideTemp - state.acTemp) * 0.1 : 0;
    let accessoryPower_kW = EV_CONSTANTS.accessoryBase_kW;

    let totalPower_kW = 0;
    let newSOC = state.batterySOC;

    if (state.isCharging) {
        const chargeSocPerSecond = 1.0;
        const socChange = chargeSocPerSecond * timeDelta;
        newSOC += socChange;
        totalPower_kW = -EV_CONSTANTS.chargeRate_kW;
    } else {
        if (physics.regenActive && motorPower_kW < 0) {
            physics.regenPower = Math.min(EV_CONSTANTS.maxRegenPower_kW, Math.abs(motorPower_kW)) * modeSettings.regenEfficiency;
            totalPower_kW = -physics.regenPower;
        } else {
            motorPower_kW = Math.max(0, motorPower_kW); // Power can't be negative if not regenerating
            physics.regenPower = 0;
            let drivingPower = (motorPower_kW / modeSettings.powerFactor) / EV_CONSTANTS.drivetrainEfficiency;
            totalPower_kW = drivingPower + acPower_kW + accessoryPower_kW;
        }
        
        const energyConsumed_kWh = totalPower_kW * (timeDelta / 3600);
        const socChange_percent = (energyConsumed_kWh / state.packNominalCapacity_kWh) * 100;
        newSOC -= socChange_percent;
    }
    
    newSOC = Math.max(0, Math.min(100, newSOC));
    const socChange = newSOC - state.batterySOC;
    newState.batterySOC = newSOC;
    
    // --- History & Other Metrics ---
    const newSpeedHistory = [newSpeed, ...state.speedHistory].slice(0, 50);
    const newAccelerationHistory = [physics.acceleration, ...state.accelerationHistory].slice(0, 50);
    const newPowerHistory = [totalPower_kW, ...state.powerHistory].slice(0,50);
    const newDriveModeHistory = [state.driveMode, ...state.driveModeHistory].slice(0, 50);
    
    const powerForConsumption = Math.max(0, totalPower_kW);
    const currentWhPerKm = newSpeed > 1 ? (powerForConsumption * 1000) / newSpeed : 0;
    
    // Ensure Wh/km doesn't become excessively low or high
    const smoothedWhPerKm = state.recentWhPerKm > 0 ? (state.recentWhPerKm * 49 + (currentWhPerKm > 0 ? currentWhPerKm : state.recentWhPerKm)) / 50 : modeSettings.baseConsumption;
    const newRecentWhPerKm = Math.max(50, Math.min(500, smoothedWhPerKm));

    // --- Range Calculation ---
    const remainingEnergy_kWh = (newSOC / 100) * (state.packNominalCapacity_kWh * state.packUsableFraction) * (state.packSOH / 100);
    const consumption_kWh_per_km = newRecentWhPerKm / 1000;
    const estimatedRange = remainingEnergy_kWh / consumption_kWh_per_km;
    newState.range = Math.max(0, isFinite(estimatedRange) ? estimatedRange : state.range);


    setState({
        ...newState,
        speed: newSpeed,
        power: totalPower_kW,
        displaySpeed: state.displaySpeed + (newSpeed - state.displaySpeed) * 0.1,
        speedHistory: newSpeedHistory,
        accelerationHistory: newAccelerationHistory,
        powerHistory: newPowerHistory,
        driveModeHistory: newDriveModeHistory,
        recentWhPerKm: newRecentWhPerKm,
        ecoScore: state.ecoScore * 0.999 + (100 - Math.abs(physics.acceleration) * 2 - (totalPower_kW > 0 ? totalPower_kW / 10 : 0)) * 0.001,
        packSOH: Math.max(70, state.packSOH - Math.abs(socChange * 0.00001)),
        equivalentFullCycles: state.equivalentFullCycles + Math.abs((state.batterySOC - newSOC) / 100)
    });

    requestAnimationFrame(updateVehicleState);
  }, [state, setState]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key in keys) {
        e.preventDefault();
        keys[e.key] = true;
      }
      if (e.key.toLowerCase() === 'c') toggleCharging();
      if (e.key === '1') setDriveMode('Eco');
      if (e.key === '2') setDriveMode('City');
      if (e.key === '3') setDriveMode('Sports');
      if (e.key.toLowerCase() === 'a') toggleAC();
      if (e.key.toLowerCase() === 'r') keys.r = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key in keys) {
        e.preventDefault();
        keys[e.key] = false;
      }
      if (e.key.toLowerCase() === 'r') keys.r = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const simId = requestAnimationFrame(updateVehicleState);
    const aiTimer = setInterval(callAI, 10000); // Call AI every 10 seconds

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(simId);
      clearInterval(aiTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callAI]);

  const setDriveMode = (mode: DriveMode) => {
    setState({ driveMode: mode });
  };
  
  const toggleAC = () => {
      const isAcOn = !state.acOn;
      const consumption_kWh_per_km = state.recentWhPerKm / 1000;
      const remainingEnergy_kWh = (state.batterySOC / 100) * state.packUsableFraction * state.batteryCapacity_kWh;
      const acPowerDraw_kW = 1.0; // Simplified average A/C power draw
      const rangeLostPerHour_km = acPowerDraw_kW / consumption_kWh_per_km;
      
      let currentRange = state.range;

      if (isAcOn) {
          // Simplified: Assume AC on for an hour, what is the impact? 
          // A better way is to adjust base consumption, which is what we do now in the main loop.
          // This immediate adjustment is for UX feedback.
          const rangeDrop = state.range * 0.10; // 10% drop
          currentRange = Math.max(0, state.range - rangeDrop);
      } else {
          // Re-calculate based on no AC. The main loop will handle this, but we can give an instant boost.
          const rangeGain = state.range / 0.90 - state.range;
          currentRange = state.range + rangeGain;
      }

      setState(prevState => ({ acOn: !prevState.acOn, range: currentRange }));
  };

  const setAcTemp = (temp: number) => setState({ acTemp: temp });
  const toggleCharging = () => {
    if (state.speed > 0 && !state.isCharging) {
        toast({
          title: "Cannot start charging",
          description: "Vehicle must be stationary to start charging.",
          variant: "destructive",
        });
        return;
    }

    const isCharging = !state.isCharging;
    const now = Date.now();
    let newLogs = [...state.chargingLogs];

    if (isCharging) {
      // Start charging
      setState({ 
        isCharging,
        lastChargeLog: {
          startTime: now,
          startSOC: state.batterySOC,
        }
      });
    } else if (state.lastChargeLog) {
      // Stop charging
      const log = state.lastChargeLog;
      const energyAdded = (state.batterySOC - log.startSOC) / 100 * state.packNominalCapacity_kWh;
      const newLog: ChargingLog = {
        startTime: log.startTime,
        endTime: now,
        startSOC: log.startSOC,
        endSOC: state.batterySOC,
        energyAdded: Math.max(0, energyAdded), // Ensure energy added is not negative
      };
      newLogs.push(newLog);
      setState({ 
        isCharging,
        chargingLogs: newLogs.slice(-10), // Keep last 10 logs
        lastChargeLog: undefined,
      });
    }
  };
  const resetTrip = () => {
    if (state.activeTrip === 'A') setState({ tripA: 0 });
    else setState({ tripB: 0 });
  };
  const setActiveTrip = (trip: 'A' | 'B') => setState({ activeTrip: trip });
  const togglePerfMode = () => setState({ stabilizerEnabled: !state.stabilizerEnabled });

  const switchProfile = (profileName: string) => {
    if (state.profiles[profileName]) {
        setState({ 
            activeProfile: profileName,
            ...state.profiles[profileName]
        });
        toast({ title: `Switched to ${profileName}'s profile.`});
    }
  };

  const addProfile = (profileName: string) => {
    if (profileName && !state.profiles[profileName]) {
        const newProfiles = { ...state.profiles, [profileName]: { driveMode: 'Eco', acTemp: 22 } as Profile};
        setState({ profiles: newProfiles });
        toast({ title: `Profile ${profileName} added.`});
    }
  }

  return {
    state,
    setState,
    vehiclePhysics: physicsRef.current,
    setDriveMode,
    toggleAC,
    setAcTemp,
    toggleCharging,
    resetTrip,
    setActiveTrip,
    togglePerfMode,
    switchProfile,
    addProfile
  };
}
