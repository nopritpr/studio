'use client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import Image from "next/image";
import SpeedGauge from "../charts/speed-gauge";
import { cn } from "@/lib/utils";
import type { VehicleState, DriveMode, VehiclePhysics } from "@/lib/types";
import { Sun, Wind, Droplets, CloudRain } from "lucide-react";
import { MODE_SETTINGS } from "@/lib/constants";

interface DashboardTabProps {
  state: VehicleState;
  vehiclePhysics: VehiclePhysics;
  setDriveMode: (mode: DriveMode) => void;
  toggleAC: () => void;
  setAcTemp: (temp: number) => void;
  toggleCharging: () => void;
  resetTrip: () => void;
  setActiveTrip: (trip: 'A' | 'B') => void;
}

export default function DashboardTab({
  state,
  vehiclePhysics,
  setDriveMode,
  toggleAC,
  setAcTemp,
  toggleCharging,
  resetTrip,
  setActiveTrip,
}: DashboardTabProps) {

  return (
    <div className="h-full grid grid-cols-12 grid-rows-6 gap-4 min-h-0">
      {/* Left Column */}
      <Card className="col-span-12 md:col-span-3 row-span-2 md:row-span-3 p-4 flex flex-col">
        <h3 className="font-semibold mb-2 text-sm font-headline">Drive Mode</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['Eco', 'City', 'Sports'] as DriveMode[]).map((mode) => (
            <Button
              key={mode}
              onClick={() => setDriveMode(mode)}
              variant={state.driveMode === mode ? 'default' : 'outline'}
              className={cn("flex-col h-16 transition-all relative",
                state.driveMode === mode && 'text-white',
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
          <label htmlFor="charging-toggle" className="text-sm">Charging Connected</label>
          <Switch id="charging-toggle" checked={state.isCharging} onCheckedChange={toggleCharging} />
        </div>
      </Card>

      <Card className="col-span-12 md:col-span-3 row-span-4 md:row-span-3 p-4 flex flex-col">
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

      {/* Center Column */}
      <Card className="col-span-12 md:col-span-6 row-span-3 md:row-span-6 p-4 flex flex-col">
        <h3 className="font-semibold mb-2 text-sm font-headline">Navigation</h3>
        <div className="flex-1 min-h-0 rounded-md bg-muted overflow-hidden">
          <Image
            src="https://picsum.photos/seed/map1/1200/800"
            alt="Map placeholder"
            width={1200}
            height={800}
            className="w-full h-full object-cover"
            data-ai-hint="city map"
          />
        </div>
      </Card>

      {/* Right Column */}
      <div className="col-span-12 md:col-span-3 row-span-3 md:row-span-2 grid grid-cols-2 gap-4">
        <Card className="p-2 sm:p-4 h-full flex flex-col items-center justify-end relative overflow-hidden">
          <div className={cn("road-background absolute inset-0 bg-[repeating-linear-gradient(theme(colors.muted),theme(colors.muted)_10px,theme(colors.secondary)_10px,theme(colors.secondary)_20px)] dark:bg-[repeating-linear-gradient(#4c4f5a,#4c4f5a_10px,#3c3e47_10px,#3c3e47_20px)] bg-[200%_200%]", state.speed > 1 && "animate-road-scroll")}></div>
           <Image
              src="https://assets.codepen.io/285131/ev-car-2.png"
              alt="EV Car"
              width={200}
              height={100}
              className="relative z-10 w-[95%] h-auto drop-shadow-2xl"
              style={{ filter: 'drop-shadow(0 10px 8px rgba(0,0,0,0.4))' }}
            />
        </Card>
        <Card className="p-0 sm:p-2 h-full flex flex-col items-center justify-center relative">
          <SpeedGauge speed={state.speed} maxSpeed={MODE_SETTINGS[state.driveMode].maxSpeed} />
        </Card>
      </div>

      <Card className="col-span-6 md:col-span-3 row-span-2 md:row-span-2 p-4">
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
          <p className="flex justify-between items-center pt-1 border-t">
            <span>Power:</span>
            <span className={cn("font-mono font-semibold", state.power < 0 && "text-regen-green")}>
              {state.power.toFixed(1)} kW
            </span>
          </p>
           <p className="flex justify-between items-center">
            <span>Efficiency:</span>
            <span className="font-mono font-semibold">
              {state.speed > 0 && isFinite(state.efficiency) ? Math.round(state.efficiency) : '--'} Wh/km
            </span>
          </p>
        </div>
      </Card>
      
      <Card className="col-span-6 md:col-span-3 row-span-2 p-4">
        <h3 className="font-semibold mb-1 text-sm font-headline">Battery & Range</h3>
        <div className="relative w-full h-4 bg-muted rounded-full overflow-hidden mb-2">
            <Progress value={state.batterySOC} className="h-4" />
        </div>
        <div className="flex justify-between items-end mt-1 text-base font-semibold">
            <span className="text-lg">{state.batterySOC.toFixed(1)}%</span>
            <div className="text-right">
                <span className="font-semibold text-lg">{Math.round( (state.packSOH/100) * state.packUsableFraction * state.batteryCapacity_kWh / (state.recentWhPerKm > 0 ? state.recentWhPerKm/1000 : 0.18) * (state.batterySOC/100) )} km</span>
                <p className="text-xs text-primary font-normal" title="Based on driving style, temperature, and usage patterns">AI: {Math.round(state.predictedDynamicRange)} km</p>
            </div>
        </div>
      </Card>
    </div>
  );
}

// Button "xs" size variant
declare module "@/components/ui/button" {
  interface ButtonProps {
    size?: "default" | "sm" | "lg" | "icon" | "xs";
  }
}
