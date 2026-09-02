'use client'

import type { FormEvent, RefObject } from 'react'
import type {
  MarriageLicenseLookupResponse,
  PlanningThread,
  QuestScopingOverview,
  ThreadMessage,
  WorkspaceResourceCard,
} from '@bliss/types'
import { ExternalLink, Paperclip, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'
import { useContent } from '@/lib/content'
import { WorkspaceResourceCard as ResourceCard } from './WorkspaceResourceCard'
import styles from '../workspace.module.css'

type ActiveQuestion = QuestScopingOverview['questions'][number]

export function QuestionConversation({
  questKey,
  locale,
  scoping,
  activeQuestion,
  thread,
  messages,
  resourceCards,
  firstName,
  firstInput,
  secondName,
  secondInput,
  sharedGround,
  sourceCount,
  legalLookup,
  draft,
  working,
  error,
  composerRef,
  endRef,
  onDraftChange,
  onSendMessage,
  onOpenQuestion,
}: {
  questKey: string
  locale: string
  scoping: QuestScopingOverview
  activeQuestion: ActiveQuestion | null
  thread: PlanningThread | null
  messages: ThreadMessage[]
  resourceCards: WorkspaceResourceCard[]
  firstName: string
  firstInput: string
  secondName: string
  secondInput: string
  sharedGround: string
  sourceCount: number
  legalLookup: MarriageLicenseLookupResponse | 'unavailable' | null
  draft: string
  working: boolean
  error: string | null
  composerRef: RefObject<HTMLTextAreaElement>
  endRef: RefObject<HTMLDivElement>
  onDraftChange: (value: string) => void
  onSendMessage: (event?: FormEvent) => void
  onOpenQuestion: (questionKey: string, draft?: string) => void
}) {
  const t = useTranslations('assistant')
  const content = useContent()
  const router = useRouter()

  return (
    <section className={styles.conversation}>
      <header className={styles.conversationHeader}>
        <div className={styles.threadName}>
          <span className={styles.blissOrb}>b</span>
          <span>
            <strong>{activeQuestion ? content(activeQuestion.promptI18nKey, activeQuestion.questionKey) : content(scoping.titleI18nKey, questKey)}</strong>
            <span>{thread ? t('workspace.permanentThread') : t('workspace.chooseQuestion')}</span>
          </span>
        </div>
        <span className={styles.thinkingState}>{working ? t('composer.thinking') : t('workspace.agentReady')}</span>
      </header>

      <div className={styles.conversationScroll}>
        <header className={styles.conversationIntro}>
          <p className={styles.eyebrow}>{t('workspace.companionLabel')}</p>
          <h1>{t.rich('workspace.prototypeIntroTitle', { story: chunks => <em>{chunks}</em> })}</h1>
          <p>{t('workspace.prototypeIntroBody')}</p>
        </header>

        <section className={styles.understandingCard}>
          <header className={styles.cardHeader}>
            <strong>{t('workspace.understanding.title')}</strong>
            <span className={styles.sourceLink}>{t('workspace.understanding.sources', { count: sourceCount })}</span>
          </header>
          <div className={styles.coupleInputs}>
            <section className={`${styles.memberView} ${styles.firstMember}`}>
              <div className={styles.memberLabel}><i />{firstName}</div>
              <p>{firstInput}</p>
            </section>
            <div className={styles.sharedKnot}><span>&amp;</span></div>
            <section className={`${styles.memberView} ${styles.secondMember}`}>
              <div className={styles.memberLabel}><i />{secondName}</div>
              <p>{secondInput}</p>
            </section>
          </div>
          <div className={styles.sharedPriority}><strong>{t('workspace.understanding.sharedGround')}</strong><span>{sharedGround}</span></div>
        </section>

        {questKey === 'legal' && <LegalAuthorityCard lookup={legalLookup} locale={locale} />}

        <section className={styles.messages} aria-live="polite">
          {messages.filter(message => message.authorType === 'user' || message.authorType === 'assistant').map(message => (
            <MessageBubble key={message.id} message={message} initials={firstName.slice(0, 1).toUpperCase()} />
          ))}
        </section>
        {resourceCards.map((card, index) => <ResourceCard key={`${card.type}-${index}`} card={card} questKey={questKey} />)}
        {working && <div className={styles.thinking}><span className={styles.blissOrb}>b</span>{t('composer.thinking')}</div>}
        {error && <div className={styles.error}>{error}</div>}
        <div ref={endRef} />
      </div>

      <footer className={styles.composerShell}>
        <div className={styles.promptRow}>
          {(['agree', 'questions', 'next'] as const).map(prompt => (
            <button key={prompt} type="button" className={styles.promptChip} disabled={!activeQuestion || working} onClick={() => activeQuestion && onOpenQuestion(activeQuestion.questionKey, t(`workspace.prompts.${prompt}.prompt`))}>
              {t(`workspace.prompts.${prompt}.label`)}
            </button>
          ))}
        </div>
        <form onSubmit={onSendMessage} className={styles.composer}>
          <button type="button" className={styles.attachButton} aria-label={t('workspace.attach')} onClick={() => router.push('/moments')}><Paperclip size={15} /></button>
          <textarea
            ref={composerRef}
            value={draft}
            onChange={event => onDraftChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                onSendMessage()
              }
            }}
            rows={1}
            maxLength={12_000}
            aria-label={t('composer.placeholder')}
            placeholder={thread ? t('composer.placeholder') : t('workspace.chooseQuestion')}
            disabled={!thread || working}
          />
          <button type="submit" className={styles.sendButton} disabled={!thread || !draft.trim() || working} aria-label={t('composer.send')}><Send size={15} /></button>
        </form>
      </footer>
    </section>
  )
}

function MessageBubble({ message, initials }: { message: ThreadMessage; initials: string }) {
  const isBliss = message.authorType === 'assistant'
  return (
    <article className={styles.message} data-author={isBliss ? 'assistant' : 'user'}>
      {isBliss && <span className={styles.blissOrb}>b</span>}
      <div className={styles.bubble}>{message.content}</div>
      {!isBliss && <span className={`${styles.avatar} ${styles.firstAvatar}`}>{initials}</span>}
    </article>
  )
}

function LegalAuthorityCard({ lookup, locale }: { lookup: MarriageLicenseLookupResponse | 'unavailable' | null; locale: string }) {
  const t = useTranslations('assistant')
  const questT = useTranslations('quest')
  if (!lookup) return null
  if (lookup === 'unavailable' || lookup.status === 'verification_required') {
    return <div className={styles.legalCard}><strong>{t('legalLookup.unavailableTitle')}</strong>{t('legalLookup.unavailableBody')}</div>
  }
  const checked = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(lookup.rule.verifiedAt))
  return (
    <div className={styles.legalCard}>
      <strong>{t('legalLookup.verifiedTitle')} · {t('legalLookup.checked', { date: checked })}</strong>
      <div className={styles.legalFacts}>
        <span>{questT('legal.waitingPeriod', { hours: lookup.rule.waitingPeriodHours })}</span>
        <span>{questT('legal.validity', { days: lookup.rule.validityDays })}</span>
        <span>{questT('legal.witnesses', { count: lookup.rule.witnessesRequired })}</span>
      </div>
      <div className={styles.legalSources}>
        {lookup.rule.sources.map(source => (
          <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><ExternalLink size={11} /> {source.publisher}: {source.title}</a>
        ))}
      </div>
    </div>
  )
}
