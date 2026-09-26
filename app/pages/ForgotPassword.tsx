import { Link } from 'react-router';
import { Logo } from '~/pages/SignIn';

export const ForgotPassword = () => (
  <div className="flex min-h-screen w-full items-center justify-center bg-ink-bg p-6 md:p-10">
    <div className="w-full max-w-[460px]">
      <Logo />
      <p className="mb-2 text-[28px] font-bold tracking-[-0.3px]">Forgot your password?</p>
      <p className="mb-6 text-sm text-ink-text-dim">
        RePicoBrew runs on your own device and can&apos;t send email, so passwords are reset from the inside.
      </p>
      <div className="flex flex-col gap-4 rounded-xl border border-ink-card-border bg-ink-card p-5 text-sm text-ink-text-secondary">
        <div>
          <p className="mb-1 font-bold text-ink-text">Ask another admin</p>
          <p>
            Anyone with an Admin account can set a new password for you in <b>Settings → Users</b>. You can change it
            again yourself afterwards from your profile.
          </p>
        </div>
        <div>
          <p className="mb-1 font-bold text-ink-text">Or reset it on the device</p>
          <p className="mb-2">
            If you are the only user, connect to the Pi (SSH, or a keyboard and screen) and run this. It asks which
            account and for the new password:
          </p>
          <code className="block rounded-md bg-ink-bg px-3 py-2 font-mono text-[13px]">
            cd ~/RePicoBrew &amp;&amp; node scripts/reset-password.mjs
          </code>
        </div>
      </div>
      <Link to="/signin" className="mt-6 inline-block text-[13px] font-semibold text-brand-500">
        Back to sign in
      </Link>
    </div>
  </div>
);
