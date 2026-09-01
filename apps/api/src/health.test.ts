import { describe, expect, it } from 'bun:test'
import {
  deploymentCapabilities,
  missingProductCapabilities,
  missingProductionConfiguration,
} from './health'

const core = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://database',
  WEB_URL: 'https://bliss.example',
  CLERK_SECRET_KEY: 'clerk-secret',
  CLERK_WEBHOOK_SECRET: 'webhook-secret',
  CRON_SECRET: 'cron-secret',
  OPS_SECRET: 'ops-secret',
  AGENT_MODEL_PROVIDER: 'gemini',
  GEMINI_API_KEY: 'gemini-secret',
  GEMINI_MODEL: 'gemini-3.6-flash',
} satisfies NodeJS.ProcessEnv

describe('deployment health contract', () => {
  it('requires core production configuration and a usable model', () => {
    expect(missingProductionConfiguration(core)).toEqual([])
    expect(missingProductionConfiguration({ ...core, GEMINI_API_KEY: '' })).toContain(
      'configured agent model',
    )
    expect(missingProductionConfiguration({ ...core, CRON_SECRET: '' })).toContain('CRON_SECRET')
  })

  it('reports optional provider capabilities without exposing credentials', () => {
    expect(deploymentCapabilities({
      ...core,
      VENDOR_SEARCH_ENDPOINT: 'https://vendors.example',
      VENDOR_SEARCH_TOKEN: 'vendor-secret',
      LEGAL_AUTHORITY_ENDPOINT: 'https://legal.example',
      LEGAL_AUTHORITY_TOKEN: 'legal-secret',
    })).toEqual({
      agent: true,
      vendorSearch: true,
      legalAuthority: true,
      emailSend: false,
      privateMedia: false,
    })
  })

  it('does not mark malformed or insecure production providers as available', () => {
    expect(deploymentCapabilities({
      ...core,
      VENDOR_SEARCH_ENDPOINT: 'http://vendors.example',
      VENDOR_SEARCH_TOKEN: 'vendor-secret',
      LEGAL_AUTHORITY_ENDPOINT: 'not-a-url',
      LEGAL_AUTHORITY_TOKEN: 'legal-secret',
      EMAIL_SEND_ENDPOINT: 'ftp://email.example',
      EMAIL_SEND_TOKEN: 'email-secret',
      MEDIA_S3_ENDPOINT: 'https://objects.example',
      MEDIA_S3_BUCKET: 'INVALID_BUCKET',
      MEDIA_S3_REGION: 'auto',
      MEDIA_S3_ACCESS_KEY_ID: 'access-key',
      MEDIA_S3_SECRET_ACCESS_KEY: 'secret-key',
    })).toMatchObject({
      vendorSearch: false,
      legalAuthority: false,
      emailSend: false,
      privateMedia: false,
    })
    expect(missingProductionConfiguration({ ...core, WEB_URL: 'http://bliss.example' }))
      .toContain('valid HTTPS WEB_URL')
  })

  it('requires every user-facing capability for a fully usable release', () => {
    expect(missingProductCapabilities(core)).toEqual([
      'vendorSearch',
      'legalAuthority',
      'emailSend',
      'privateMedia',
    ])
    expect(missingProductCapabilities({
      ...core,
      VENDOR_SEARCH_ENDPOINT: 'https://vendors.example',
      VENDOR_SEARCH_TOKEN: 'vendor-secret',
      LEGAL_AUTHORITY_ENDPOINT: 'https://legal.example',
      LEGAL_AUTHORITY_TOKEN: 'legal-secret',
      EMAIL_SEND_ENDPOINT: 'https://email.example',
      EMAIL_SEND_TOKEN: 'email-secret',
      MEDIA_S3_ENDPOINT: 'https://objects.example',
      MEDIA_S3_BUCKET: 'bliss-private',
      MEDIA_S3_REGION: 'auto',
      MEDIA_S3_ACCESS_KEY_ID: 'access-key',
      MEDIA_S3_SECRET_ACCESS_KEY: 'secret-key',
    })).toEqual([])
  })
})
