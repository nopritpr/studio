'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ChargingHabitChart from "../charts/charging-habit-chart";
import type { VehicleState } from "@/lib/types";
import { Clock, Route, Zap, TrendingUp, HeartPulse, Thermometer, BatteryCharging, DollarSign } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface AnalyticsTabProps {
    state: VehicleState;
}

export default function AnalyticsTab({ state }: AnalyticsTabProps) {

    const analyzeChargingPatterns = () => {
        const patterns = { Night: 0, Morning: 0, Afternoon: 0, Evening: 0, Weekend: 0 };
        if (!state.chargingLogs || state.chargingLogs.length === 0) {
            return [20, 20, 20, 20, 20];
        }
        state.chargingLogs.forEach(log => {
            const date = new Date(log.startTime);
            const hour = date.getHours();
            const day = date.getDay();

            if (hour >= 0 && hour < 6) patterns.Night++;
            else if (hour >= 6 && hour < 12) patterns.Morning++;
            else if (hour >= 12 && hour < 18) patterns.Afternoon++;
            else patterns.Evening++;

            if (day === 0 || day === 6) patterns.Weekend++;
        });
        
        const total = state.chargingLogs.length;
        if (total === 0) return [0, 0, 0, 0, 0];
        
        return [
            (patterns.Morning / total) * 100,
            (patterns.Afternoon / total) * 100,
            (patterns.Evening / total) * 100,
            (patterns.Night / total) * 100,
            (patterns.Weekend / total) * 100,
        ];
    }
    
    const savings = state.odometer * (5 - 2);

    return (
        <div className="h-full grid grid-cols-5 grid-rows-2 gap-4 min-h-0">
            <Card className="col-span-5 md:col-span-2 row-span-2 flex flex-col">
                <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><BatteryCharging className="w-4 h-4"/>Charging Log</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow overflow-y-auto pr-2 min-h-0">
                    {state.chargingLogs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No charging sessions logged.</p>
                    ) : (
                        <div className="space-y-2">
                           {state.chargingLogs.map((log, index) => (
                             <div key={index} className="text-xs p-2 rounded-md bg-muted/50">
                                <p><strong>{new Date(log.startTime).toLocaleString()}</strong></p>
                                <p>Duration: {((log.endTime - log.startTime) / 3600000).toFixed(1)} hrs</p>
                                <p>SOC: {log.startSOC.toFixed(1)}% → {log.endSOC.toFixed(1)}%</p>
                                <p>Energy: {log.energyAdded.toFixed(2)} kWh</p>
                            </div>
                           ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="col-span-5 md:col-span-3 row-span-1 flex flex-col">
                <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><Zap className="w-4 h-4"/>Charging Habit Analysis</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center">
                    <ChargingHabitChart data={analyzeChargingPatterns()} />
                </CardContent>
            </Card>
            
            <Card className="col-span-5 md:col-span-1 row-span-1">
                <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><DollarSign className="w-4 h-4"/>Cost Savings</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-4xl font-bold text-green-400 font-headline">₹{Math.round(savings)}</p>
                    <p className="text-xs text-muted-foreground">vs. gasoline car</p>
                </CardContent>
            </Card>

            <Card className="col-span-5 md:col-span-2 row-span-1 p-4 flex flex-col justify-between">
               <div className="space-y-1">
                    <h4 className="font-semibold text-xs flex items-center gap-1 text-muted-foreground"><HeartPulse className="w-3 h-3" />Battery Health</h4>
                    <ul className="text-xs space-y-1">
                        <li>SOH: <span className="font-mono font-semibold">{state.packSOH.toFixed(1)} %</span></li>
                        <li>Cycles: <span className="font-mono font-semibold">{state.equivalentFullCycles.toFixed(1)}</span></li>
                        <li>Capacity: <span className="font-mono font-semibold">{(state.packNominalCapacity_kWh * state.packSOH / 100).toFixed(1)} kWh</span></li>
                    </ul>
                </div>
                 <div className="space-y-1">
                    <h4 className="font-semibold text-xs flex items-center gap-1 text-muted-foreground"><Thermometer className="w-3 h-3" />Thermal Status</h4>
                    <ul className="text-xs space-y-1">
                        <li>Battery: <span className="font-mono font-semibold">{state.batteryTemp.toFixed(1)} °C</span></li>
                        <li>Cabin: <span className="font-mono font-semibold">{state.insideTemp.toFixed(1)} °C</span></li>
                        <li>Regen Limit: <span className="font-mono font-semibold">{(state.regenLimitFactor * 100).toFixed(0)}%</span></li>
                    </ul>
                </div>
            </Card>

            <Card className="p-4 col-span-5 md:col-span-3 -mt-16">
              <h3 className="font-semibold mb-1 text-sm font-headline flex items-center gap-2"><TrendingUp className="w-4 h-4" />Battery & Range</h3>
              <div className="relative w-full h-4 bg-muted rounded-full overflow-hidden mb-2">
                  <Progress value={state.batterySOC} className="h-4" />
                  {state.isCharging && <div className="absolute inset-0 w-full h-full bg-[linear-gradient(90deg,hsla(0,0%,100%,.1)_25%,transparent_25%)] bg-[length:1rem_1rem] animate-charge-shine" />}
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
