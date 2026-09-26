import { Link, useLoaderData } from 'react-router';
import type { loader } from '~/routes/auth.forgot-password';
import { Logo } from '~/pages/SignIn';

export const ForgotPassword = () => {
  const { host } = useLoaderData<typeof loader>();
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-ink-bg p-6 md:p-10">
      <div className="w-full max-w-[460px]">
        <Logo />
        <p className="mb-2 text-[28px] font-bold tracking-[-0.3px]">Forgot your password?</p>
        <p className="mb-6 text-sm text-ink-text-dim">
          RePicoBrew runs on your own device and can&apos;t send email, so a password is reset over SSH on the Pi.
        </p>
        <ol className="flex list-decimal flex-col gap-3 rounded-xl border border-ink-card-border bg-ink-card py-5 pl-9 pr-5 text-sm text-ink-text-secondary">
          <li>
            From a computer on the same network, connect to the Pi:
            <code className="mt-1.5 block rounded-md bg-ink-bg px-3 py-2 font-mono text-[13px]">ssh pi@{host}</code>
          </li>
          <li>
            Run the reset script:
            <code className="mt-1.5 block rounded-md bg-ink-bg px-3 py-2 font-mono text-[13px]">
              cd ~/RePicoBrew &amp;&amp; node scripts/reset-password.mjs
            </code>
          </li>
          <li>Pick your account, then type the new password twice (at least 8 characters).</li>
          <li>Come back here and sign in with it. No restart needed.</li>
        </ol>
        <Link to="/signin" className="mt-6 inline-block text-[13px] font-semibold text-brand-500">
          Back to sign in
        </Link>
      </div>
    </div>
  );
};
