'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/auth-errors'
import { signUpAction } from '@/app/(viewer)/auth/actions'

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  terms: z.boolean().refine((v) => v === true, 'You must accept the terms'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type SignupFormData = z.infer<typeof signupSchema>

export function SignupForm() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', terms: false },
  })

  const termsValue = watch('terms')

  async function onSubmit(data: SignupFormData) {
    setServerError(null)

    // BotID-gated Server Action. On success we still call the browser-side
    // supabase client to sync the session cookie locally; see login-form.tsx
    // comment for the rationale.
    const result = await signUpAction(data.email, data.password, data.name)

    if (!result.ok) {
      setServerError(mapAuthError(result.error))
      return
    }

    const supabase = createClient()
    await supabase.auth.signInWithPassword({ email: data.email, password: data.password })

    toast.success('Account created! Welcome to Clickit Story.')
    router.push('/browse')
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
        <Label htmlFor="signup-name">Name</Label>
        <Input id="signup-name" placeholder="Your full name" className="mt-1.5" {...register('name')} />
        {errors.name && <p className="mt-1 text-xs text-brand-red-safe">{errors.name.message}</p>}
      </div>

      <div>
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" type="email" placeholder="you@example.com" className="mt-1.5" {...register('email')} />
        {errors.email && <p className="mt-1 text-xs text-brand-red-safe">{errors.email.message}</p>}
      </div>

      <div>
        <Label htmlFor="signup-password">Password</Label>
        <div className="relative mt-1.5">
          <Input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            className="pr-10"
            {...register('password')}
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
        {errors.password && <p className="mt-1 text-xs text-brand-red-safe">{errors.password.message}</p>}
      </div>

      <div>
        <Label htmlFor="signup-confirm">Confirm Password</Label>
        <div className="relative mt-1.5">
          <Input
            id="signup-confirm"
            type={showConfirm ? 'text' : 'password'}
            placeholder="••••••••"
            className="pr-10"
            {...register('confirmPassword')}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
          >
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.confirmPassword && <p className="mt-1 text-xs text-brand-red-safe">{errors.confirmPassword.message}</p>}
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id="signup-terms"
          checked={termsValue}
          onCheckedChange={(checked) => setValue('terms', checked === true)}
        />
        <Label htmlFor="signup-terms" className="text-sm text-muted-foreground leading-relaxed">
          I agree to the Terms of Service and Privacy Policy
        </Label>
      </div>
      {errors.terms && <p className="text-xs text-brand-red-safe">{errors.terms.message}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  )
}
