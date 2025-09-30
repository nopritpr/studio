"use client";

import React, { useState, useEffect, useReducer } from 'react';
import { useVehicleSimulation } from '@/hooks/use-vehicle-simulation';
import Header from '@/components/dashboard/header';
import DashboardTab from '@/components/dashboard/tabs/dashboard-tab';
import AnalyticsTab from '@/components/dashboard/tabs/analytics-tab';
import OptimizationTab from '@/components/dashboard/tabs/optimization-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HelpModal from './help-modal';
import ProfileModal from './profile-modal';
import type { WeatherData, FiveDayForecast } from '@/lib/types';
import Weather from './weather';

function stateReducer(state: any, action: any) {
  return { ...state, ...action };
}

export default function Dashboard() {
  const {
    state,
    setState,
    vehiclePhysics,
    setDriveMode,
    toggleAC,
    setAcTemp,
    toggleCharging,
    resetTrip,
    setActiveTrip,
    togglePerfMode,
    switchProfile,
    addProfile
  } = useVehicleSimulation();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isHelpModalOpen, setHelpModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<FiveDayForecast | null>(null);
  const [lng, setLng] = useState(-122.4);
  const [lat, setLat] = useState(37.8);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(position => {
        setLng(position.coords.longitude);
        setLat(position.coords.latitude);
      });
    }
  }, []);

  useEffect(() => {
    const fetchWeatherData = async () => {
      if (!lat || !lng) return;
      try {
        const weatherResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}`);
        if (weatherResponse.ok) {
          const weatherData = await weatherResponse.json();
          setWeather(weatherData);
          setState({ weather: weatherData, outsideTemp: weatherData.main.temp });
        }

        const forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY}`);
        if (forecastResponse.ok) {
          const forecastData = await forecastResponse.json();
          setForecast(forecastData);
        }
      } catch (error) {
        console.error("Failed to fetch weather data", error);
      }
    };

    fetchWeatherData();
    const interval = setInterval(fetchWeatherData, 300000);
    return () => clearInterval(interval);
  }, [lat, lng, setState]);

  const cardProps = {
    state,
    vehiclePhysics,
    setDriveMode,
    toggleAC,
    setAcTemp,
    toggleCharging,
    resetTrip,
    setActiveTrip,
  };

  return (
    <div className="w-full max-w-[1280px] bg-card/50 text-foreground flex flex-col rounded-2xl shadow-2xl overflow-hidden border p-2 sm:p-4 md:p-6 min-h-0 h-full font-body">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onHelpClick={() => setHelpModalOpen(true)}
      />
      <main className="flex-grow pt-4 overflow-hidden min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="hidden">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="optimization">Optimization</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="h-full flex-grow min-h-0 data-[state=inactive]:hidden">
            <DashboardTab
              {...cardProps}
              weather={weather}
              forecast={forecast}
              lat={lat}
              lng={lng}
              onLocationChange={(newLat, newLng) => {
                setLat(newLat);
                setLng(newLng);
              }}
            />
          </TabsContent>
          <TabsContent value="analytics" className="h-full flex-grow min-h-0 data-[state=inactive]:hidden">
            <AnalyticsTab {...cardProps} />
          </TabsContent>
          <TabsContent value="optimization" className="h-full flex-grow min-h-0 data-[state=inactive]:hidden">
            <OptimizationTab
              state={state}
              onProfileSwitchClick={() => setProfileModalOpen(true)}
              onStabilizerToggle={() => setState(prev => ({...prev, stabilizerEnabled: !prev.stabilizerEnabled}))}
            />
          </TabsContent>
        </Tabs>
      </main>
      <HelpModal isOpen={isHelpModalOpen} onOpenChange={setHelpModalOpen} />
      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onOpenChange={setProfileModalOpen}
        profiles={state.profiles}
        activeProfile={state.activeProfile}
        onSwitchProfile={switchProfile}
        onAddProfile={addProfile}
      />
    </div>
  );
}