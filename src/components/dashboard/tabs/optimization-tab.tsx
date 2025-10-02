
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import EcoScoreGauge from "../charts/eco-score-gauge";
import SohForecastChart from "../charts/soh-forecast-chart";
import type { VehicleState, Profile } from "@/lib/types";
import { Leaf, User, BrainCircuit, BarChart, HeartPulse } from "lucide-react";
import { useMemo } from 'react';

interface OptimizationTabProps {
    state: VehicleState;
    onProfileSwitchClick: () => void;
    onStabilizerToggle: () => void;
}

const InsightItem = ({ icon, title, description, justification }: { icon: React.ReactNode, title: string, description: string, justification?: string | null }) => (
  <div className="p-3 rounded-lg flex items-start gap-3 text-sm bg-muted/50 border border-border/50">
    <div className="text-primary mt-1">{icon}</div>
    <div>
      <h5 className="font-semibold text-foreground">{title}</h5>
      <p className="text-muted-foreground leading-snug text-xs">{description}</p>
      {justification && <p className="text-blue-400/80 leading-snug text-xs mt-1 italic">Justification: {justification}</p>}
    </div>
  </div>
);

const ProfileDetail = ({ label, value }: { label: string, value: string | number | undefined }) => (
    <div className="flex justify-between items-center text-xs py-1.5 border-b border-border/50">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{value || 'N/A'}</span>
    </div>
);

export default function OptimizationTab({ state, onProfileSwitchClick, onStabilizerToggle }: OptimizationTabProps) {

  const insights = useMemo(() => {
    const allInsights = [];
    
    allInsights.push({
        icon: '💡',
        title: 'Live Tip',
        description: "Driving good",
        justification: "This is a temporary message to check if the UI is updating correctly.",
    });

    if (state.drivingStyleRecommendations) {
        state.drivingStyleRecommendations.slice(0, 1).forEach(rec => { // Only show top 1 style recommendation
            allInsights.push({
                icon: '🎯',
                title: 'Driving Style',
                description: rec,
                type: 'info'
            });
        });
    }
    return allInsights;
  }, [state.drivingStyleRecommendations]);
  
  const activeProfileData = state.profiles[state.activeProfile];
  
  const greenScore = state.odometer > 0 ? state.odometer * 0.12 : 0; // 120g CO2 saved per km vs average ICE car

  return (
        <div className="h-full grid grid-cols-3 grid-rows-2 gap-4 min-h-0">
            <Card className="flex flex-col items-center justify-center">
                <CardHeader className="items-center pb-2">
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><BarChart className="w-4 h-4"/>Eco-Driving Score</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow w-48 h-48 flex flex-col items-center justify-center">
                    <div className="w-full h-full">
                        <EcoScoreGauge score={state.ecoScore} />
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2 px-2">Analyzes driving style, acceleration, and efficiency via a classification model.</p>
                </CardContent>
            </Card>

            <Card className="p-4 flex flex-col items-center justify-center">
                <CardHeader className="items-center">
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><Leaf className="w-4 h-4"/>Green Score</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-5xl font-bold text-green-400 font-headline">
                        {greenScore.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">kg CO₂ saved vs ICE</p>
                    <p className="text-xs text-muted-foreground text-center mt-2">Calculated based on odometer reading vs. average emissions of a gasoline car.</p>
                </CardContent>
            </Card>
            
            <Card className="p-4">
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

            <Card className="col-span-3 md:col-span-2 flex flex-col">
                <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><HeartPulse className="w-4 h-4"/>Battery Health (SOH) Forecast</CardTitle>
                    <p className="text-xs text-muted-foreground -mt-2">Time-series model projecting SOH based on historical usage and driving patterns.</p>
                </CardHeader>
                <CardContent className="flex-1 min-h-0">
                   {state.sohForecast && state.sohForecast.length > 0 ? (
                        <SohForecastChart data={state.sohForecast} currentOdometer={state.odometer} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <p className="text-sm text-muted-foreground">Generating forecast data...</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="p-4">
                 <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><BrainCircuit className="w-4 h-4"/>AI Insights & Controls</CardTitle>
                    <p className="text-xs text-muted-foreground -mt-2">Classification model analyzing driving behavior for tips.</p>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-2">
                    <div className="text-xs grid grid-cols-1 gap-2 mb-4 h-32 overflow-y-auto pr-2">
                        {insights.length > 0 ? insights.map((insight, i) => (
                           <InsightItem key={i} {...insight} />
                        )) : <div className="h-full flex items-center justify-center"><p className="text-muted-foreground text-center">No insights available. Drive to generate tips.</p></div> }
                    </div>
                    <div className="flex items-center justify-between">
                        <label htmlFor="stabilizer-toggle" className="text-sm">Prediction Stabilizer</label>
                        <Switch id="stabilizer-toggle" checked={state.stabilizerEnabled} onCheckedChange={onStabilizerToggle} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
