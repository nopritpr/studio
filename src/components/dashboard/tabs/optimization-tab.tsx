
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import EcoScoreGauge from "../charts/eco-score-gauge";
import type { VehicleState, AiState } from "@/lib/types";
import { Leaf, User, BrainCircuit, BarChart, RefreshCw, Hourglass } from "lucide-react";
import { useMemo, useState } from 'react';
import IdleDrainChart from "../charts/idle-drain-chart";

interface OptimizationTabProps {
    state: VehicleState & AiState;
    onProfileSwitchClick: () => void;
    onStabilizerToggle: () => void;
    onRefreshInsights: () => void;
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

export default function OptimizationTab({ state, onProfileSwitchClick, onStabilizerToggle, onRefreshInsights }: OptimizationTabProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshInsights();
    setIsRefreshing(false);
  }

  const insights = useMemo(() => {
    const allInsights = [];
    const defaultRecommendation = "Click the refresh button to get live AI driving tips.";
    const defaultStyle = "Click refresh to analyze your unique style.";

    let recommendation = state.drivingRecommendation;
    if (!recommendation || recommendation === "AI service unavailable.") {
      recommendation = defaultRecommendation;
    }
    
    allInsights.push({
        icon: '💡',
        title: 'Live Tip',
        description: recommendation,
        justification: state.drivingRecommendationJustification,
    });
    

    if (state.drivingStyleRecommendations && state.drivingStyleRecommendations.length > 0) {
        allInsights.push({
            icon: '🎯',
            title: 'Driving Style',
            description: state.drivingStyleRecommendations[0],
            justification: null,
        });
    } else {
        allInsights.push({
            icon: '🎯',
            title: 'Driving Style',
            description: defaultStyle,
            justification: null,
        });
    }

    return allInsights;
  }, [state.drivingRecommendation, state.drivingRecommendationJustification, state.drivingStyleRecommendations]);
  
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
                    <p className="text-xs text-muted-foreground text-center mt-2 px-2">Analyzes driving style, acceleration, and efficiency.</p>
                </CardContent>
            </Card>
            
            <Card className="flex flex-col items-center justify-center">
                <CardHeader className="items-center">
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><Leaf className="w-4 h-4"/>Green Score</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-5xl font-bold text-green-400 font-headline">
                        {greenScore.toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">kg CO₂ saved vs ICE</p>
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

            <Card className="col-span-3 md:col-span-2 row-start-2 md:row-start-auto flex flex-col">
                <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><Hourglass className="w-4 h-4"/>Predictive Idle Drain</CardTitle>
                    <p className="text-xs text-muted-foreground -mt-2">Predicts battery loss over 8 hours while idle. Updates automatically.</p>
                </CardHeader>
                <CardContent className="p-0 flex-grow min-h-0">
                    <IdleDrainChart data={state.idleDrainPrediction} />
                </CardContent>
            </Card>

            <Card className="p-4 flex flex-col">
                <CardHeader className="p-0 pb-2 flex-row justify-between items-center">
                    <div>
                        <CardTitle className="text-sm font-headline flex items-center gap-2"><BrainCircuit className="w-4 h-4"/>AI Driving Coach</CardTitle>
                        <p className="text-xs text-muted-foreground">Live analysis of driving behavior for tips.</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 pt-2 min-h-0">
                     <div className="flex-grow space-y-2 overflow-y-auto pr-2">
                        {insights.map((insight, i) => (
                            <InsightItem
                                key={i}
                                icon={insight.icon}
                                title={insight.title}
                                description={insight.description}
                                justification={insight.justification}
                            />
                        ))}
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t">
                        <label htmlFor="stabilizer-toggle" className="text-sm">Prediction Stabilizer</label>
                        <Switch id="stabilizer-toggle" checked={state.stabilizerEnabled} onCheckedChange={onStabilizerToggle} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
