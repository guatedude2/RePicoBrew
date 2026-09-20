import React from 'react';
import { Form, Link, useActionData, useNavigation } from 'react-router';
import { MdOutlineRemoveRedEye } from 'react-icons/md';
import { RiEyeCloseLine } from 'react-icons/ri';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import type { action } from '~/routes/signin';

const getErrorMessage = (message: string | undefined) => {
  if (message === 'BAD_CREDENTIALS' || message === 'NOT_AUTHORIZED') {
    return 'Invalid email and/or password';
  }
  return 'Oh no, something went wrong';
};

const Logo = () => (
  <div className="mb-10 flex items-center gap-2.5">
    <div className="flex size-9 items-center justify-center rounded-[9px] bg-gradient-to-br from-brand-300 to-brand-600">
      <svg viewBox="0 0 24 24" className="size-[19px] text-ink-on-brand">
        <path d="M6 3h10l1 4H5l1-4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path
          d="M5 7h14l-1.4 12.2A2 2 0 0 1 15.6 21H8.4a2 2 0 0 1-2-1.8L5 7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
    <div className="leading-[1.1]">
      <p className="text-base font-bold tracking-[0.5px]">REPICOBREW</p>
      <p className="text-[11px] tracking-[1px] text-ink-text-faint">CONTROL DECK</p>
    </div>
  </div>
);

export const SignIn = () => {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [show, setShow] = React.useState(false);
  const handleClick = () => setShow(!show);

  // Covers both the sign-in POST and the redirect target's own loader (e.g. /dashboard) — on the
  // Pi Zero W's single ARMv6 core, that loader can take several seconds, and without this the
  // button just sits there looking unresponsive after a correct password.
  const isSubmitting = navigation.state !== 'idle';

  const isEmailError = Boolean(actionData && 'email' in actionData.error);
  const errorMessage = actionData && 'message' in actionData.error ? getErrorMessage(actionData.error.message) : null;

  return (
    <div className="flex min-h-screen w-full flex-wrap bg-ink-bg">
      <div className="flex min-w-[340px] flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[400px]">
          <Logo />
          <p className="mb-2 text-[28px] font-bold tracking-[-0.3px]">Sign in</p>
          <p className="mb-8 text-sm text-ink-text-dim">Enter your email and password to access your brew rig.</p>

          <Form method="post" noValidate className="flex flex-col gap-[18px]">
            {errorMessage ? <p className="text-center text-danger-500">{errorMessage}</p> : null}
            <div>
              <Label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-ink-text-secondary">
                Email
              </Label>
              <Input id="email" name="email" required type="email" placeholder="you@example.com" className="h-12" />
              {isEmailError ? <p className="mt-1.5 text-xs text-danger-500">A valid email is required.</p> : null}
            </div>
            <div>
              <Label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-ink-text-secondary">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  required
                  placeholder="••••••••"
                  type={show ? 'text' : 'password'}
                  className="h-12 pr-10"
                />
                <button
                  type="button"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={handleClick}
                  className="absolute inset-y-0 right-3 flex items-center text-ink-text-faint"
                >
                  {show ? <RiEyeCloseLine className="size-4" /> : <MdOutlineRemoveRedEye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="remember-login" name="remember" />
                <Label htmlFor="remember-login" className="text-[13px] font-normal text-ink-text-secondary">
                  Keep me logged in
                </Label>
              </div>
              <Link to="/auth/forgot-password">
                <p className="text-[13px] font-semibold text-brand-500">Forgot password?</p>
              </Link>
            </div>
            <Button type="submit" variant="brand" size="lg" className="mt-1" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </Form>
        </div>
      </div>

      <div className="relative hidden min-h-[320px] min-w-[320px] flex-1 md:block">
        <div
          className="absolute inset-0 bg-ink-bg bg-cover bg-center"
          style={{ backgroundImage: "url('/img/signin-hero.webp')" }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to bottom, transparent 40%, oklch(0.15 0.004 260 / 0.92) 100%)',
          }}
        />
        <div className="absolute bottom-8 left-8 right-8">
          <p className="text-xl font-bold">Brew with precision.</p>
          <p className="mt-1 text-[13px] text-ink-text-secondary">
            Live tracking for every batch, from mash to fermentation.
          </p>
        </div>
      </div>
    </div>
  );
};
