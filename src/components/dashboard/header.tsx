'use client';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpCircle } from 'lucide-react';
import ThemeToggle from './theme-toggle';

type HeaderProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onHelpClick: () => void;
};

export default function Header({ activeTab, onTabChange, onHelpClick }: HeaderProps) {
  return (
    <header className="w-full px-2 sm:px-4 py-3 flex items-center justify-between flex-shrink-0 border-b bg-background/80 backdrop-blur-sm rounded-t-xl">
      <div className="flex items-center gap-2">
        <h1 className="text-lg md:text-2xl font-bold font-headline text-primary">
          Electron Drive
        </h1>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onHelpClick}>
          <HelpCircle className="h-5 w-5" />
          <span className="sr-only">Help</span>
        </Button>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4">
        <Tabs value={activeTab} onValueChange={onTabChange}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="optimization">Optimization</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="hidden md:flex items-center ml-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
