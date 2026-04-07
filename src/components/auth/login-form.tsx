'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/auth-errors'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email'),
})

type ForgotFormData = z.infer<typeof forgotSchema>

export function LoginForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [resetSent, setResetSent] = useState(false)

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const forgotForm = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  })

  async function onLogin(data: LoginFormData) {
    setServerError(null)
    const supabase = createClient()

    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      setServerError(mapAuthError(error.message))
      return
    }

    // Check if this user is admin — redirect to /admin if so
    const { data: config } = await supabase
      .from('app_config')
      .select('admin_user_id')
      .single()

    const isAdmin = config?.admin_user_id === authData.user?.id

    toast.success('Signed in successfully!')
    router.push(isAdmin ? '/admin' : '/')
    router.refresh()
  }

  async function onForgot(data: ForgotFormData) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    })

    if (error) {
      setServerError(mapAuthError(error.message))
      return
    }

    setResetSent(true)
  }

  if (mode === 'forgot') {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => { setMode('login'); setServerError(null); setResetSent(false) }}
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </button>

        {resetSent ? (
          <div className="rounded-lg px-4 py-4 text-sm bg-[#50A258]/10 border border-[#50A258]/25 text-green-300">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-white/52">
              We sent a password reset link to your email. Click the link to set a new password.
            </p>
          </div>
        ) : (
          <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
            {serverError && (
              <div className="rounded-lg px-4 py-3 text-sm bg-[#DB3F34]/10 border border-[#DB3F34]/25 text-red-300">
                <div className="flex gap-2.5 items-start">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{serverError}</span>
                </div>
              </div>
            )}

            <p className="text-sm text-white/52">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            <div>
              <Label htmlFor="forgot-email">Email</Label>
              <Input id="forgot-email" type="email" placeholder="you@example.com" className="mt-1.5" {...forgotForm.register('email')} />
              {forgotForm.formState.errors.email && (
                <p className="mt-1 text-xs text-brand-red-safe">{forgotForm.formState.errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={forgotForm.formState.isSubmitting}
              className="w-full rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {forgotForm.formState.isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
      {serverError && (
        <div className="rounded-lg px-4 py-3 text-sm bg-[#DB3F34]/10 border border-[#DB3F34]/25 text-red-300">
          <div className="flex gap-2.5 items-start">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{serverError}</span>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" placeholder="you@example.com" className="mt-1.5" {...loginForm.register('email')} />
        {loginForm.formState.errors.email && <p className="mt-1 text-xs text-brand-red-safe">{loginForm.formState.errors.email.message}</p>}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Password</Label>
          <button
            type="button"
            onClick={() => { setMode('forgot'); setServerError(null) }}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative mt-1.5">
          <Input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="pr-10"
            {...loginForm.register('password')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {loginForm.formState.errors.password && <p className="mt-1 text-xs text-brand-red-safe">{loginForm.formState.errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={loginForm.formState.isSubmitting}
        className="w-full rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loginForm.formState.isSubmitting ? 'Signing in...' : 'Sign In'}
      </button>

      <div className="relative my-4">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#111116] px-3 text-xs text-white/40">
          or continue with
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => toast.info('Google SSO coming soon')}
          className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
        >
          Google
        </button>
        <button
          type="button"
          onClick={() => toast.info('Apple SSO coming soon')}
          className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
        >
          Apple
        </button>
      </div>
    </form>
  )
}
