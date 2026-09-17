import { useFetcher, useRouteLoaderData } from 'react-router';
import { useState, type FC } from 'react';
import { MdOutlineRemoveRedEye } from 'react-icons/md';
import { RiEyeCloseLine } from 'react-icons/ri';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';

const ROLE_LABEL: Record<string, string> = {
  Regular: 'Regular User',
  ReadOnly: 'Read-only',
};

const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const InfoRow: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between border-t border-ink-divider bg-ink-bg px-4 py-3 text-[13px] first:border-t-0">
    <p className="text-ink-text-faint">{label}</p>
    <p className="font-semibold text-ink-text">{value}</p>
  </div>
);

const PasswordField: FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}> = ({ label, value, onChange, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-semibold text-ink-text-secondary">{label}</Label>
      <div className="relative">
        <Input
          type={show ? 'text' : 'password'}
          placeholder="••••••••"
          value={value}
          autoComplete={autoComplete}
          className="pr-10"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={() => setShow(!show)}
          className="absolute inset-y-0 right-3 flex items-center text-ink-text-faint"
        >
          {show ? <RiEyeCloseLine className="size-4" /> : <MdOutlineRemoveRedEye className="size-4" />}
        </button>
      </div>
    </div>
  );
};

export const Profile: FC = () => {
  const adminData = useRouteLoaderData<typeof import('~/routes/_admin').loader>('routes/_admin');
  const session = adminData?.session;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const fetcher = useFetcher<{ success?: boolean; error?: string }>();

  const mismatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = Boolean(currentPassword && newPassword && newPassword === confirmPassword);

  const updatePassword = () => {
    if (!canSubmit) {
      return;
    }
    fetcher.submit(
      { intent: 'changePassword', currentPassword, newPassword },
      { method: 'post', encType: 'application/json' },
    );
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (!session) {
    return null;
  }

  return (
    <div className="flex max-w-[480px] flex-col gap-[18px]">
      <p className="text-[26px] font-bold tracking-[-0.3px]">My Profile</p>

      <Card className="flex flex-col gap-[18px] p-6">
        <div className="flex items-center gap-4">
          <div className="flex size-14 flex-none items-center justify-center rounded-full border border-ink-border-strong bg-gradient-to-br from-gray-500 to-gray-700 text-lg font-bold text-white">
            {initialsFor(session.name)}
          </div>
          <div>
            <p className="text-lg font-bold">{session.name}</p>
            <p className="text-[13px] text-ink-text-faint">{ROLE_LABEL[session.role] ?? session.role}</p>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden rounded-[10px] border border-ink-divider">
          <InfoRow label="Name" value={session.name} />
          <InfoRow label="Email" value={session.email} />
          <InfoRow label="Role" value={ROLE_LABEL[session.role] ?? session.role} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <p className="text-[15px] font-bold">Password</p>

        {fetcher.data?.error && <p className="text-xs text-danger-500">{fetcher.data.error}</p>}
        {fetcher.data?.success && <p className="text-xs text-success-500">Password updated.</p>}

        <PasswordField
          label="Current Password"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />
        <div className="flex flex-wrap gap-3.5">
          <div className="min-w-[150px] flex-1">
            <PasswordField
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
          </div>
          <div className="min-w-[150px] flex-1">
            <PasswordField
              label="Confirm Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
          </div>
        </div>
        {mismatch && <p className="text-xs text-danger-500">Passwords don&apos;t match.</p>}
        <Button
          variant="brand"
          className="self-start"
          disabled={!canSubmit || fetcher.state !== 'idle'}
          onClick={updatePassword}
        >
          {fetcher.state !== 'idle' ? 'Updating…' : 'Update Password'}
        </Button>
      </Card>
    </div>
  );
};

export default Profile;
