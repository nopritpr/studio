
"use client";

import React, { useState } from 'react';
import { useVehicleSimulation } from '@/hooks/use-vehicle-simulation';
import Header from '@/components/dashboard/header';
import DashboardTab from '@/components/dashboard/tabs/dashboard-tab';
import AnalyticsTab from '@/components/dashboard/tabs/analytics-tab';
import OptimizationTab from '@/components/dashboard/tabs/optimization-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HelpModal from './help-modal';
import ProfileModal from './profile-modal';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { AiState, VehicleState } from '@/lib/types';

export default function Dashboard() {
  const {
    state,
    setVehicleState,
    setDriveMode,
    toggleAC,
    setAcTemp,
    toggleCharging,
    resetTrip,
    setActiveTrip,
    switchProfile,
    addProfile,
    deleteProfile,
    setPassengers,
    toggleGoodsInBoot,
  } = useVehicleSimulation();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isHelpModalOpen, setHelpModalOpen] = useState(false);
  const [isProfileModalOpen, setProfileModalOpen] = useState(false);

  const cardProps = {
    state,
    setDriveMode,
    toggleAC,
    setAcTemp,
    toggleCharging,
    resetTrip,
    setActiveTrip,
    setPassengers,
    toggleGoodsInBoot,
  };

  return (
    <div className="w-full max-w-[1280px] bg-card/50 text-foreground flex flex-col rounded-2xl shadow-2xl overflow-hidden border p-2 sm:p-4 md:p-6 min-h-0 h-full font-body">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onHelpClick={() => setHelpModalOpen(true)}
      />
      <main className="flex-grow pt-4 overflow-hidden min-h-0 relative">
        {state.fatigueWarning && (
          <Alert variant="destructive" className="absolute top-4 left-1/2 -translate-x-1/2 w-auto max-w-md z-20 animate-in fade-in-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Driver Alertness Low!</AlertTitle>
            <AlertDescription>
              {state.fatigueWarning}
              <p className="text-xs opacity-80 mt-1">(Anomaly Detection Model identified erratic driving)</p>
            </AlertDescription>
          </Alert>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="hidden">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="optimization">Optimization</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="h-full flex-grow min-h-0 data-[state=inactive]:hidden">
            <DashboardTab
              {...cardProps}
              setVehicleState={setVehicleState as React.Dispatch<React.SetStateAction<Partial<VehicleState & AiState>>>}
            />
          </TabsContent>
          <TabsContent value="analytics" className="h-full flex-grow min-h-0 data-[state=inactive]:hidden">
            <AnalyticsTab {...cardProps} />
          </TabsContent>
          <TabsContent value="optimization" className="h-full flex-grow min-h-0 data-[state=inactive]:hidden">
            <OptimizationTab
              state={state}
              onProfileSwitchClick={() => setProfileModalOpen(true)}
              onStabilizerToggle={() => {}}
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
        onDeleteProfile={deleteProfile}
      />
    </div>
  );
}
