"use client";

import React, { useState, useEffect } from 'react';
import { useVehicleSimulation } from '@/hooks/use-vehicle-simulation';
import Header from '@/components/dashboard/header';
import DashboardTab from '@/components/dashboard/tabs/dashboard-tab';
import AnalyticsTab from '@/components/dashboard/tabs/analytics-tab';
import OptimizationTab from '@/components/dashboard/tabs/optimization-tab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HelpModal from './help-modal';
import ProfileModal from './profile-modal';

export default function Dashboard() {
  const {
    state,
    setState,
    setDriveMode,
    toggleAC,
    setAcTemp,
    toggleCharging,
    resetTrip,
    setActiveTrip,
    switchProfile,
    addProfile
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
    setState,
  };

  return (
    <div className="w-full max-w-[1280px] bg-card/50 text-foreground flex flex-col rounded-2xl shadow-2xl overflow-hidden border p-2 sm:p-4 md:p-6 min-h-0 h-full font-body">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onHelpClick={() => setHelpModalOpen(true)}
      />
      <main className="flex-grow pt-4 overflow-hidden min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="hidden">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="optimization">Optimization</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="h-full flex-grow min-h-0 data-[state=inactive]:hidden">
            <DashboardTab
              {...cardProps}
            />
          </TabsContent>
          <TabsContent value="analytics" className="h-full flex-grow min-h-0 data-[state=inactive]:hidden">
            <AnalyticsTab {...cardProps} />
          </TabsContent>
          <TabsContent value="optimization" className="h-full flex-grow min-h-0 data-[state=inactive]:hidden">
            <OptimizationTab
              state={state}
              onProfileSwitchClick={() => setProfileModalOpen(true)}
              onStabilizerToggle={() => setState(prev => ({...prev, stabilizerEnabled: !prev.stabilizerEnabled}))}
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
      />
    </div>
  );
}
