'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Profile } from '@/lib/types';
import { CheckCircle, Trash2 } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  profiles: Record<string, Profile>;
  activeProfile: string;
  onSwitchProfile: (name: string) => void;
  onAddProfile: (name: string) => void;
  onDeleteProfile: (name: string) => void;
}

export default function ProfileModal({
  isOpen,
  onOpenChange,
  profiles,
  activeProfile,
  onSwitchProfile,
  onAddProfile,
  onDeleteProfile
}: ProfileModalProps) {
  const [newProfileName, setNewProfileName] = useState('');
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);

  const handleAddProfile = () => {
    if (newProfileName.trim() && !profiles[newProfileName.trim()]) {
      onAddProfile(newProfileName.trim());
      setNewProfileName('');
    }
  };

  const handleDeleteProfile = () => {
    if (profileToDelete) {
        onDeleteProfile(profileToDelete);
        setProfileToDelete(null);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-headline">Switch Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {Object.keys(profiles).map((name) => (
            <div key={name} className="flex items-center gap-2 group">
              <Button
                variant={activeProfile === name ? 'secondary' : 'ghost'}
                className="w-full justify-between"
                onClick={() => {
                  onSwitchProfile(name);
                  onOpenChange(false);
                }}
              >
                {name}
                {activeProfile === name && <CheckCircle className="h-4 w-4 text-primary" />}
              </Button>
              {Object.keys(profiles).length > 1 && (
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setProfileToDelete(name)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete the profile for "{profileToDelete}" and all its associated data. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setProfileToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteProfile} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                 </AlertDialog>
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Input
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="New profile name..."
          />
          <Button onClick={handleAddProfile}>Add</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
