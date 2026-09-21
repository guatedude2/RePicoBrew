import { useFetcher } from 'react-router';
import { useEffect, useState, type FC } from 'react';
import { MdDelete, MdEdit, MdMoreVert, MdPersonAdd } from 'react-icons/md';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select } from '~/components/ui/select';

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
};

interface UsersCardProps {
  users: User[];
}

const ROLES = [
  { value: 'Regular', label: 'Regular User' },
  { value: 'ReadOnly', label: 'Read-only' },
];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

const initialsFor = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const UserRow: FC<{
  user: User;
  onEdit: () => void;
  onDelete: () => void;
  deleteBusy: boolean;
}> = ({ user, onEdit, onDelete, deleteBusy }) => (
  <div className="flex items-center gap-3 border-t border-ink-divider px-3.5 py-3 first:border-t-0">
    <div className="flex size-[34px] flex-none items-center justify-center rounded-full bg-ink-bg text-[13px] font-bold text-ink-text-secondary">
      {initialsFor(user.name)}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-semibold">{user.name}</p>
      <p className="text-[11px] text-ink-text-faint">{user.email}</p>
    </div>
    <p className="flex-none text-xs text-ink-text-secondary">{ROLE_LABEL[user.role] ?? user.role}</p>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="User actions"
          className="flex size-8 flex-none items-center justify-center rounded-md text-ink-text-secondary transition-colors hover:bg-ink-card hover:text-ink-text"
        >
          <MdMoreVert className="size-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <MdEdit className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="danger" disabled={deleteBusy} onClick={onDelete}>
          <MdDelete className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export const UsersCard: FC<UsersCardProps> = ({ users }) => {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Regular');
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('Regular');
  const addFetcher = useFetcher();
  const editFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  const handleAdd = () => {
    addFetcher.submit({ intent: 'addUser', name, email, password, role }, { method: 'post' });
    setAddOpen(false);
    setName('');
    setEmail('');
    setPassword('');
    setRole('Regular');
  };

  // Admin password reset: sets a new password for the user being edited, without knowing their old one.
  const resetFetcher = useFetcher<{ success?: boolean; error?: string }>();
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const resetMismatch = resetConfirm.length > 0 && resetPassword !== resetConfirm;
  const canReset = resetPassword.length >= 8 && resetPassword === resetConfirm && resetFetcher.state === 'idle';

  useEffect(() => {
    if (resetFetcher.state === 'idle' && resetFetcher.data?.success) {
      setResetPassword('');
      setResetConfirm('');
    }
  }, [resetFetcher.state, resetFetcher.data]);

  const openEdit = (user: User) => {
    resetFetcher.reset();
    setResetPassword('');
    setResetConfirm('');
    setEditTarget(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditOpen(true);
  };

  const handleEditSave = () => {
    if (!editTarget) {
      return;
    }
    editFetcher.submit(
      { intent: 'updateUser', id: String(editTarget.id), name: editName, email: editEmail, role: editRole },
      { method: 'post' },
    );
    setEditOpen(false);
  };

  useEffect(() => {
    if (editFetcher.state === 'idle') {
      setEditTarget(null);
    }
  }, [editFetcher.state]);

  return (
    <>
      <Card className="p-6">
        <div className="mb-3.5 flex items-center justify-between">
          <p className="text-[17px] font-bold">Users</p>
          <Button variant="brand" size="sm" onClick={() => setAddOpen(true)}>
            <MdPersonAdd className="size-4" />
            Add User
          </Button>
        </div>

        <div className="flex flex-col overflow-hidden rounded-[10px] border border-ink-divider">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onEdit={() => openEdit(user)}
              onDelete={() => deleteFetcher.submit({ intent: 'deleteUser', id: String(user.id) }, { method: 'post' })}
              deleteBusy={deleteFetcher.state !== 'idle'}
            />
          ))}
        </div>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="add-name">Name</Label>
              <Input id="add-name" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                className="mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="add-password">Password</Label>
              <Input
                id="add-password"
                type="password"
                className="mt-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="add-role">Role</Label>
              <Select id="add-role" className="mt-1.5" value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={!name || !email || !password || addFetcher.state !== 'idle'}
              onClick={handleAdd}
            >
              {addFetcher.state !== 'idle' ? 'Adding…' : 'Add User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" className="mt-1.5" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                className="mt-1.5"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select id="edit-role" className="mt-1.5" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="border-t border-ink-divider pt-4">
              <p className="text-[13px] font-semibold">Reset password</p>
              <p className="mt-0.5 text-xs text-ink-text-faint">
                Set a new password for this user without knowing their current one.
              </p>
              <div className="mt-3 flex flex-col gap-3">
                <div>
                  <Label htmlFor="reset-password">New password</Label>
                  <Input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    className="mt-1.5"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="reset-confirm">Confirm new password</Label>
                  <Input
                    id="reset-confirm"
                    type="password"
                    autoComplete="new-password"
                    className="mt-1.5"
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                  />
                </div>
                {resetMismatch && <p className="text-xs text-danger-500">Passwords don&apos;t match.</p>}
                {resetFetcher.data?.error && <p className="text-xs text-danger-500">{resetFetcher.data.error}</p>}
                {resetFetcher.data?.success && <p className="text-xs text-success-500">Password updated.</p>}
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  disabled={!canReset}
                  onClick={() => {
                    if (!editTarget) {
                      return;
                    }
                    resetFetcher.submit(
                      { intent: 'resetUserPassword', id: String(editTarget.id), newPassword: resetPassword },
                      { method: 'post' },
                    );
                  }}
                >
                  {resetFetcher.state !== 'idle' ? 'Setting…' : 'Set New Password'}
                </Button>
                <p className="text-[11px] text-ink-text-faintest">At least 8 characters.</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              disabled={!editName || !editEmail || editFetcher.state !== 'idle'}
              onClick={handleEditSave}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
