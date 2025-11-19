
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

const initialState: VehicleState = {
    ...defaultState,
    odometer: 0,
    sohHistory: [],
};

export function useVehicleSimulation() {
  const [vehicleState, setVehicleState] = useState<VehicleState & AiState>({ ...initialState, ...defaultAiState});

  const { toast } = useToast();
  
  const stateRef = useRef(vehicleState);
  useEffect(() => {
    stateRef.current = vehicleState;
  }, [vehicleState]);

  const setDriveMode = useCallback((mode: DriveMode) => {
    setVehicleState(prevState => ({ ...prevState, driveMode: mode, driveModeHistory: [mode, ...prevState.driveModeHistory].slice(0, 10) as DriveMode[] }));
  }, []);

  const toggleAC = useCallback(() => {
     setVehicleState(prevState => ({ ...prevState, acOn: !prevState.acOn }));
  }, []);

  const setAcTemp = useCallback((temp: number) => {
    setVehicleState(prevState => ({ ...prevState, acTemp: temp }));
  }, []);

  const setPassengers = useCallback((count: number) => {
    setVehicleState(prevState => ({ ...prevState, passengers: count }));
  }, []);

  const toggleGoodsInBoot = useCallback(() => {
    setVehicleState(prevState => ({ ...prevState, goodsInBoot: !prevState.goodsInBoot }));
  }, []);

  const toggleCharging = useCallback(() => {
    setVehicleState(prevState => {
        const isNowCharging = !prevState.isCharging;
        const now = Date.now();
    
        if (isNowCharging) {
            // This is handled in the UI, but as a safeguard.
            if (prevState.speed > 0) {
              return prevState;
            }
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
  }, []);

  const resetTrip = useCallback(() => {
    setVehicleState(prevState => {
        if (prevState.activeTrip === 'A') return { ...prevState, tripA: 0 };
        return { ...prevState, tripB: 0 };
    });
  }, []);

  const setActiveTrip = useCallback((trip: 'A' | 'B') => setVehicleState(prevState => ({...prevState, activeTrip: trip})), []);

  const switchProfile = useCallback((profileName: string) => {
    setVehicleState(prevState => {
      if (prevState.profiles[profileName]) {
          toast({ title: `Switched to ${profileName}'s profile.`});
          return {
              ...prevState,
              activeProfile: profileName,
              ...prevState.profiles[profileName]
          };
      }
      return prevState;
    });
  }, [toast]);

  const addProfile = useCallback((profileName: string, profileDetails: Omit<Profile, 'driveMode' | 'acTemp'>) => {
    setVehicleState(prevState => {
      if (profileName && !prevState.profiles[profileName]) {
          const newProfile: Profile = {
              ...profileDetails,
              driveMode: 'Eco',
              acTemp: 22,
          };
          toast({ title: `Profile ${profileName} added.`});
          return { ...prevState, profiles: { ...prevState.profiles, [profileName]: newProfile } };
      }
      return prevState;
    });
  }, [toast]);

  const deleteProfile = useCallback((profileName: string) => {
    setVehicleState(prevState => {
        if (profileName && prevState.profiles[profileName] && Object.keys(prevState.profiles).length > 1) {
            const newProfiles = { ...prevState.profiles };
            delete newProfiles[profileName];
            
            let nextProfile = prevState.activeProfile;
            if (prevState.activeProfile === profileName) {
                nextProfile = Object.keys(newProfiles)[0];
            }
            toast({ title: `Profile ${profileName} deleted.`});
            
            return { 
                ...prevState, 
                profiles: newProfiles, 
                activeProfile: nextProfile,
                ...newProfiles[nextProfile]
            };
        }
        return prevState;
    });
  }, [toast]);

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
    
    return { range: predictedRange, predictedDynamicRange: predictedRange, rangePenalties: finalPenalties };
  }, []);

  const updateVehicleState = useCallback((prevState: VehicleState & AiState): VehicleState & AiState => {
    const now = Date.now();
    const timeDelta = (now - prevState.lastUpdate) / 1000;
    
    if (prevState.isCharging) {
        let newSOC = prevState.batterySOC;
        const chargePerSecond = 1 / 5; // 1% SOC every 5 seconds
        newSOC += chargePerSecond * timeDelta;
        newSOC = Math.min(100, newSOC);
        const rangeUpdates = calculateDynamicRange(prevState, prevState);
        return {
            ...prevState,
            batterySOC: newSOC,
            lastUpdate: now,
            ...rangeUpdates
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
    
    let currentAcceleration = prevState.accelerationHistory[0] || 0;

    let targetAcceleration = 0;
    if (keys.ArrowUp) targetAcceleration = modeSettings.accelRate;
    else if (keys.ArrowDown) targetAcceleration = -modeSettings.brakeRate;
    else if (keys.r) targetAcceleration = -modeSettings.strongRegenBrakeRate;
    else if (prevState.speed > 0) targetAcceleration = -EV_CONSTANTS.gentleRegenBrakeRate;

    currentAcceleration += (targetAcceleration - currentAcceleration) * 0.1;
    
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
    
    const energyUsedKwh = instantPower * (timeDelta / 3600);
    const socDelta = (energyUsedKwh / prevState.packNominalCapacity_kWh) * 100;
    newSOC -= socDelta;

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

    const rangeUpdates = calculateDynamicRange(prevState, prevState);

    const newVehicleState: Partial<VehicleState & AiState> = {
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
      ...rangeUpdates
    };
    
    if (newOdometer > (prevState.sohHistory[prevState.sohHistory.length - 1]?.odometer || 0) + 500) {
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
  }, [calculateDynamicRange]);


  // Keyboard controls
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
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [toggleCharging, setDriveMode, toggleAC]);

  const triggerAcUsageImpact = useCallback(async () => {
      const state = stateRef.current;
      try {
        const acImpactInput: AcUsageImpactInput = {
          acOn: state.acOn,
          acTemp: state.acTemp,
          outsideTemp: state.outsideTemp,
          recentEfficiency: state.recentWhPerKm > 0 ? state.recentWhPerKm : 160,
        };
        const acImpactResult = await getAcUsageImpact(acImpactInput);
        setVehicleState(prevState => ({ ...prevState, acUsageImpact: acImpactResult }));
      } catch (error) {
        console.error("Error calling getAcUsageImpact:", error);
        setVehicleState(prevState => ({ ...prevState, acUsageImpact: null }));
      }
  }, []);

  const triggerIdlePrediction = useCallback(async () => {
      const state = stateRef.current;
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
        setVehicleState(prevState => ({ ...prevState, idleDrainPrediction: drainResult }));
      } catch (error) {
        console.error("Error calling predictIdleDrain:", error);
      }
  }, []);
  
  const triggerFatigueCheck = useCallback(() => {
    const state = stateRef.current;
    if (state.speed < 10) {
        if (state.fatigueWarning) {
          setVehicleState(prevState => ({ ...prevState, fatigueWarning: null, fatigueLevel: 0 }));
        }
        return;
    }
    if (state.speedHistory.length < 10) return;

    const fatigueInput: DriverFatigueInput = {
        speedHistory: state.speedHistory,
        accelerationHistory: state.accelerationHistory,
    };

    monitorDriverFatigue(fatigueInput)
      .then(fatigueResult => {
        setVehicleState(prevState => ({
          ...prevState,
          fatigueLevel: fatigueResult.confidence,
          fatigueWarning: fatigueResult.isFatigued ? fatigueResult.reasoning : (fatigueResult.confidence < 0.5 ? null : prevState.fatigueWarning),
        }));
      })
      .catch(error => {
        console.error("Error calling monitorDriverFatigue:", error);
      });
  }, []);

  const fetchWeatherData = useCallback(async (lat: number, lon: number) => {
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
      
      setVehicleState(prevState => ({
        ...prevState,
        weather: weatherData,
        weatherForecast: forecastData,
        outsideTemp: weatherData?.main.temp ?? prevState.outsideTemp,
      }));

    } catch (error) {
      console.error("Failed to fetch weather data", error);
    }
  }, []);

  const triggerWeatherImpactForecast = useCallback(async (forecastData: FiveDayForecast | null) => {
    if (!forecastData) {
      return;
    }
    try {
      const state = stateRef.current;
      const input: GetWeatherImpactInput = {
        currentSOC: state.batterySOC,
        initialRange: state.initialRange,
        forecast: forecastData.list.map(item => ({
          temp: item.main.temp,
          precipitation: item.weather[0].main,
          windSpeed: item.wind.speed,
        })).slice(0, 5)
      };
      const result = await getWeatherImpact(input);
      setVehicleState(prevState => ({ ...prevState, weatherImpact: result }));
    } catch (error) {
      console.error("Error calling getWeatherImpact:", error);
      setVehicleState(prevState => ({ ...prevState, weatherImpact: null }));
    }
  }, []);

  // Animation loop
  useEffect(() => {
    let requestRef: number;
    const tick = () => {
      setVehicleState(prevState => updateVehicleState(prevState));
      requestRef = requestAnimationFrame(tick);
    };
    requestRef = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(requestRef);
  }, [updateVehicleState]);


  // AI and external data fetching timers
  useEffect(() => {
    const aiInterval = setInterval(() => {
      triggerAcUsageImpact();
      triggerIdlePrediction();
    }, 5000);

    const fatigueInterval = setInterval(triggerFatigueCheck, 2000);

    const weatherInterval = setInterval(() => {
        const { lat, lon } = stateRef.current.weather?.coord || {};
        if (lat && lon) {
            fetchWeatherData(lat, lon);
        }
    }, 300000);

    return () => {
        clearInterval(aiInterval);
        clearInterval(fatigueInterval);
        clearInterval(weatherInterval);
    };
  }, [triggerAcUsageImpact, triggerIdlePrediction, triggerFatigueCheck, fetchWeatherData]);

  // Initial Geolocation and Weather Fetch
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude } = position.coords;
        setVehicleState(prevState => ({
            ...prevState,
            weather: { ...prevState.weather, coord: { lat: latitude, lon: longitude } } as any,
        }));
        fetchWeatherData(latitude, longitude);
      }, (error) => {
        console.error("Geolocation error:", error);
        // Fallback to default location if user denies permission
        const defaultLat = 37.8;
        const defaultLon = -122.4;
        setVehicleState(prevState => ({
          ...prevState,
          weather: { ...prevState.weather, coord: { lat: defaultLat, lon: defaultLon } } as any,
        }));
        fetchWeatherData(defaultLat, defaultLon);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  useEffect(() => {
    const forecast = stateRef.current.weatherForecast;
    if (forecast) {
      triggerWeatherImpactForecast(forecast);
    }
  }, [stateRef.current.weatherForecast, triggerWeatherImpactForecast]);
  

  return {
    state: vehicleState,
    setVehicleState: setVehicleState as React.Dispatch<React.SetStateAction<Partial<VehicleState & AiState>>>,
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

    

    