'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ChargingHabitChart from "../charts/charging-habit-chart";
import type { VehicleState } from "@/lib/types";
import { BatteryCharging, Zap, TrendingUp } from "lucide-react";
import DynamicRangeChart from "../charts/dynamic-range-chart";
import FatigueMonitorGauge from "../charts/fatigue-monitor-gauge";

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
    
    const savings = 0;

    return (
        <div className="h-full grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 min-h-0">
            <Card className="flex flex-col md:row-span-2">
                <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><BatteryCharging className="w-4 h-4"/>Charging Log</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow overflow-y-auto pr-2 min-h-0">
                    {state.chargingLogs.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No charging sessions logged.</p>
                    ) : (
                        <div className="space-y-2">
                        {state.chargingLogs.slice().reverse().map((log, index) => (
                            <div key={index} className="text-xs p-2 rounded-md bg-muted/50">
                                <p><strong>{new Date(log.startTime).toLocaleString()}</strong></p>
                                <p>Duration: {((log.endTime - log.startTime) / 60000).toFixed(1)} mins</p>
                                <p>SOC: {log.startSOC.toFixed(1)}% → {log.endSOC.toFixed(1)}% (+{(log.endSOC - log.startSOC).toFixed(1)}%)</p>
                                <p>Energy: {log.energyAdded.toFixed(2)} kWh</p>
                            </div>
                        ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="flex flex-col">
                <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><Zap className="w-4 h-4"/>Charging Habit</CardTitle>
                    <p className="text-xs text-muted-foreground -mt-2">Clustering model analysis.</p>
                </CardHeader>
                <CardContent>
                    <ChargingHabitChart data={analyzeChargingPatterns()} />
                </CardContent>
            </Card>

            <div className="grid grid-rows-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-headline flex items-center gap-2"><span className="font-bold text-base">₹</span>Cost Savings</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-2xl lg:text-3xl font-bold text-green-400 font-headline">₹{Math.round(savings)}</p>
                        <p className="text-xs text-muted-foreground">vs. ICE car</p>
                    </CardContent>
                </Card>
                 <Card className="flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-headline">Fatigue Monitor</CardTitle>
                        <p className="text-xs text-muted-foreground -mt-2">LSTM Anomaly detection.</p>
                    </CardHeader>
                    <CardContent className="flex-grow flex items-center justify-end">
                        <FatigueMonitorGauge fatigueLevel={state.fatigueLevel} />
                    </CardContent>
                </Card>
            </div>
            
            <Card className="flex flex-col md:col-span-2">
                <CardHeader className="p-4">
                    <h4 className="font-semibold text-sm font-headline flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4" />Dynamic Range Factors</h4>
                    <p className="text-xs text-muted-foreground -mt-2">Regression model analyzing range impact.</p>
                </CardHeader>
                <CardContent className="p-4 pt-0 h-full flex-grow min-h-0">
                    <DynamicRangeChart state={state} />
                </CardContent>
            </Card>
        </div>
    );
