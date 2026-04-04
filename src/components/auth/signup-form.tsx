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
import { createClient } from '@/lib/supabase/client'

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
    const supabase = createClient()

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })

    if (error) {
      setServerError(error.message)
      return
    }

    // Create profile with display name
    if (authData.user) {
      await supabase.from('profiles').upsert({
        id: authData.user.id,
        display_name: data.name,
      })
    }

    toast.success('Account created! Welcome to Clickit Story.')
    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {serverError}
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
        <Input id="signup-password" type="password" placeholder="••••••••" className="mt-1.5" {...register('password')} />
        {errors.password && <p className="mt-1 text-xs text-brand-red-safe">{errors.password.message}</p>}
      </div>

      <div>
        <Label htmlFor="signup-confirm">Confirm Password</Label>
        <Input id="signup-confirm" type="password" placeholder="••••••••" className="mt-1.5" {...register('confirmPassword')} />
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
