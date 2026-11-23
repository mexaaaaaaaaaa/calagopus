import React from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { validatePasswordUpdate } from '../api/calagopusModules';
import { Button } from '../components/Button';
import { PasswordInput, TextInput } from '../components/FormControls';
import { ConfirmDialog, showToast } from '../components/Overlays';
import { Card, PageHeader, StatusBadge } from '../components/Surface';

export interface AccountSecurityPageProps {
  twoFactorEnabled: boolean;
  totpSetupKey?: string;
  onUpdatePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<void> | void;
  onToggleTwoFactor: (enabled: boolean, code?: string) => Promise<void> | void;
}

export function AccountSecurityPage({
  twoFactorEnabled,
  totpSetupKey,
  onUpdatePassword,
  onToggleTwoFactor,
}: AccountSecurityPageProps) {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [nextPassword, setNextPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [errors, setErrors] = React.useState<{
    currentError?: string;
    nextError?: string;
    confirmError?: string;
  }>({});

  const [totpCode, setTotpCode] = React.useState('');
  const [totpError, setTotpError] = React.useState<string | null>(null);
  const [disableConfirmOpen, setDisableConfirmOpen] = React.useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePasswordUpdate(currentPassword, nextPassword, confirmPassword);
    if (validation.currentError || validation.nextError || validation.confirmError) {
      setErrors(validation);
      return;
    }
    try {
      await Promise.resolve(onUpdatePassword({ currentPassword, newPassword: nextPassword }));
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setErrors({});
      showToast({
        title: 'Password updated',
        message: 'Your Petalnodes account password has been changed.',
        tone: 'success',
      });
    } catch {
      // Error surfaced by caller
    }
  };

  const handleEnableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = totpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setTotpError('Enter the 6-digit verification code from your authenticator app.');
      return;
    }
    try {
      await Promise.resolve(onToggleTwoFactor(true, code));
      setTotpCode('');
      setTotpError(null);
      showToast({
        title: 'Two-factor authentication enabled',
        message: 'TOTP verification is now required at sign-in.',
        tone: 'success',
      });
    } catch {
      // Error surfaced by caller
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & Authentication"
        description="Rotate your account password and configure Time-Based One-Time Password (2FA) protection."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Update Password"
          description="Use at least 8 characters including letters and numbers."
          headerAction={<Lock className="h-4 w-4 text-[#8E2E52]" aria-hidden="true" />}
        >
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <PasswordInput
              label="Current Password"
              required
              value={currentPassword}
              error={errors.currentError}
              onChange={(e) => {
                setCurrentPassword(e.currentTarget.value);
                setErrors((prev) => ({ ...prev, currentError: undefined }));
              }}
            />
            <PasswordInput
              label="New Password"
              required
              value={nextPassword}
              error={errors.nextError}
              onChange={(e) => {
                setNextPassword(e.currentTarget.value);
                setErrors((prev) => ({ ...prev, nextError: undefined }));
              }}
            />
            <PasswordInput
              label="Confirm New Password"
              required
              value={confirmPassword}
              error={errors.confirmError}
              onChange={(e) => {
                setConfirmPassword(e.currentTarget.value);
                setErrors((prev) => ({ ...prev, confirmError: undefined }));
              }}
            />
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm">
                Update Password
              </Button>
            </div>
          </form>
        </Card>

        <Card
          title="Two-Factor Authentication (2FA)"
          description="Protect console and SFTP access using an authenticator TOTP token."
          headerAction={
            <StatusBadge
              tone={twoFactorEnabled ? 'success' : 'warning'}
              label={twoFactorEnabled ? 'Enabled' : 'Disabled'}
            />
          }
        >
          {twoFactorEnabled ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-[#CBE4D2] bg-[#EFF7F1] p-3.5 text-[13px] text-[#275D38]">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium">Two-factor authentication is active</p>
                  <p className="mt-0.5 text-[12px]">
                    Your account requires a 6-digit verification code on sign-in.
                  </p>
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDisableConfirmOpen(true)}
              >
                Disable Two-Factor Auth
              </Button>
            </div>
          ) : (
            <form onSubmit={handleEnableTotp} className="space-y-4">
              <div className="rounded-lg border border-[#EEE5E9] bg-[#FCFAFB] p-3 text-[12px] text-[#777078] space-y-1">
                <p className="font-medium text-[#29232A]">Authenticator Setup Key</p>
                {totpSetupKey ? (
                  <p className="font-mono text-[#8E2E52] break-all">{totpSetupKey}</p>
                ) : (
                  <p className="text-[#777078]">
                    Issued dynamically by Calagopus when two-factor enrollment begins.
                  </p>
                )}
              </div>
              <TextInput
                label="6-Digit Verification Code"
                placeholder="123456"
                required
                value={totpCode}
                error={totpError ?? undefined}
                onChange={(e) => {
                  setTotpCode(e.currentTarget.value);
                  setTotpError(null);
                }}
              />
              <div className="flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  Enable 2FA
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>

      <ConfirmDialog
        opened={disableConfirmOpen}
        onClose={() => setDisableConfirmOpen(false)}
        onConfirm={async () => {
          try {
            await Promise.resolve(onToggleTwoFactor(false));
            showToast({
              title: 'Two-factor authentication disabled',
              tone: 'warning',
            });
          } catch {
            // Error surfaced by caller
          }
          setDisableConfirmOpen(false);
        }}
        title="Disable Two-Factor Authentication"
        message="Removing 2FA lowers account security for your Petalnodes servers. Continue?"
        confirmLabel="Disable 2FA"
        destructive
      />
    </div>
  );
}
