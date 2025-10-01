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
  const stateRef = useRef<VehicleState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const callAI = useCallback(async () => {
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

  const updateVehicleState = useCallback(() => {
    const prevState = stateRef.current;
    const now = Date.now();
    const timeDelta = (now - prevState.lastUpdate) / 1000;
    if (timeDelta <= 0) {
      requestRef.current = requestAnimationFrame(updateVehicleState);
      return;
    }


    let newState: Partial<VehicleState> = {};
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
    const aeroDragForce = 0.5 * EV_CONSTANTS.airDensity * EV_CONSTANTS.frontalArea_m2 * EV_CONSTANTS.dragCoeff * Math.pow(speed_mps, 2);
    const rollingResistanceForce = EV_CONSTANTS.rollingResistanceCoeff * EV_CONSTANTS.mass_kg * EV_CONSTANTS.gravity;
    
    const drivingForce = aeroDragForce + rollingResistanceForce;
    const drivingPower_kW = (drivingForce * speed_mps) / 1000;
    let motorPower_kW = (drivingPower_kW / EV_CONSTANTS.drivetrainEfficiency);

    let accelerationPower_kW = (EV_CONSTANTS.mass_kg * physics.acceleration * speed_mps) / 1000;
    
    let acPower_kW = prevState.acOn ? 0.5 + Math.abs(prevState.outsideTemp - prevState.acTemp) * 0.1 : 0;
    let accessoryPower_kW = EV_CONSTANTS.accessoryBase_kW;

    let totalPower_kW = 0;
    let newSOC = prevState.batterySOC;

    if (prevState.isCharging) {
        const chargeSocPerSecond = (EV_CONSTANTS.chargeRate_kW / prevState.packNominalCapacity_kWh) * 100 / 3600;
        const socChange = chargeSocPerSecond * timeDelta;
        newSOC += socChange;
        totalPower_kW = -EV_CONSTANTS.chargeRate_kW;
    } else {
        if (physics.regenActive && accelerationPower_kW < 0 && newSpeed > 1) {
            physics.regenPower = Math.min(EV_CONSTANTS.maxRegenPower_kW, Math.abs(accelerationPower_kW)) * modeSettings.regenEfficiency;
            totalPower_kW = -physics.regenPower;
        } else {
            physics.regenPower = 0;
            let drivingAndAccelPower = (motorPower_kW + Math.max(0, accelerationPower_kW)) / modeSettings.powerFactor;
            totalPower_kW = drivingAndAccelPower + acPower_kW + accessoryPower_kW;
        }
        
        const energyConsumed_kWh = totalPower_kW * (timeDelta / 3600);
        const socChange_percent = (energyConsumed_kWh / prevState.packNominalCapacity_kWh) * 100;
        newSOC -= socChange_percent;
    }
    
    newSOC = Math.max(0, Math.min(100, newSOC));
    const socChange = newSOC - prevState.batterySOC;
    newState.batterySOC = newSOC;
    
    newState.power = totalPower_kW;

    // More stable Wh/km calculation
    const powerForConsumption = Math.max(0, totalPower_kW);
    const currentWhPerKm = newSpeed > 1 ? (powerForConsumption * 1000) / newSpeed : 0;
    
    // Use a window for smoothing
    const newWindow = [...prevState.recentWhPerKmWindow, currentWhPerKm].slice(-20); // Average over last 20 frames
    newState.recentWhPerKmWindow = newWindow;
    const avgWhPerKm = newWindow.reduce((a, b) => a + b, 0) / newWindow.length;
    
    const smoothedWhPerKm = newWindow.length < 20 
        ? modeSettings.baseConsumption 
        : avgWhPerKm;

    newState.recentWhPerKm = Math.max(50, Math.min(500, smoothedWhPerKm));

    // Range calculation based on smoothed efficiency
    const remainingEnergy_kWh = (newSOC / 100) * (prevState.packNominalCapacity_kWh * prevState.packUsableFraction) * (prevState.packSOH / 100);
    const consumption = newState.recentWhPerKm > 0 ? newState.recentWhPerKm : modeSettings.baseConsumption;
    const estimatedRange = remainingEnergy_kWh / (consumption / 1000);
    newState.range = Math.max(0, isFinite(estimatedRange) ? estimatedRange : 0);
    

    const finalStateChanges: Partial<VehicleState> = {
        ...newState,
        lastUpdate: now,
        displaySpeed: prevState.displaySpeed + (newSpeed - prevState.displaySpeed) * 0.1,
        speedHistory: [newSpeed, ...prevState.speedHistory].slice(0, 50),
        accelerationHistory: [physics.acceleration, ...prevState.accelerationHistory].slice(0, 50),
        powerHistory: [totalPower_kW, ...prevState.powerHistory].slice(0,50),
        driveModeHistory: [prevState.driveMode, ...prevState.driveModeHistory].slice(0, 50) as DriveMode[],
        ecoScore: prevState.ecoScore * 0.999 + (100 - Math.abs(physics.acceleration) * 2 - (totalPower_kW > 0 ? totalPower_kW / 10 : 0)) * 0.001,
        packSOH: Math.max(70, prevState.packSOH - Math.abs(socChange * 0.00001)),
        equivalentFullCycles: prevState.equivalentFullCycles + Math.abs((prevState.batterySOC - newSOC) / 100),
    };
    
    setState(finalStateChanges);
    
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
  }, []);

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
