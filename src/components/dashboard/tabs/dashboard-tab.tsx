
'use client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import Image from "next/image";
import SpeedGauge from "../charts/speed-gauge";
import { cn } from "@/lib/utils";
import type { VehicleState, DriveMode, WeatherData, FiveDayForecast, AiState } from "@/lib/types";
import { MODE_SETTINGS } from "@/lib/constants";
import NavigationMap from '../navigation-map';
import Weather from '../weather';
import { useToast } from "@/hooks/use-toast";
import React, { useState, useEffect } from 'react';
import { Users, Package, HelpCircle } from 'lucide-react';
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface DashboardTabProps {
  state: VehicleState;
  setVehicleState: React.Dispatch<React.SetStateAction<Partial<VehicleState & AiState>>>;
  setDriveMode: (mode: DriveMode) => void;
  toggleAC: () => void;
  setAcTemp: (temp: number) => void;
  toggleCharging: () => void;
  resetTrip: () => void;
  setActiveTrip: (trip: 'A' | 'B') => void;
  setPassengers: (count: number) => void;
  toggleGoodsInBoot: () => void;
}

export default function DashboardTab({
  state,
  setVehicleState,
  setDriveMode,
  toggleAC,
  setAcTemp,
  toggleCharging,
  resetTrip,
  setActiveTrip,
  setPassengers,
  toggleGoodsInBoot,
}: DashboardTabProps) {
  const { toast } = useToast();
  
  const lat = state.weather?.coord?.lat || 37.8;
  const lng = state.weather?.coord?.lon || -122.4;

  const handleLocationChange = (newLat: number, newLng: number) => {
    setVehicleState(prevState => ({
      ...prevState,
      weather: {
        ...prevState.weather,
        coord: { lat: newLat, lon: newLng }
      } as any
    }));
  };

  const handleChargingToggle = () => {
    if (state.speed > 0 && !state.isCharging) {
      toast({
        title: "Cannot start charging",
        description: "Vehicle must be stationary to start charging.",
        variant: "destructive",
      });
      return;
    }
    toggleCharging();
  };

  return (
    <div className="h-full grid grid-cols-12 gap-4 min-h-0">
      {/* Left Column */}
      <div className="col-span-12 md:col-span-3 flex flex-col gap-4 min-h-0">
        <Card className="p-4 flex flex-col">
          <h3 className="font-semibold mb-2 text-sm font-headline">Drive Mode</h3>
          <div className="grid grid-cols-3 gap-2">
            {(['Eco', 'City', 'Sports'] as DriveMode[]).map((mode) => (
              <Button
                key={mode}
                onClick={() => setDriveMode(mode)}
                variant={state.driveMode === mode ? 'default' : 'outline'}
                className={cn("flex-col h-16 transition-all relative",
                  state.driveMode === mode && 'text-primary-foreground',
                  state.driveMode === 'Eco' && mode === 'Eco' && 'bg-green-600 hover:bg-green-700 border-green-600',
                  state.driveMode === 'City' && mode === 'City' && 'bg-blue-600 hover:bg-blue-700 border-blue-600',
                  state.driveMode === 'Sports' && mode === 'Sports' && 'bg-red-600 hover:bg-red-700 border-red-600',
                )}
              >
                <span className="font-bold">{mode.toUpperCase()}</span>
                <span className="text-xs opacity-80">{MODE_SETTINGS[mode].maxSpeed}km/h</span>
              </Button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <label htmlFor="charging-toggle" className={cn("text-sm", state.speed > 0 && "text-muted-foreground")}>Charging Connected</label>
            <Switch
              id="charging-toggle"
              checked={state.isCharging}
              onCheckedChange={handleChargingToggle}
              disabled={state.speed > 0 && !state.isCharging}
            />
          </div>
        </Card>

        <Card className="p-4">
            <h3 className="font-semibold mb-2 text-sm font-headline">Trip Info</h3>
            <div className="space-y-2 text-xs">
                <p className="flex justify-between items-center"><span>Odometer:</span> <span className="font-mono font-semibold">{state.odometer.toFixed(1)} km</span></p>
                <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                    <Button size="xs" variant={state.activeTrip === 'A' ? 'secondary' : 'ghost'} onClick={() => setActiveTrip('A')}>Trip A</Button>
                    <Button size="xs" variant={state.activeTrip === 'B' ? 'secondary' : 'ghost'} onClick={() => setActiveTrip('B')}>Trip B</Button>
                </div>
                <span className="font-mono font-semibold">{(state.activeTrip === 'A' ? state.tripA : state.tripB).toFixed(1)} km</span>
                <Button variant="link" size="xs" className="text-destructive" onClick={resetTrip}>Reset</Button>
                </div>
                 <div className="space-y-3 pt-3 mt-2 border-t">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-xs"><Users size={14}/> Passengers</Label>
                        <div className="flex items-center gap-1.5">
                            <Button size="xs" variant="outline" className="h-6 w-6 p-0" onClick={() => setPassengers(Math.max(1, state.passengers - 1))}>-</Button>
                            <span className="font-mono font-semibold text-xs w-4 text-center">{state.passengers}</span>
                            <Button size="xs" variant="outline" className="h-6 w-6 p-0" onClick={() => setPassengers(Math.min(7, state.passengers + 1))}>+</Button>
                        </div>
                    </div>
                     <div className="flex items-center justify-between">
                        <Label htmlFor="goods-toggle" className="flex items-center gap-2 text-xs"><Package size={14}/> Goods in Boot</Label>
                        <Switch id="goods-toggle" checked={state.goodsInBoot} onCheckedChange={toggleGoodsInBoot} />
                    </div>
                </div>
                <p className="flex justify-between items-center pt-2 border-t">
                <span>Power:</span>
                <span className={cn("font-mono font-semibold", state.power < 0 && "text-regen-green")}>
                    {state.power.toFixed(1)} kW
                </span>
                </p>
                <p className="flex justify-between items-center">
                <span>Efficiency:</span>
                <span className="font-mono font-semibold">
                    {state.speed > 1 && isFinite(state.recentWhPerKm) && state.recentWhPerKm > 0 ? Math.round(state.recentWhPerKm) : '--'} Wh/km
                </span>
                </p>
            </div>
        </Card>


        <Card className="p-4 flex flex-col flex-grow min-h-0">
          <h3 className="font-semibold mb-3 text-sm font-headline">Climate</h3>
          <div className="flex-grow flex flex-col justify-between gap-4 py-2">
            <div className="flex items-center justify-between w-full">
              <p className="text-sm font-medium">A/C</p>
              <Switch checked={state.acOn} onCheckedChange={toggleAC} />
            </div>
            <div className="text-center flex-1 flex flex-col items-center justify-center">
              <p className="text-5xl font-bold font-headline mb-1">{state.acTemp}°C</p>
              <p className={cn("text-xs font-bold uppercase", state.acOn ? 'text-primary' : 'text-muted-foreground')}>
                {state.acOn ? 'ON' : 'OFF'}
              </p>
            </div>
            <div className="w-full px-2">
              <Slider
                value={[state.acTemp]}
                onValueChange={([v]) => setAcTemp(v)}
                min={18} max={28} step={1}
                disabled={!state.acOn}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Center Column */}
      <Card className="col-span-12 md:col-span-6 p-4 flex flex-col relative min-h-0">
        <NavigationMap lat={lat} lng={lng} onLocationChange={handleLocationChange} />
      </Card>

      {/* Right Column */}
      <div className="col-span-12 md:col-span-3 flex flex-col gap-4 min-h-0">
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-2 sm:p-4 h-full flex flex-col items-center justify-center relative overflow-hidden min-h-32 bg-secondary/50 dark:bg-muted/30">
            <div
              className={cn(
                'road-animation absolute inset-0 w-full h-full bg-no-repeat bg-center bg-cover',
                state.speed > 1 && 'animate-road-scroll'
              )}
              style={{
                '--speed-duration': `${Math.max(0.2, 3 - state.speed / 40)}s`,
              } as React.CSSProperties}
            ></div>
            <Image
              src="https://e7.pngegg.com/pngimages/978/928/png-clipart-red-sedan-car-door-car-seat-top-view-motor-vehicle-red-car-top-view-orange-car-seat-thumbnail.png"
              alt="EV Car"
              width={200}
              height={200}
              className={cn('relative z-10 w-[128px] h-auto transition-transform duration-500 ease-out mix-blend-multiply dark:mix-blend-normal', state.speed > 1 && 'animate-car-drive')}
              style={{
                filter: 'drop-shadow(0 10px 8px rgba(0,0,0,0.4))',
              }}
            />
          </Card>
          <Card className="p-0 sm:p-2 h-full flex flex-col items-center justify-center relative min-h-32">
            <SpeedGauge speed={state.displaySpeed} driveMode={state.driveMode} />
          </Card>
        </div>

        <div className="flex-grow min-h-0">
          <Weather weather={state.weather} forecast={state.weatherForecast} />
        </div>

        <Card className="p-4">
          <CardHeader className="p-0">
            <h3 className="font-semibold mb-1 text-sm font-headline">Battery & Range</h3>
          </CardHeader>
          <CardContent className="p-0">
            <div className="relative w-full h-4 bg-muted rounded-full overflow-hidden mb-2">
                <Progress value={state.batterySOC} className="h-4" />
                {state.isCharging && <div className="absolute inset-0 w-full h-full bg-[linear-gradient(90deg,hsla(0,0%,100%,.1)_25%,transparent_25%)] bg-[length:1rem_1rem] animate-charge-shine" />}
            </div>
            <div className="flex justify-between items-end mt-1 text-base font-semibold">
                <span className="text-lg">{state.batterySOC.toFixed(1)}%</span>
                <div className="text-right">
                    <span className="font-semibold text-lg">{Math.round(state.range)} km</span>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
