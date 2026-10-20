'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { dirFor, type Locale } from '@/lib/locale'
import { LoginForm } from './login-form'
import { SignupForm } from './signup-form'

export function AuthPanel() {
  const t = useTranslations('auth')
  const locale = useLocale() as Locale
  // Radix Tabs forces dir="ltr" unless told otherwise, which would render the
  // whole Arabic form left-to-right.
  return (
    <Tabs defaultValue="login" dir={dirFor(locale)} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="login">{t('tabSignIn')}</TabsTrigger>
        <TabsTrigger value="signup">{t('tabSignUp')}</TabsTrigger>
      </TabsList>
      <TabsContent value="login" className="mt-4 md:mt-6">
        <LoginForm />
      </TabsContent>
      <TabsContent value="signup" className="mt-4 md:mt-6">
        <SignupForm />
      </TabsContent>
    </Tabs>
  )
}
