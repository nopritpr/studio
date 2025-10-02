
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EcoScoreGauge from "../charts/eco-score-gauge";
import type { VehicleState, AiState, GetWeatherImpactOutput } from "@/lib/types";
import { Leaf, User, BrainCircuit, BarChart, Wind, CloudSun, CloudRain, Snowflake, TrendingDown, Thermometer } from "lucide-react";
import IdleDrainChart from "../charts/idle-drain-chart";
import { Skeleton } from "@/components/ui/skeleton";

interface OptimizationTabProps {
    state: VehicleState & AiState;
    onProfileSwitchClick: () => void;
    onStabilizerToggle: () => void;
}

const ProfileDetail = ({ label, value }: { label: string, value: string | number | undefined }) => (
    <div className="flex justify-between items-center text-xs py-1.5 border-b border-border/50">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{value || 'N/A'}</span>
    </div>
);

const AcImpactDisplay = ({ impact, recommendation }: { impact: number, recommendation: string }) => {
  const isGain = impact > 0;
  const displayValue = Math.abs(impact).toFixed(1);
  const colorClass = isGain ? "text-green-400" : "text-destructive";

  return (
    <div className="p-3 rounded-lg flex flex-col items-center justify-center text-center gap-1 bg-muted/50 border border-border/50 h-full">
       <div className="flex items-center gap-2 text-primary">
            <Wind size={16} />
            <h5 className="font-semibold text-foreground">A/C Impact</h5>
       </div>
       <p className="text-xs text-muted-foreground -mt-1 mb-2">Predicted range change in the next hour.</p>
       <p className={`text-3xl font-bold font-headline ${colorClass}`}>
        {isGain ? '+' : '-'}{displayValue} km
       </p>
       <p className="text-xs text-muted-foreground leading-snug">{recommendation}</p>
    </div>
  );
};

const WeatherImpactIcon = ({ reason }: { reason: string }) => {
    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('snow')) return <Snowflake className="w-5 h-5 text-blue-300" />;
    if (lowerReason.includes('rain')) return <CloudRain className="w-5 h-5 text-blue-400" />;
    if (lowerReason.includes('cold')) return <Thermometer className="w-5 h-5 text-blue-500" />;
    if (lowerReason.includes('hot')) return <Thermometer className="w-5 h-5 text-red-500" />;
    if (lowerReason.includes('wind')) return <Wind className="w-5 h-5 text-gray-400" />;
    return <CloudSun className="w-5 h-5 text-yellow-500" />;
};


const WeatherImpactForecast = ({ data }: { data: GetWeatherImpactOutput | null }) => {
    return (
        <Card className="flex flex-col">
            <CardHeader>
                <CardTitle className="text-sm font-headline flex items-center gap-2"><TrendingDown className="w-4 h-4"/>Weather Impact Forecast</CardTitle>
                <p className="text-xs text-muted-foreground -mt-2">5-day range penalty prediction.</p>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-center px-4 pb-4">
                {data ? (
                    <div className="space-y-2">
                        {data.dailyImpacts.map(impact => (
                             <div key={impact.day} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-xs">
                                <span className="font-semibold">{impact.day}</span>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                   <WeatherImpactIcon reason={impact.reason} />
                                   <span>{impact.reason}</span>
                                </div>
                                <span className="font-mono font-semibold text-destructive justify-self-end">
                                    {impact.rangePenaltyKm.toFixed(0)} km
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-sm text-center text-muted-foreground font-semibold">Waiting for Weather Forecast</p>
                        <p className="text-xs text-center text-muted-foreground">The 5-day impact prediction will be generated once weather data is available.</p>
                        <div className="space-y-2 pt-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-4/5" />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function OptimizationTab({ state, onProfileSwitchClick }: OptimizationTabProps) {

  const activeProfileData = state.profiles[state.activeProfile];
  
  const greenScore = state.odometer > 0 ? state.odometer * 0.12 : 0; // 120g CO2 saved per km vs average ICE car

  const defaultAcImpact = {
    rangeImpactKm: state.acOn ? -2.5 : 2.5,
    recommendation: state.acOn ? "Turn off A/C to save range." : "Turning on A/C may reduce range."
  };

  return (
        <div className="h-full grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 min-h-0">
            <Card className="flex flex-col items-center justify-center">
                <CardHeader className="items-center pb-2">
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><BarChart className="w-4 h-4"/>Eco-Driving Score</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow w-48 h-48 flex flex-col items-center justify-center">
                    <div className="w-full h-full">
                        <EcoScoreGauge score={state.ecoScore} />
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2 px-2">Analyzes driving style, acceleration, and efficiency.</p>
                </CardContent>
            </Card>
            
             <WeatherImpactForecast data={state.weatherImpact} />


            <Card className="p-4 row-start-3 md:row-start-auto">
                <CardHeader className="flex-row items-center justify-between p-0 mb-2">
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><User className="w-4 h-4"/>User Profile</CardTitle>
                    <Button variant="link" className="text-xs h-auto p-0 text-primary" onClick={onProfileSwitchClick}>Switch / Manage</Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="space-y-1">
                        <ProfileDetail label="Name" value={state.activeProfile} />
                        <ProfileDetail label="User ID" value={activeProfileData?.id} />
                        <ProfileDetail label="Phone" value={activeProfileData?.phone} />
                        <ProfileDetail label="Age" value={activeProfileData?.age} />
                    </div>
                </CardContent>
            </Card>

            <Card className="col-span-3 md:col-span-2 row-start-2 md:row-start-auto flex flex-col">
                <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><BrainCircuit className="w-4 h-4"/>Predictive Idle Drain</CardTitle>
                    <p className="text-xs text-muted-foreground -mt-2">Predicts battery loss over 8 hours while idle. Updates automatically.</p>
                </CardHeader>
                <CardContent className="p-0 flex-grow min-h-0">
                    <IdleDrainChart data={state.idleDrainPrediction} currentSOC={state.batterySOC} />
                </CardContent>
            </Card>

            <Card className="p-4 flex flex-col">
                 <CardHeader className="p-0 pb-2 flex-row justify-between items-center">
                    <div>
                        <CardTitle className="text-sm font-headline flex items-center gap-2"><Wind className="w-4 h-4"/>A/C Usage Impact</CardTitle>
                         <p className="text-xs text-muted-foreground">Live forecast of range impact.</p>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 pt-2 min-h-0">
                     <div className="flex-grow">
                        {state.acUsageImpact ? (
                            <AcImpactDisplay 
                                impact={state.acUsageImpact.rangeImpactKm} 
                                recommendation={state.acUsageImpact.recommendation}
                            />
                        ) : (
                             <AcImpactDisplay 
                                impact={defaultAcImpact.rangeImpactKm} 
                                recommendation={defaultAcImpact.recommendation}
                            />
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
