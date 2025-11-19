
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
    setVehicleState({ driveMode: mode, driveModeHistory: [mode, ...vehicleStateRef.current.driveModeHistory].slice(0, 10) as DriveMode[] });
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

  const toggleCharging = useCallback(() => {
    setVehicleState(prevState => {
      if (prevState.speed > 0 && !prevState.isCharging) {
        toast({
          title: "Cannot start charging",
          description: "Vehicle must be stationary to start charging.",
          variant: "destructive",
        });
        return prevState;
      }
      
      const isNowCharging = !prevState.isCharging;
      const now = Date.now();
  
      if (isNowCharging) {
        return {
          ...prevState,
          isCharging: true,
          lastChargeLog: {
            startTime: now,
            startSOC: prevState.batterySOC,
          },
        };
      } else {
        const { lastChargeLog, chargingLogs, batterySOC } = prevState;
        if (!lastChargeLog) {
           return { ...prevState, isCharging: false };
        }
  
        const energyAdded = (batterySOC - lastChargeLog.startSOC) / 100 * prevState.packNominalCapacity_kWh;
        const newLog: ChargingLog = {
          startTime: lastChargeLog.startTime,
          endTime: now,
          startSOC: lastChargeLog.startSOC,
          endSOC: batterySOC,
          energyAdded: Math.max(0, energyAdded),
        };
        const newLogs = [...chargingLogs, newLog].slice(-10);
  
        return {
          ...prevState,
          isCharging: false,
          chargingLogs: newLogs,
          lastChargeLog: undefined,
        };
      }
    });
  }, [toast]);

  const resetTrip = () => {
    setVehicleState(prevState => {
        if (prevState.activeTrip === 'A') return { ...prevState, tripA: 0 };
        return { ...prevState, tripB: 0 };
    });
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
    setVehicleState(prevState => {
        if (profileName && prevState.profiles[profileName] && Object.keys(prevState.profiles).length > 1) {
            const newProfiles = { ...prevState.profiles };
            delete newProfiles[profileName];
            
            let nextProfile = prevState.activeProfile;
            if (prevState.activeProfile === profileName) {
                nextProfile = Object.keys(newProfiles)[0];
            }
            toast({ title: `Profile ${profileName} deleted.`});
            // Also switch to the next profile
            return { 
                ...prevState, 
                profiles: newProfiles, 
                activeProfile: nextProfile,
                ...newProfiles[nextProfile]
            };
        }
        return prevState;
    });
  };

  const triggerFatigueCheck = useCallback(async () => {
    const state = vehicleStateRef.current;
    if (state.speed < 10) {
      if (aiStateRef.current.fatigueWarning) {
        setAiState({ fatigueWarning: null });
      }
      return;
    }
    if (state.speedHistory.length < 10) return;

    try {
      const fatigueInput: DriverFatigueInput = {
        speedHistory: state.speedHistory,
        accelerationHistory: state.accelerationHistory,
      };
      const fatigueResult = await monitorDriverFatigue(fatigueInput);
      
      setAiState(prevState => ({
        ...prevState,
        fatigueLevel: fatigueResult.confidence,
        fatigueWarning: fatigueResult.isFatigued ? fatigueResult.reasoning : (fatigueResult.confidence < 0.5 ? null : prevState.fatigueWarning),
      }));

    } catch (error) {
      console.error("Error calling monitorDriverFatigue:", error);
    }
  }, []);
  
  const calculateDynamicRange = useCallback((state: VehicleState, aiState: AiState) => {
    const idealRange = state.initialRange * (state.batterySOC / 100);

    let penaltyPercentage = { ac: 0, load: 0, temp: 0, driveMode: 0 };
    
    if (aiState.acUsageImpact && state.acOn) {
        const acImpactKmPerHour = Math.abs(aiState.acUsageImpact.rangeImpactKm);
        const estimatedDriveHours = state.speed > 0 ? (idealRange / state.speed) : 4;
        const totalAcPenaltyKm = Math.min(acImpactKmPerHour * estimatedDriveHours, idealRange * 0.2); // Cap penalty
        if (idealRange > 0) {
            penaltyPercentage.ac = totalAcPenaltyKm / idealRange;
        }
    }

    const passengerPenalty = (state.passengers - 1) * 0.015;
    const goodsPenalty = state.goodsInBoot ? 0.03 : 0;
    penaltyPercentage.load = passengerPenalty + goodsPenalty;
    
    const outsideTemp = state.outsideTemp || 22;
    if (outsideTemp < 10) {
        penaltyPercentage.temp = (10 - outsideTemp) * 0.01;
    } else if (outsideTemp > 25) {
        penaltyPercentage.temp = (outsideTemp - 25) * 0.007;
    }

    if (state.driveMode === 'City') penaltyPercentage.driveMode = 0.07;
    else if (state.driveMode === 'Sports') penaltyPercentage.driveMode = 0.18;

    const totalPenaltyPercentage = penaltyPercentage.ac + penaltyPercentage.load + penaltyPercentage.temp + penaltyPercentage.driveMode;
    const predictedRange = idealRange * (1 - totalPenaltyPercentage);
    
    const finalPenalties = {
      ac: idealRange * penaltyPercentage.ac,
      load: idealRange * penaltyPercentage.load,
      temp: idealRange * penaltyPercentage.temp,
      driveMode: idealRange * penaltyPercentage.driveMode,
    };
    
    setVehicleState({ range: predictedRange, predictedDynamicRange: predictedRange, rangePenalties: finalPenalties });
  }, []);

  const triggerAcUsageImpact = useCallback(async () => {
    const state = vehicleStateRef.current;
    try {
      const acImpactInput: AcUsageImpactInput = {
        acOn: state.acOn,
        acTemp: state.acTemp,
        outsideTemp: state.outsideTemp,
        recentEfficiency: state.recentWhPerKm > 0 ? state.recentWhPerKm : 160,
      };
      const acImpactResult = await getAcUsageImpact(acImpactInput);
      setAiState({ acUsageImpact: acImpactResult });
    } catch (error) {
      console.error("Error calling getAcUsageImpact:", error);
      setAiState({ acUsageImpact: null });
    }
  }, []);

  const triggerIdlePrediction = useCallback(async () => {
    const state = vehicleStateRef.current;
    if (state.speed > 0 || state.isCharging) return;
    try {
      const drainInput: PredictiveIdleDrainInput = {
        currentBatterySOC: state.batterySOC,
        acOn: state.acOn,
        acTemp: state.acTemp,
        outsideTemp: state.outsideTemp,
        passengers: state.passengers,
        goodsInBoot: state.goodsInBoot,
      };
      const drainResult = await predictIdleDrain(drainInput);
      setAiState(prevState => ({ ...prevState, idleDrainPrediction: drainResult }));
    } catch (error) {
      console.error("Error calling predictIdleDrain:", error);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      triggerAcUsageImpact();
      triggerIdlePrediction();
    }, 5000);

    const fatigueInterval = setInterval(() => {
      triggerFatigueCheck();
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(fatigueInterval);
    };
  }, [triggerAcUsageImpact, triggerIdlePrediction, triggerFatigueCheck]);

  useEffect(() => {
    calculateDynamicRange(vehicleState, aiState);
  }, [vehicleState.batterySOC, vehicleState.acOn, vehicleState.acTemp, vehicleState.driveMode, vehicleState.passengers, vehicleState.goodsInBoot, vehicleState.outsideTemp, aiState.acUsageImpact, calculateDynamicRange]);

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
          currentSOC: vehicleState.batterySOC,
          initialRange: vehicleState.initialRange,
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
  }, [vehicleState.weatherForecast, vehicleState.batterySOC, vehicleState.initialRange]);

  const updateVehicleState = useCallback((prevState: VehicleState): VehicleState => {
    const now = Date.now();
    const timeDelta = (now - prevState.lastUpdate) / 1000;
    if (timeDelta <= 0) return prevState;
    
    if (prevState.isCharging) {
        let newSOC = prevState.batterySOC;
        const chargePerSecond = 1 / 5; // 1% SOC every 5 seconds
        newSOC += chargePerSecond * timeDelta;
        newSOC = Math.min(100, newSOC);
        return {
            ...prevState,
            isCharging: true,
            batterySOC: newSOC,
            lastUpdate: now,
        };
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
    
    const fAero = EV_CONSTANTS.dragCoeff * EV_CONSTANTS.frontalArea_m2 * EV_CONSTANTS.airDensity * Math.pow(speedMs, 2) * 0.5;
    const fRoll = EV_CONSTANTS.rollingResistanceCoeff * EV_CONSTANTS.mass_kg * EV_CONSTANTS.gravity;
    const fInertia = EV_CONSTANTS.mass_kg * currentAcceleration;

    const totalTractiveForce = fAero + fRoll + fInertia;
    let instantPower = (totalTractiveForce * speedMs) / 1000;

    if (instantPower > 0) {
      instantPower /= EV_CONSTANTS.drivetrainEfficiency;
    } else {
      instantPower *= EV_CONSTANTS.regenEfficiency;
    }
    
    if (prevState.acOn) {
        instantPower += EV_CONSTANTS.acPower_kW * (Math.min(1, Math.abs(prevState.acTemp - prevState.outsideTemp) / 10));
    }
    
    if (instantPower > 0) {
        const energyUsedKwh = instantPower * (timeDelta / 3600);
        const socDelta = (energyUsedKwh / prevState.packNominalCapacity_kWh) * 100;
        newSOC -= socDelta;
    }


    newSOC = Math.max(0, Math.min(100, newSOC));
    
    const newOdometer = prevState.odometer + distanceTraveledKm;
    
    const currentWhPerKm = instantPower > 0 && newSpeedKmh > 0 ? (instantPower * 1000) / newSpeedKmh : 0;
    
    let newEcoScore = prevState.ecoScore;
    if (newSpeedKmh > 1 && !prevState.isCharging) {
      const accelPenalty = Math.max(0, currentAcceleration - 1.5) * 2.0;
      const deviation = currentWhPerKm - EV_CONSTANTS.baseConsumption;
      const efficiencyPenalty = Math.max(0, deviation / EV_CONSTANTS.baseConsumption) * 25;
      const currentScore = 100 - accelPenalty - efficiencyPenalty;
      newEcoScore = prevState.ecoScore * 0.99 + Math.max(0, currentScore) * 0.01;
    }


    const newRecentWhPerKmWindow = [currentWhPerKm > 0 ? currentWhPerKm : 160, ...prevState.recentWhPerKmWindow].slice(0, 50);
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
      speedHistory: [newSpeedKmh, ...prevState.speedHistory].slice(0, 10),
      accelerationHistory: [currentAcceleration, ...prevState.accelerationHistory].slice(0, 10),
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
    
    return {...prevState, ...newVehicleState};
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key in keys) { e.preventDefault(); keys[e.key] = true; }
      if (e.key.toLowerCase() === 'c') {
        if (!e.repeat) {
          e.preventDefault();
          toggleCharging();
        }
      }
      if (e.key === '1') setDriveMode('Eco');
      if (e.key === '2') setDriveMode('City');
      if (e.key === '3') setDriveMode('Sports');
      if (e.key.toLowerCase() === 'a') {
        if (!e.repeat) {
            e.preventDefault();
            toggleAC();
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key in keys) { e.preventDefault(); keys[e.key] = false; }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    const tick = () => {
        setVehicleState(updateVehicleState);
        requestRef.current = requestAnimationFrame(tick);
    }
    requestRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [toggleCharging, updateVehicleState]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(position => {
        setVehicleState({
            weather: { ...vehicleState.weather, coord: { lat: position.coords.latitude, lon: position.coords.longitude } } as any,
        })
      });
    }
  }, []);

  useEffect(() => {
    const fetchWeatherData = async () => {
      const lat = vehicleState.weather?.coord?.lat;
      const lon = vehicleState.weather?.coord?.lon;

      if (!lat || !lon) return;
      try {
        const weatherResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}`);
        let weatherData: WeatherData | null = null;
        if (weatherResponse.ok) {
          weatherData = await weatherResponse.json();
        }

        const forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}`);
        let forecastData: FiveDayForecast | null = null;
        if (forecastResponse.ok) {
          forecastData = await forecastResponse.json();
        }
        
        setVehicleState({ 
          weather: weatherData, 
          weatherForecast: forecastData,
          outsideTemp: weatherData?.main.temp || 25 
        });

      } catch (error) {
        console.error("Failed to fetch weather data", error);
      }
    };

    fetchWeatherData();
    const interval = setInterval(fetchWeatherData, 300000);
    return () => clearInterval(interval);
  }, [vehicleState.weather?.coord?.lat, vehicleState.weather?.coord?.lon]);


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
