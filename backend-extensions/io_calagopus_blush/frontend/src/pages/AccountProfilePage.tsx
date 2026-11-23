import React from 'react';
import { Save, Sliders, User } from 'lucide-react';
import type { PetalnodesUiPreferences } from '../api/calagopusModules';
import { Button } from '../components/Button';
import { Checkbox, TextInput } from '../components/FormControls';
import { showToast } from '../components/Overlays';
import { Card, PageHeader, ProfileBadge, StatusBadge } from '../components/Surface';
import type { CalagopusUserContext } from '../navigation/calagopusRoutes';

export interface AccountProfilePageProps {
  user: CalagopusUserContext;
  preferences: PetalnodesUiPreferences;
  onUpdateProfile: (input: { username: string; email: string }) => Promise<void> | void;
  onUpdatePreferences: (next: PetalnodesUiPreferences) => void;
}

export function AccountProfilePage({
  user,
  preferences,
  onUpdateProfile,
  onUpdatePreferences,
}: AccountProfilePageProps) {
  const [username, setUsername] = React.useState(user.username);
  const [email, setEmail] = React.useState(user.email);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setUsername(user.username);
    setEmail(user.email);
  }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid username and email address.');
      return;
    }
    const cleanUsername = username.trim();
    try {
      await Promise.resolve(onUpdateProfile({ username: cleanUsername, email: email.trim() }));
      setError(null);
      showToast({
        title: 'Profile updated',
        message: `Saved Petalnodes account details for ${cleanUsername}.`,
        tone: 'success',
      });
    } catch {
      // Error surfaced by caller
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Profile"
        description="Manage your Petalnodes panel identity and personal interface preferences."
        metadata={[user.isAdmin ? 'Administrator' : 'Member', user.id]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Identity Details"
          description="Update your display username and primary panel notification email."
          headerAction={
            <StatusBadge
              tone={user.isAdmin ? 'pink' : 'success'}
              label={user.isAdmin ? 'Admin' : 'Verified'}
            />
          }
        >
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="rounded-lg border border-[#EEE5E9] bg-[#FCFAFB] p-3">
              <ProfileBadge name={user.username} subtitle={user.email} />
            </div>

            <TextInput
              label="Username"
              required
              value={username}
              onChange={(e) => {
                setUsername(e.currentTarget.value);
                setError(null);
              }}
            />

            <TextInput
              label="Email Address"
              type="email"
              required
              value={email}
              error={error ?? undefined}
              onChange={(e) => {
                setEmail(e.currentTarget.value);
                setError(null);
              }}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                leftIcon={<Save className="h-3.5 w-3.5" />}
              >
                Save Profile
              </Button>
            </div>
          </form>
        </Card>

        <Card
          title="Panel Preferences"
          description="Personalize table density, confirmation prompts, and console behavior."
          headerAction={<Sliders className="h-4 w-4 text-[#8E2E52]" aria-hidden="true" />}
        >
          <div className="space-y-4">
            <Checkbox
              label="Prompt confirmation before destructive server actions"
              description="Requires confirmation dialogs before stopping servers or deleting files and backups."
              checked={preferences.confirmDestructiveActions}
              onChange={(e) => {
                const next = {
                  ...preferences,
                  confirmDestructiveActions: e.currentTarget.checked,
                };
                onUpdatePreferences(next);
                showToast({ title: 'Preferences saved', tone: 'success' });
              }}
            />
            <Checkbox
              label="Enable console auto-scroll on connection"
              description="Automatically follow new terminal output lines when opening server consoles."
              checked={preferences.consoleAutoScrollDefault}
              onChange={(e) => {
                const next = {
                  ...preferences,
                  consoleAutoScrollDefault: e.currentTarget.checked,
                };
                onUpdatePreferences(next);
                showToast({ title: 'Preferences saved', tone: 'success' });
              }}
            />
            <Checkbox
              label="Compact table row density"
              description="Reduces vertical padding in file listings and server inventory tables."
              checked={preferences.compactTableRows}
              onChange={(e) => {
                const next = {
                  ...preferences,
                  compactTableRows: e.currentTarget.checked,
                };
                onUpdatePreferences(next);
                showToast({ title: 'Preferences saved', tone: 'success' });
              }}
            />

            <div className="flex items-center gap-2 border-t border-[#EEE5E9] pt-3 text-[12px] text-[#777078]">
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Preferences apply across this browser session via local storage.</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
