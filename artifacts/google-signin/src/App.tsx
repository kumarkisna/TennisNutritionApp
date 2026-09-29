import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { AuthenticateWithRedirectCallback, ClerkProvider, Show, useAuth, useClerk, useSignIn, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleCheck,
  LogOut,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { SiGoogle } from 'react-icons/si';

import { ErrorBoundary } from '@/components/error-boundary';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
  variables: {
    colorPrimary: '#176d61',
    colorForeground: '#183542',
    colorMutedForeground: '#5d6d71',
    colorDanger: '#b84f42',
    colorBackground: '#fbfaf6',
    colorInput: '#f4f0e8',
    colorInputForeground: '#183542',
    colorNeutral: '#d9d2c5',
    fontFamily: 'Manrope, ui-sans-serif, sans-serif',
    borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf6] rounded-[1.4rem] w-[440px] max-w-full overflow-hidden shadow-none',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#183542] text-[1.55rem] font-extrabold tracking-[-0.04em]',
    headerSubtitle: 'text-[#5d6d71] text-sm',
    socialButtonsBlockButtonText: 'text-[#183542] font-semibold',
    formFieldLabel: 'text-[#183542] font-semibold',
    footerActionLink: 'text-[#176d61] font-bold',
    footerActionText: 'text-[#5d6d71]',
    dividerText: 'text-[#7b8583] text-xs',
    identityPreviewEditButton: 'text-[#176d61]',
    formFieldSuccessText: 'text-[#176d61]',
    alertText: 'text-[#b84f42]',
    logoBox: 'h-12 w-12',
    logoImage: 'h-12 w-12 rounded-[0.85rem]',
    socialButtonsBlockButton: 'border-[#d9d2c5] bg-[#f4f0e8] min-h-12 transition-transform duration-200',
    formButtonPrimary: 'bg-[#176d61] hover:bg-[#12564d] text-[#fbfaf6] min-h-12 font-bold transition-transform duration-200',
    formFieldInput: 'bg-[#f4f0e8] border-[#d9d2c5] text-[#183542] min-h-12',
    footerAction: 'border-t border-[#e5ded2] pt-6',
    dividerLine: 'bg-[#e5ded2]',
    alert: 'border-[#e8b1a4] bg-[#fff3ef]',
    otpCodeFieldInput: 'border-[#d9d2c5] bg-[#f4f0e8] text-[#183542]',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      data-testid="link-brand-home"
      className={`inline-flex items-center gap-3 ${compact ? '' : 'group'}`}
    >
      <img
        src={`${basePath}/logo.svg`}
        alt="Clear Access logo"
        data-testid="img-brand-logo"
        className="h-10 w-10 rounded-[0.8rem] shadow-[0_7px_16px_-10px_hsl(166_56%_37%_/_0.7)] transition-transform duration-300 group-hover:rotate-[-5deg]"
      />
      <span className="display-face text-[1.05rem] font-extrabold tracking-[-0.045em] text-[#183542]">
        Clear Access
      </span>
    </Link>
  );
}

function Home() {
  return (
    <main className="grain min-h-[100dvh] overflow-hidden bg-[#f7f4ed]" data-testid="page-home">
      <header className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <BrandMark />
        <nav className="flex items-center gap-4" aria-label="Primary navigation">
          <span className="hidden text-xs font-semibold text-[#6d7a79] sm:inline" data-testid="text-nav-safety">
            Your account. One clear handoff.
          </span>
          <Link
            href="/sign-in"
            data-testid="link-nav-sign-in"
            className="inline-flex items-center gap-2 rounded-full border border-[#d9d2c5] bg-[#fbfaf6] px-4 py-2.5 text-sm font-bold text-[#183542] transition hover:-translate-y-0.5 hover:border-[#176d61] hover:text-[#176d61]"
          >
            Sign in <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-12 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 lg:px-10 lg:pb-28 lg:pt-20">
        <div className="relative z-10 max-w-[700px] self-center">
          <div className="rise-in mb-8 inline-flex items-center gap-2 rounded-full border border-[#c6ded5] bg-[#e8f3ed] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#176d61]" data-testid="status-oauth-safe">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.2} />
            A safer sign-in handoff
          </div>
          <h1 className="display-face rise-in rise-in-delay-1 max-w-[690px] text-[clamp(3.35rem,8vw,6.9rem)] font-extrabold leading-[0.9] text-[#183542]" data-testid="heading-home">
            Access, without the guesswork.
          </h1>
          <p className="rise-in rise-in-delay-2 mt-8 max-w-[560px] text-[1.05rem] leading-8 text-[#5d6d71] sm:text-[1.18rem]" data-testid="text-home-description">
            Clear Access is a small, focused portal. Choose Google, complete sign-in on Google's own page, and come back to the account you meant to reach.
          </p>
          <div className="rise-in rise-in-delay-3 mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              href="/sign-in"
              data-testid="link-home-sign-in"
              className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#176d61] px-7 text-sm font-extrabold text-[#fbfaf6] shadow-[0_14px_28px_-16px_hsl(166_56%_37%_/_0.95)] transition hover:-translate-y-1 hover:bg-[#12564d]"
            >
              Continue securely
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.5} />
            </Link>
            <Link
              href="/sign-up"
              data-testid="link-home-sign-up"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-[#d9d2c5] bg-[#fbfaf6]/60 px-6 text-sm font-bold text-[#183542] transition hover:-translate-y-1 hover:border-[#176d61] hover:text-[#176d61]"
            >
              Create an account
            </Link>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs leading-5 text-[#74807e]" data-testid="text-home-no-password">
            <CircleCheck className="h-4 w-4 shrink-0 text-[#176d61]" />
            Google handles your password. Clear Access never asks for it or sees it.
          </p>
        </div>

        <div className="relative min-h-[420px] lg:min-h-[560px]" aria-label="OAuth handoff illustration" data-testid="panel-oauth-illustration">
          <div className="paper-grid absolute inset-5 rounded-[2.2rem] border border-[#ddd8cc] bg-[#f0ece3] opacity-80" />
          <div className="absolute right-0 top-4 h-32 w-32 rounded-full border border-[#e8b1a4] bg-[#f3c1b0]/40 blur-[1px] sm:h-44 sm:w-44" />
          <div className="drift-slow absolute left-0 top-24 rounded-[1.35rem] border border-[#c6ded5] bg-[#e8f3ed] p-4 shadow-[0_24px_48px_-30px_hsl(166_56%_37%_/_0.7)] sm:left-5" data-testid="card-handoff-note">
            <div className="mb-7 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#176d61]" />
              <span className="mono-face text-[10px] font-medium uppercase text-[#176d61]">handoff / 01</span>
            </div>
            <p className="max-w-[150px] text-sm font-bold leading-5 text-[#183542]">Google keeps the password on Google.</p>
          </div>
          <div className="absolute bottom-4 right-0 w-[min(88%,380px)] rounded-[2rem] border border-[#ddd8cc] bg-[#fbfaf6] p-5 shadow-[0_30px_70px_-32px_hsl(203_37%_18%_/_0.5)] sm:bottom-12 sm:right-3 sm:p-7" data-testid="card-clear-access-flow">
            <div className="mb-10 flex items-center justify-between">
              <span className="mono-face text-[10px] font-medium uppercase text-[#74807e]">clear access / portal</span>
              <Sparkles className="h-5 w-5 text-[#e7856b]" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-[#f4f0e8] p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f3ed] text-[#176d61]"><ShieldCheck className="h-4 w-4" /></span>
                <div><p className="text-xs font-bold text-[#183542]">Secure redirect</p><p className="text-[11px] text-[#74807e]">You know where your password goes.</p></div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-[#c6ded5] bg-[#f7fbf8] p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#176d61] text-[#fbfaf6]"><Check className="h-4 w-4" strokeWidth={3} /></span>
                <div><p className="text-xs font-bold text-[#183542]">Back in your portal</p><p className="text-[11px] text-[#74807e]">Just your account, nothing extra.</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#e3ddd2] bg-[#fbfaf6]">
        <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 gap-0 px-5 sm:px-8 md:grid-cols-3 lg:px-10">
          <div className="border-b border-[#e3ddd2] py-8 md:border-b-0 md:border-r md:pr-10" data-testid="feature-password">
            <p className="mono-face mb-3 text-[10px] uppercase text-[#176d61]">01 / no password copy</p>
            <h2 className="text-lg font-extrabold text-[#183542]">Google does the password work.</h2>
            <p className="mt-2 text-sm leading-6 text-[#6d7a79]">The password field belongs on Google's page, not ours.</p>
          </div>
          <div className="border-b border-[#e3ddd2] py-8 md:border-b-0 md:border-r md:px-10" data-testid="feature-brand">
            <p className="mono-face mb-3 text-[10px] uppercase text-[#176d61]">02 / clear identity</p>
            <h2 className="text-lg font-extrabold text-[#183542]">A portal, not a Google clone.</h2>
            <p className="mt-2 text-sm leading-6 text-[#6d7a79]">You are always handed off to the real Google OAuth page.</p>
          </div>
          <div className="py-8 md:pl-10" data-testid="feature-portal">
            <p className="mono-face mb-3 text-[10px] uppercase text-[#176d61]">03 / only what matters</p>
            <h2 className="text-lg font-extrabold text-[#183542]">A small account destination.</h2>
            <p className="mt-2 text-sm leading-6 text-[#6d7a79]">Sign in, see your details, and sign out when you&apos;re done.</p>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1240px] flex-col gap-2 px-5 py-8 text-xs text-[#74807e] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10" data-testid="footer-home">
        <span>Clear Access is an independent account portal.</span>
        <span className="mono-face text-[10px] uppercase">passwords stay with Google</span>
      </footer>
    </main>
  );
}

function AuthFrame({ children, mode }: { children: ReactNode; mode: 'sign-in' | 'sign-up' }) {
  return (
    <main className="grain min-h-[100dvh] bg-[#f7f4ed] px-4 py-5 sm:px-8 sm:py-8" data-testid={`page-${mode}`}>
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-8 lg:min-h-[calc(100dvh-4rem)] lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <section className="flex max-w-[490px] flex-col justify-between lg:min-h-[680px]" data-testid="panel-auth-context">
          <BrandMark />
          <div className="mt-12 lg:mt-0">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#c6ded5] bg-[#e8f3ed] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#176d61]" data-testid="status-auth-handoff">
              <ShieldCheck className="h-4 w-4" />
              {mode === 'sign-in' ? 'Returning safely' : 'Start with clarity'}
            </div>
            <h1 className="display-face max-w-[480px] text-5xl font-extrabold leading-[0.93] text-[#183542] sm:text-6xl" data-testid="heading-auth-context">
              {mode === 'sign-in' ? 'Your account is one trusted handoff away.' : 'Make your first handoff a clear one.'}
            </h1>
            <p className="mt-6 max-w-[410px] text-base leading-7 text-[#5d6d71]" data-testid="text-auth-context">
              {mode === 'sign-in'
                ? "Choose Google below. You will enter your password only on Google's page, then return here to your account portal."
                : "Create your Clear Access account through Google. Your Google password stays on Google's page, where it belongs."}
            </p>
          </div>
          <div className="mt-10 hidden items-center gap-3 text-xs text-[#74807e] lg:flex" data-testid="text-auth-trust-note">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#183542] text-[#fbfaf6]"><ShieldCheck className="h-4 w-4" /></span>
            <span>Independent portal. Real Google OAuth. No password collection.</span>
          </div>
        </section>
        <section className="w-full max-w-[500px] lg:mr-[4vw]" data-testid="panel-clerk-auth">
          <div className="mb-4 flex items-center justify-between px-1 text-xs text-[#74807e]">
            <span className="mono-face text-[10px] uppercase">{mode === 'sign-in' ? 'sign-in / secure' : 'sign-up / secure'}</span>
            <Link href="/" data-testid="link-auth-back-home" className="font-bold text-[#176d61] transition hover:text-[#12564d]">Back to overview</Link>
          </div>
          <div className="rounded-[1.6rem] border border-[#e0d9ce] bg-[#fbfaf6] p-2 shadow-[0_28px_75px_-38px_hsl(203_37%_18%_/_0.6)] sm:p-3">
            {children}
          </div>
          <p className="mx-auto mt-4 max-w-[390px] text-center text-[11px] leading-5 text-[#74807e]" data-testid="text-auth-disclaimer">
            Clear Access does not ask for, store, or imitate Google passwords. Selecting Google opens Google's own secure sign-in page.
          </p>
        </section>
      </div>
    </main>
  );
}

function GoogleOnlyAuth({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { isLoaded } = useAuth();
  const { signIn } = useSignIn();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startGoogleOAuth() {
    if (!isLoaded || !signIn || isRedirecting) return;
    setError(null);
    setIsRedirecting(true);
    try {
      // The sign-in OAuth flow also creates a new account when the Google user is new.
      await signIn.sso({
        strategy: 'oauth_google',
        redirectCallbackUrl: `${basePath}/sign-in/sso-callback`,
        redirectUrl: `${basePath}/user-portal`,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Google sign-in could not start. Please try again.';
      setError(message);
      setIsRedirecting(false);
    }
  }

  return (
    <div className="rounded-[1.4rem] bg-[#fbfaf6] p-6 sm:p-9" data-testid="card-google-only-auth">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f3ed] text-[#176d61]"><ShieldCheck className="h-6 w-6" /></div>
      <p className="mono-face mt-8 text-[10px] uppercase text-[#176d61]">clear access / google sign-in</p>
      <h2 className="display-face mt-3 text-[2rem] font-extrabold leading-tight text-[#183542]" data-testid="heading-google-auth">
        {mode === 'sign-in' ? 'Welcome back.' : 'Get started securely.'}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#5d6d71]" data-testid="text-google-auth-explainer">
        Continue to Google's secure page to choose an account. We'll bring you back when you're done.
      </p>
      <button
        type="button"
        onClick={startGoogleOAuth}
        disabled={!isLoaded || !signIn || isRedirecting}
        data-testid="button-continue-with-google"
        className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#176d61] px-5 text-sm font-extrabold text-[#fbfaf6] transition duration-200 hover:-translate-y-0.5 hover:bg-[#12564d] disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0"
      >
        <SiGoogle className="h-4 w-4" aria-hidden="true" />
        {!isLoaded ? 'Preparing secure sign-in…' : isRedirecting ? 'Taking you to Google…' : 'Continue with Google'}
        {!isRedirecting && isLoaded && <ArrowRight className="ml-auto h-4 w-4" aria-hidden="true" />}
      </button>
      {!isLoaded && <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-[#e8e2d7]" data-testid="status-google-auth-loading" />}
      {isRedirecting && <p className="mt-4 text-center text-xs text-[#5d6d71]" role="status" data-testid="status-google-redirect">Opening Google's secure sign-in page…</p>}
      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-[#e8b1a4] bg-[#fff3ef] p-4 text-sm leading-6 text-[#943d33]" data-testid="status-google-auth-error">
          {error} You can try the button again.
        </div>
      )}
      <div className="mt-8 border-t border-[#e5ded2] pt-6 text-center text-xs text-[#6d7a79]">
        {mode === 'sign-in' ? (
          <>New to Clear Access? <Link href="/sign-up" data-testid="link-auth-sign-up" className="font-bold text-[#176d61] hover:underline">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href="/sign-in" data-testid="link-auth-sign-in" className="font-bold text-[#176d61] hover:underline">Sign in</Link></>
        )}
      </div>
    </div>
  );
}

function OAuthCallback() {
  return (
    <div className="min-h-[260px] rounded-[1.4rem] bg-[#fbfaf6] p-8 text-center" data-testid="status-google-callback">
      <div className="mx-auto mb-6 h-12 w-12 animate-pulse rounded-2xl bg-[#e8f3ed]" />
      <h2 className="text-xl font-extrabold text-[#183542]">Finishing your secure handoff</h2>
      <p className="mt-3 text-sm leading-6 text-[#5d6d71]">Checking your Google sign-in and opening your portal…</p>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}

function SignInPage() {
  const [location] = useLocation();
  return (
    <AuthFrame mode="sign-in">
      {location.startsWith('/sign-in/sso-callback')
        ? <OAuthCallback />
        : <GoogleOnlyAuth mode="sign-in" />}
    </AuthFrame>
  );
}

function SignUpPage() {
  const [location] = useLocation();
  return (
    <AuthFrame mode="sign-up">
      {location.startsWith('/sign-up/sso-callback')
        ? <OAuthCallback />
        : <GoogleOnlyAuth mode="sign-up" />}
    </AuthFrame>
  );
}

function PortalLoading() {
  return (
    <main className="min-h-[100dvh] bg-[#f7f4ed] p-5 sm:p-10" data-testid="status-portal-loading">
      <div className="mx-auto max-w-[920px] animate-pulse space-y-5">
        <div className="h-10 w-40 rounded-lg bg-[#e8e2d7]" />
        <div className="h-64 rounded-[1.6rem] bg-[#e8e2d7]" />
        <div className="h-36 rounded-[1.6rem] bg-[#e8e2d7]" />
      </div>
    </main>
  );
}

function UserPortalPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded) return <PortalLoading />;
  if (!user) return <Redirect to="/" />;

  const email = user.primaryEmailAddress?.emailAddress ?? 'No primary email listed';
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Clear Access member';
  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? user.primaryEmailAddress?.emailAddress?.[0] ?? 'C'}`.toUpperCase();

  return (
    <main className="grain min-h-[100dvh] bg-[#f7f4ed]" data-testid="page-user-portal">
      <header className="mx-auto flex max-w-[920px] items-center justify-between px-5 py-6 sm:px-8 sm:py-8">
        <BrandMark compact />
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: basePath || '/' })}
          data-testid="button-sign-out"
          className="inline-flex items-center gap-2 rounded-full border border-[#d9d2c5] bg-[#fbfaf6] px-4 py-2.5 text-sm font-bold text-[#183542] transition hover:-translate-y-0.5 hover:border-[#e7856b] hover:text-[#b84f42]"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </header>
      <section className="mx-auto max-w-[920px] px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#183542] px-6 py-10 text-[#fbfaf6] shadow-[0_32px_80px_-36px_hsl(203_37%_18%_/_0.7)] sm:px-12 sm:py-14" data-testid="card-portal-welcome">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[36px] border-[#2c6970]/60" />
          <div className="relative z-10 max-w-[600px]">
            <p className="mono-face mb-5 text-[10px] uppercase text-[#9bd1c0]" data-testid="status-signed-in">signed in / verified session</p>
            <h1 className="display-face text-5xl font-extrabold leading-[0.95] sm:text-7xl" data-testid="heading-portal">
              You&apos;re in, {user.firstName || 'there'}.
            </h1>
            <p className="mt-6 max-w-[470px] text-base leading-7 text-[#c5d8d2]">
              This is your Clear Access account portal. Nothing else is competing for your attention.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-[1.6rem] border border-[#e0d9ce] bg-[#fbfaf6] p-6 sm:p-8" data-testid="card-user-details">
            <div className="flex items-center gap-4 border-b border-[#e7e1d6] pb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e8f3ed] text-lg font-extrabold text-[#176d61]" data-testid="avatar-user-initials">{initials}</div>
              <div>
                <p className="text-lg font-extrabold text-[#183542]" data-testid="text-user-name">{fullName}</p>
                <p className="text-sm text-[#6d7a79]" data-testid="text-user-email">{email}</p>
              </div>
            </div>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <div><dt className="mono-face text-[10px] uppercase text-[#74807e]">account status</dt><dd className="mt-2 flex items-center gap-2 text-sm font-bold text-[#176d61]" data-testid="status-account-active"><span className="h-2 w-2 rounded-full bg-[#176d61]" />Active</dd></div>
              <div><dt className="mono-face text-[10px] uppercase text-[#74807e]">session</dt><dd className="mt-2 text-sm font-bold text-[#183542]" data-testid="text-auth-provider">Clerk-managed</dd></div>
            </dl>
          </section>
          <section className="rounded-[1.6rem] border border-[#c6ded5] bg-[#e8f3ed] p-6 sm:p-8" data-testid="card-portal-safety">
            <ShieldCheck className="h-6 w-6 text-[#176d61]" />
            <h2 className="mt-7 text-lg font-extrabold text-[#183542]">A clear finish.</h2>
            <p className="mt-2 text-sm leading-6 text-[#5d6d71]">Your session is managed by Clerk. Sign out here when you are finished.</p>
            <div className="mt-6 flex items-center gap-2 text-xs font-bold text-[#176d61]"><CircleCheck className="h-4 w-4" /> Password never entered here</div>
          </section>
        </div>
      </section>
    </main>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/user-portal" /></Show>
      <Show when="signed-out"><Home /></Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const currentQueryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        currentQueryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, currentQueryClient]);

  return null;
}

function Router() {
  const [location] = useLocation();

  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/user-portal" component={UserPortalPage} />
        <Route component={() => <Redirect to="/" />} />
      </Switch>
    </ErrorBoundary>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Welcome back to Clear Access',
            subtitle: 'Use Google to return to your account',
          },
        },
        signUp: {
          start: {
            title: 'Create your Clear Access account',
            subtitle: 'Start with a trusted Google handoff',
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Router />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;