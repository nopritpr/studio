
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import EcoScoreGauge from "../charts/eco-score-gauge";
import type { VehicleState, AiState } from "@/lib/types";
import { Leaf, User, BrainCircuit, BarChart, Wind } from "lucide-react";
import IdleDrainChart from "../charts/idle-drain-chart";

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

const AcImpactDisplay = ({ impact, recommendation, reasoning }: { impact: number, recommendation: string, reasoning: string }) => {
  const isGain = impact > 0;
  const displayValue = Math.abs(impact).toFixed(1);
  const colorClass = isGain ? "text-green-400" : "text-destructive";

  return (
    <div className="p-3 rounded-lg flex flex-col items-center justify-center text-center gap-2 bg-muted/50 border border-border/50 h-full">
       <p className={`text-3xl font-bold font-headline ${colorClass}`}>
        {isGain ? '+' : '-'}{displayValue} km
       </p>
       <p className="text-xs font-semibold leading-snug">{recommendation}</p>
       <p className="text-xs text-muted-foreground leading-snug mt-1">{reasoning}</p>
    </div>
  );
};

const GreenScoreCard = ({ score }: { score: number }) => {
  const scoreInKg = score / 1000;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-sm font-headline flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-500" />
          Green Score
        </CardTitle>
        <p className="text-xs text-muted-foreground -mt-2">
          A linear regression model estimates CO2 savings based on distance driven versus a standard gasoline car's emissions.
        </p>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col items-center justify-center text-center">
        <p className="text-3xl lg:text-4xl font-bold text-green-400 font-headline">
          {scoreInKg.toFixed(1)}
        </p>
        <p className="text-sm font-medium text-muted-foreground">kg CO₂</p>
      </CardContent>
    </Card>
  );
};


export default function OptimizationTab({ state, onProfileSwitchClick }: OptimizationTabProps) {

  const activeProfileData = state.profiles[state.activeProfile];
  
  const greenScore = state.odometer > 0 ? state.odometer * 120 : 0; // 120g CO2 saved per km vs average ICE car

  const defaultAcImpact = {
    rangeImpactKm: state.acOn ? -2.5 : 0,
    recommendation: state.acOn ? "Turn off A/C to save range." : "A/C is off.",
    reasoning: "Calculating impact based on current conditions..."
  };

  return (
        <div className="h-full grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 min-h-0">
            <Card className="flex flex-col items-center justify-center">
                <CardHeader className="items-center pb-2 text-center">
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><BarChart className="w-4 h-4"/>Eco-Driving Score</CardTitle>
                    <p className="text-xs text-muted-foreground -mt-2 px-2">A scoring model rates driving style based on smooth acceleration and efficient energy use.</p>
                </CardHeader>
                <CardContent className="flex-grow w-48 h-48 flex flex-col items-center justify-center">
                    <div className="w-full h-full">
                        <EcoScoreGauge score={state.ecoScore} />
                    </div>
                </CardContent>
            </Card>
            
             <GreenScoreCard score={greenScore} />


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
                    <p className="text-xs text-muted-foreground -mt-2">An energy consumption model forecasts battery loss over 8 hours based on current settings.</p>
                </CardHeader>
                <CardContent className="p-0 flex-grow min-h-0">
                    <IdleDrainChart data={state.idleDrainPrediction} currentSOC={state.batterySOC} />
                </CardContent>
            </Card>

            <Card className="p-4 flex flex-col">
                 <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><Wind className="w-4 h-4"/>A/C Usage Impact</CardTitle>
                    <p className="text-xs text-muted-foreground -mt-2">A regression model predicts range change based on A/C settings and temperature.</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 pt-2 min-h-0">
                     <div className="flex-grow">
                        {state.acUsageImpact ? (
                            <AcImpactDisplay 
                                impact={state.acUsageImpact.rangeImpactKm} 
                                recommendation={state.acUsageImpact.recommendation}
                                reasoning={state.acUsageImpact.reasoning}
                            />
                        ) : (
                             <AcImpactDisplay 
                                impact={defaultAcImpact.rangeImpactKm} 
                                recommendation={defaultAcImpact.recommendation}
                                reasoning={defaultAcImpact.reasoning}
                            />
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

    