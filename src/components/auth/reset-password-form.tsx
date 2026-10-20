'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/auth-errors'
import { AuthAlert } from './auth-alert'
import { PasswordField } from './password-field'
import { PASSWORD_MIN, errorParams } from './password-rules'

const resetSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN, 'passwordMin'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordMismatch',
    path: ['confirmPassword'],
  })

type ResetFormData = z.infer<typeof resetSchema>

export function ResetPasswordForm() {
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const passwordValue = useWatch({ control, name: 'password' }) ?? ''
  const fieldError = (key?: string) =>
    key ? tErrors(key as never, errorParams(key) as never) : undefined

  async function onSubmit(data: ResetFormData) {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password: data.password,
    })

    if (error) {
      setServerError(mapAuthError(error.message))
      return
    }

    toast.success(t('resetSuccess'))
    router.push('/')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      {serverError && <AuthAlert variant="error">{serverError}</AuthAlert>}

      <PasswordField
        id="reset-password"
        label={t('newPassword')}
        autoComplete="new-password"
        placeholder="••••••••"
        strengthOf={passwordValue}
        error={fieldError(errors.password?.message)}
        {...register('password')}
      />

      <PasswordField
        id="reset-confirm"
        label={t('confirmPassword')}
        autoComplete="new-password"
        placeholder="••••••••"
        error={fieldError(errors.confirmPassword?.message)}
        {...register('confirmPassword')}
      />

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? t('resetButton') + '…' : t('resetButton')}
      </Button>
    </form>
  )
}
