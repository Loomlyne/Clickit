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
import { AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/auth-errors'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
        <Input id="login-email" type="email" placeholder="you@example.com" className="mt-1.5" {...register('email')} />
        {errors.email && <p className="mt-1 text-xs text-brand-red-safe">{errors.email.message}</p>}
      </div>

      <div>
        <Label htmlFor="login-password">Password</Label>
        <Input id="login-password" type="password" placeholder="••••••••" className="mt-1.5" {...register('password')} />
        {errors.password && <p className="mt-1 text-xs text-brand-red-safe">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Signing in...' : 'Sign In'}
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
