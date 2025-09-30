'use client';

import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import type { VehicleState, VehiclePhysics, DriveMode, Profile } from '@/lib/types';
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
    if (typeof state.batterySOC !== 'number') {
      return; // Don't call AI if state is not ready
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
            temperature: state.outsideTemp,
            precipitation: 'sunny',
            windSpeed: 15,
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
      toast({
        variant: 'destructive',
        title: 'AI Service Error',
        description: 'Could not connect to AI services.',
      });
    }
  }, [state.drivingStyle, state.predictedDynamicRange, state.batterySOC, state.acOn, state.driveMode, state.outsideTemp, state.speedHistory, state.accelerationHistory, state.driveModeHistory, state.ecoScore, state.acTemp, state.powerHistory, state.batteryCapacity_kWh, state.sohHistory, toast]);


  const updateVehicleState = useCallback(() => {
    const now = Date.now();
    const timeDelta = (now - state.lastUpdate) / 1000;
    if (timeDelta <= 0) return;

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
    const aeroDrag = 0.5 * EV_CONSTANTS.airDensity * EV_CONSTANTS.frontalArea_m2 * EV_CONSTANTS.dragCoeff * Math.pow(newSpeed / 3.6, 2);
    const rollingResistance = EV_CONSTANTS.rollingResistanceCoeff * EV_CONSTANTS.mass_kg * EV_CONSTANTS.gravity;
    const motorForce = aeroDrag + rollingResistance + (EV_CONSTANTS.mass_kg * physics.acceleration);
    let motorPower_kW = (motorForce * (newSpeed / 3.6)) / 1000;

    let acPower_kW = state.acOn ? 0.5 + Math.abs(state.outsideTemp - state.acTemp) * 0.1 : 0;
    let accessoryPower_kW = EV_CONSTANTS.accessoryBase_kW;

    let totalPower_kW = 0;

    if (physics.regenActive && motorPower_kW < 0 && !state.isCharging) {
        physics.regenPower = Math.min(EV_CONSTANTS.maxRegenPower_kW, Math.abs(motorPower_kW)) * modeSettings.regenEfficiency;
        totalPower_kW = -physics.regenPower;
    } else if (!state.isCharging) {
        physics.regenPower = 0;
        motorPower_kW = Math.max(0, motorPower_kW);
        totalPower_kW = (motorPower_kW * modeSettings.powerFactor) / EV_CONSTANTS.drivetrainEfficiency + acPower_kW + accessoryPower_kW;
    }

    const energyConsumed_kWh = totalPower_kW * (timeDelta / 3600);
    const socChange = (energyConsumed_kWh / state.packNominalCapacity_kWh) * 100;
    
    let newSOC = state.batterySOC - socChange;

    if (state.isCharging) {
        const chargeRate_kW = 3.3; // Level 2 charging
        const chargeEnergy_kWh = chargeRate_kW * (timeDelta / 3600);
        const chargeSocChange = (chargeEnergy_kWh / state.packNominalCapacity_kWh) * 100;
        newSOC += chargeSocChange;
        totalPower_kW = -chargeRate_kW;
    }
    
    newSOC = Math.max(0, Math.min(100, newSOC));
    newState.batterySOC = newSOC;

    // --- History & Other Metrics ---
    const newSpeedHistory = [newSpeed, ...state.speedHistory].slice(0, 50);
    const newAccelerationHistory = [physics.acceleration, ...state.accelerationHistory].slice(0, 50);
    const newPowerHistory = [totalPower_kW, ...state.powerHistory].slice(0,50);
    const newDriveModeHistory = [state.driveMode, ...state.driveModeHistory].slice(0, 50);
    const newWhPerKm = totalPower_kW > 0 ? (totalPower_kW * 1000) / newSpeed : 0;

    setState({
        ...newState,
        speed: newSpeed,
        power: totalPower_kW,
        efficiency: isFinite(newWhPerKm) ? newWhPerKm : 0,
        displaySpeed: state.displaySpeed + (newSpeed - state.displaySpeed) * 0.1,
        speedHistory: newSpeedHistory,
        accelerationHistory: newAccelerationHistory,
        powerHistory: newPowerHistory,
        driveModeHistory: newDriveModeHistory,
        ecoScore: state.ecoScore * 0.99 + (100 - Math.abs(physics.acceleration) * 2 - (totalPower_kW > 0 ? totalPower_kW / 10 : 0)) * 0.01,
        packSOH: Math.max(70, state.packSOH - Math.abs(socChange * 0.00001)),
        equivalentFullCycles: state.equivalentFullCycles + Math.abs(socChange / 100)
    });

    requestAnimationFrame(updateVehicleState);
  }, [state, setState]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key in keys) keys[e.key] = true;
      if (e.key === 'c') toggleCharging();
      if (e.key === '1') setDriveMode('Eco');
      if (e.key === '2') setDriveMode('City');
      if (e.key === '3') setDriveMode('Sports');
      if (e.key === 'a') toggleAC();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key in keys) keys[e.key] = false;
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
  }, [updateVehicleState, callAI]);

  const setDriveMode = (mode: DriveMode) => {
    setState({ driveMode: mode });
    toast({ title: `Switched to ${mode} mode` });
  };
  
  const toggleAC = () => setState({ acOn: !state.acOn });
  const setAcTemp = (temp: number) => setState({ acTemp: temp });
  const toggleCharging = () => {
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
      newLogs.push({
        ...log,
        endTime: now,
        endSOC: state.batterySOC,
        energyAdded,
      });
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
