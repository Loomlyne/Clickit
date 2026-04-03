'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    toast.success('Signed in successfully!')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

      <div className="flex justify-end">
        <a href="#" className="text-sm text-brand-blue-safe hover:underline">Forgot Password?</a>
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
