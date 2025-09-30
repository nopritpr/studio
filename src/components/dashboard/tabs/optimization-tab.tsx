'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import Image from "next/image";
import EcoScoreGauge from "../charts/eco-score-gauge";
import SohForecastChart from "../charts/soh-forecast-chart";
import type { VehicleState } from "@/lib/types";
import { Leaf, User, BrainCircuit, BarChart, ChevronRight, HeartPulse } from "lucide-react";

interface OptimizationTabProps {
    state: VehicleState;
    onProfileSwitchClick: () => void;
    onStabilizerToggle: () => void;
}

const InsightItem = ({ icon, title, description, type }: { icon: React.ReactNode, title: string, description: string, type: string }) => (
  <div className={`p-2 rounded flex items-start gap-2 text-xs
    ${type === 'warning' ? 'bg-yellow-900/20 border-yellow-800/30' :
      type === 'tip' ? 'bg-blue-900/20 border-blue-800/30' :
      'bg-muted/50'
    }`}>
    <div className="text-base mt-0.5">{icon}</div>
    <div>
      <h5 className="font-semibold">{title}</h5>
      <p className="text-muted-foreground">{description}</p>
    </div>
  </div>
);

export default function OptimizationTab({ state, onProfileSwitchClick, onStabilizerToggle }: OptimizationTabProps) {

  const insights = [
      ...(state.drivingRecommendation ? [{
          icon: '💡',
          title: 'Live Tip',
          description: state.drivingRecommendation,
          type: 'tip'
      }] : []),
      ...(state.drivingStyleRecommendations || []).map(rec => ({
          icon: '🎯',
          title: 'Driving Style',
          description: rec,
          type: 'info'
      }))
  ];


  return (
        <div className="h-full grid grid-cols-3 grid-rows-2 gap-4 min-h-0">
            <Card className="flex flex-col items-center justify-center">
                <CardHeader className="items-center">
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><BarChart className="w-4 h-4"/>Eco-Driving Score</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow w-48 h-48">
                    <EcoScoreGauge score={state.ecoScore} />
                </CardContent>
            </Card>

            <Card className="p-4 flex flex-col items-center justify-center">
                <CardHeader className="items-center">
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><Leaf className="w-4 h-4"/>Green Score</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-5xl font-bold text-green-400 font-headline">
                        {((state.odometer * (120 - 50)) / 1000).toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">kg CO₂ saved vs ICE</p>
                </CardContent>
            </Card>
            
            <Card className="p-4">
                <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><User className="w-4 h-4"/>User Profile</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center space-x-4">
                    <Image src={`https://placehold.co/64x64/748ffc/ffffff?text=${state.activeProfile.charAt(0)}`} alt="User" width={64} height={64} className="w-16 h-16 rounded-full" />
                    <div>
                        <p className="font-bold font-headline">{state.activeProfile}</p>
                        <Button variant="link" className="text-xs h-auto p-0 text-primary" onClick={onProfileSwitchClick}>Switch Profile</Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="col-span-3 md:col-span-2 flex flex-col">
                <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><HeartPulse className="w-4 h-4"/>Battery Health (SOH) Forecast</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0">
                    <SohForecastChart data={state.sohForecast} />
                </CardContent>
            </Card>

            <Card className="p-4">
                 <CardHeader>
                    <CardTitle className="text-sm font-headline flex items-center gap-2"><BrainCircuit className="w-4 h-4"/>AI Insights & Controls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-xs grid grid-cols-1 gap-2 mb-4 h-32 overflow-y-auto">
                        {insights.length > 0 ? insights.map((insight, i) => (
                           <InsightItem key={i} {...insight} />
                        )) : <p className="text-muted-foreground text-center self-center">No insights available.</p> }
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
