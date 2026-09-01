'use client'

import { useEffect, useState } from 'react'
import { SignIn, SignUp } from '@clerk/nextjs'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import styles from './PrototypeAuth.module.css'

type IntakeDraft = { selfName?: string; partnerName?: string }

export function PrototypeAuth({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const t = useTranslations('common.marketing.auth')
  const [draft, setDraft] = useState<IntakeDraft>({})

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('bliss:intake')
      if (stored) setDraft(JSON.parse(stored) as IntakeDraft)
    } catch {
      window.localStorage.removeItem('bliss:intake')
    }
  }, [])

  const isSignUp = mode === 'sign-up'
  const couple = draft.selfName && draft.partnerName
    ? t('named', { selfName: draft.selfName, partnerName: draft.partnerName })
    : t('unnamed')

  const appearance = {
    variables: {
      colorPrimary: '#52677a',
      colorText: '#242b2f',
      colorTextSecondary: '#6d7474',
      colorBackground: '#ffffff',
      colorInputBackground: '#ffffff',
      colorInputText: '#242b2f',
      borderRadius: '12px',
      fontFamily: '"Avenir Next", Avenir, "Segoe UI", Helvetica, Arial, sans-serif',
    },
    elements: {
      rootBox: styles.clerkRoot,
      card: styles.clerkCard,
      headerTitle: 'hidden',
      headerSubtitle: 'hidden',
      footerActionLink: 'font-semibold',
      formButtonPrimary: 'shadow-none',
    },
  }

  return (
    <main className={styles.root}>
      <section className={styles.shell}>
        <section className={styles.story}>
          <Link className={styles.brand} href="/"><span className={styles.brandMark} aria-hidden="true" /><span>{t('brand')}</span></Link>
          <div className={styles.storyCopy}>
            <p className={styles.eyebrow}>{t('eyebrow')}</p>
            <h1>{t(isSignUp ? 'signUpTitle' : 'signInTitle')}</h1>
            <p>{t(isSignUp ? 'signUpBody' : 'signInBody')}</p>
            <div className={styles.identity} aria-label={couple}><span className={`${styles.ring} ${styles.ringA}`} /><span className={`${styles.ring} ${styles.ringB}`} /><p className={styles.couple}>{couple}</p></div>
            <ul className={styles.principles}><li><i aria-hidden="true" />{t('voiceOne')}</li><li><i aria-hidden="true" />{t('voiceTwo')}</li><li><i aria-hidden="true" />{t('shared')}</li></ul>
          </div>
        </section>
        <section className={styles.authSide}>
          <div className={styles.panel}>
            <nav className={styles.modeSwitch} aria-label={t('modeLabel')}>
              <Link href="/sign-up" aria-current={isSignUp ? 'page' : undefined}>{t('createAccount')}</Link>
              <Link href="/sign-in" aria-current={!isSignUp ? 'page' : undefined}>{t('signIn')}</Link>
            </nav>
            <header className={styles.panelHead}><h2>{t(isSignUp ? 'signUpPanel' : 'signInPanel')}</h2><p>{t(isSignUp ? 'signUpNote' : 'signInNote')}</p></header>
            {isSignUp
              ? <SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/onboarding" appearance={appearance} />
              : <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/dashboard" appearance={appearance} />}
            <p className={styles.privacy}>{t('privacy')}</p>
            <Link className={styles.back} href="/">← {t('back')}</Link>
          </div>
        </section>
      </section>
    </main>
  )
}
