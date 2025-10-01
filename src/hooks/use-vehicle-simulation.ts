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
  const requestRef = useRef<number>();

  const callAI = useCallback(async () => {
    if (typeof state.batterySOC !== 'number' || state.batterySOC === null) {
      return;
    }
    try {
      const currentState = { ...state };

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
          historicalData: currentState.sohHistory.map(h => ({...h, ecoPercent: 0, cityPercent: 0, sportsPercent: 0})),
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
  }, [state]);

  const setDriveMode = (mode: DriveMode) => {
    setState({ driveMode: mode });
  };
  
  const toggleAC = () => {
     setState({ acOn: !state.acOn });
  };

  const setAcTemp = (temp: number) => {
    setState({ acTemp: temp });
  }
  
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

  const updateVehicleState = useCallback(() => {
    setState(prevState => {
        const now = Date.now();
        const timeDelta = (now - prevState.lastUpdate) / 1000;
        if (timeDelta <= 0) return prevState;

        let newState: Partial<VehicleState> = { lastUpdate: now };
        const physics = physicsRef.current;
        const modeSettings = MODE_SETTINGS[prevState.driveMode];

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
          physics.brakingApplied = false;
          targetAcceleration = -modeSettings.decelRate;
          physics.regenActive = true;
        }

        if (keys.r) {
            targetAcceleration -= 10;
            physics.regenActive = true;
        }

        physics.acceleration += (targetAcceleration - physics.acceleration) * 0.1;
        
        let newSpeed = prevState.speed + physics.acceleration * timeDelta;
        newSpeed *= physics.inertiaFactor;
        newSpeed = Math.max(0, Math.min(modeSettings.maxSpeed, newSpeed));
        newState.speed = newSpeed;

        const distanceTraveled = (newSpeed * timeDelta) / 3600;
        newState.odometer = (prevState.odometer || 0) + distanceTraveled;
        if(prevState.activeTrip === 'A') {
            newState.tripA = (prevState.tripA || 0) + distanceTraveled;
        } else {
            newState.tripB = (prevState.tripB || 0) + distanceTraveled;
        }

        const speed_mps = newSpeed / 3.6;
        const aeroDrag = 0.5 * EV_CONSTANTS.airDensity * EV_CONSTANTS.frontalArea_m2 * EV_CONSTANTS.dragCoeff * Math.pow(speed_mps, 2);
        const rollingResistance = EV_CONSTANTS.rollingResistanceCoeff * EV_CONSTANTS.mass_kg * EV_CONSTANTS.gravity;
        const accelerationForce = EV_CONSTANTS.mass_kg * physics.acceleration;
        const motorForce = aeroDrag + rollingResistance + accelerationForce;
        
        let motorPower_kW = (motorForce * speed_mps) / 1000;
        let acPower_kW = prevState.acOn ? 0.5 + Math.abs(prevState.outsideTemp - prevState.acTemp) * 0.1 : 0;
        let accessoryPower_kW = EV_CONSTANTS.accessoryBase_kW;

        let totalPower_kW = 0;
        let newSOC = prevState.batterySOC;

        if (prevState.isCharging) {
            const chargeSocPerSecond = 1.0;
            const socChange = chargeSocPerSecond * timeDelta;
            newSOC += socChange;
            totalPower_kW = -EV_CONSTANTS.chargeRate_kW;
        } else {
            if (physics.regenActive && motorPower_kW < 0 && newSpeed > 1) {
                physics.regenPower = Math.min(EV_CONSTANTS.maxRegenPower_kW, Math.abs(motorPower_kW)) * modeSettings.regenEfficiency;
                totalPower_kW = -physics.regenPower;
            } else {
                motorPower_kW = Math.max(0, motorPower_kW);
                physics.regenPower = 0;
                let drivingPower = (motorPower_kW / modeSettings.powerFactor) / EV_CONSTANTS.drivetrainEfficiency;
                totalPower_kW = drivingPower + acPower_kW + accessoryPower_kW;
            }
             totalPower_kW = Math.max(accessoryPower_kW, totalPower_kW);
            
            const energyConsumed_kWh = totalPower_kW * (timeDelta / 3600);
            const socChange_percent = (energyConsumed_kWh / prevState.packNominalCapacity_kWh) * 100;
            newSOC -= socChange_percent;
        }
        
        newSOC = Math.max(0, Math.min(100, newSOC));
        const socChange = newSOC - prevState.batterySOC;
        newState.batterySOC = newSOC;
        
        newState.power = totalPower_kW;
        const powerForConsumption = Math.max(0, totalPower_kW);
        const currentWhPerKm = newSpeed > 1 ? (powerForConsumption * 1000) / newSpeed : 0;
        
        const smoothedWhPerKm = prevState.recentWhPerKm > 0 ? (prevState.recentWhPerKm * 49 + (currentWhPerKm > 0 ? currentWhPerKm : prevState.recentWhPerKm)) / 50 : modeSettings.baseConsumption;
        newState.recentWhPerKm = Math.max(50, Math.min(500, smoothedWhPerKm));

        let estimatedRange = 0;
        const remainingEnergy_kWh = (newSOC / 100) * (prevState.packNominalCapacity_kWh * prevState.packUsableFraction) * (prevState.packSOH / 100);
        
        let consumption = smoothedWhPerKm > 0 ? smoothedWhPerKm : modeSettings.baseConsumption;

        if (prevState.acOn) {
            consumption *= 1.10;
        }

        estimatedRange = remainingEnergy_kWh / (consumption / 1000);
        newState.range = Math.max(0, isFinite(estimatedRange) ? estimatedRange : 0);

        const finalState = {...prevState, ...newState};

        return {
            ...finalState,
            displaySpeed: prevState.displaySpeed + (newSpeed - prevState.displaySpeed) * 0.1,
            speedHistory: [newSpeed, ...prevState.speedHistory].slice(0, 50),
            accelerationHistory: [physics.acceleration, ...prevState.accelerationHistory].slice(0, 50),
            powerHistory: [totalPower_kW, ...prevState.powerHistory].slice(0,50),
            driveModeHistory: [prevState.driveMode, ...prevState.driveModeHistory].slice(0, 50) as DriveMode[],
            ecoScore: prevState.ecoScore * 0.999 + (100 - Math.abs(physics.acceleration) * 2 - (totalPower_kW > 0 ? totalPower_kW / 10 : 0)) * 0.001,
            packSOH: Math.max(70, prevState.packSOH - Math.abs(socChange * 0.00001)),
            equivalentFullCycles: prevState.equivalentFullCycles + Math.abs((prevState.batterySOC - newSOC) / 100),
        };
    });
    requestRef.current = requestAnimationFrame(updateVehicleState);
  }, []);

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

    requestRef.current = requestAnimationFrame(updateVehicleState);
    const aiTimer = setInterval(callAI, 10000);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      clearInterval(aiTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callAI, updateVehicleState]);

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
