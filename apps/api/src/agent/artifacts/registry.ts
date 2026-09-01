import {
  ATTIRE_AGENT_PROMPT_V1,
  ATTIRE_AGENT_PROMPT_V2,
  ATTIRE_AGENT_PROMPT_V3,
} from '../packs/attire'
import {
  PHOTOGRAPHER_AGENT_PROMPT_V1,
  PHOTOGRAPHER_AGENT_PROMPT_V2,
  PHOTOGRAPHER_AGENT_PROMPT_V3,
} from '../packs/photographer'
import {
  QUEST_SCOPING_AGENT_PROMPT_V1,
  QUEST_SCOPING_AGENT_PROMPT_V2,
} from '../packs/quest-scoping'

export interface AgentArtifactBundle {
  readonly id: string
  readonly packKey: string
  readonly mode: 'decision'
  readonly promptVersion: string
  readonly toolsVersion: string
  readonly domainPackVersion: string
  readonly policyVersion: string
  readonly modelPolicyVersion: string
  readonly evalSuiteVersion: string
  readonly prompt: string
}

export const ATTIRE_ARTIFACT_BUNDLE_V1: AgentArtifactBundle = Object.freeze({
  id: 'attire-v1',
  packKey: 'attire_beauty',
  mode: 'decision',
  promptVersion: 'attire-system-v1',
  toolsVersion: 'attire-tools-v1',
  domainPackVersion: 'us-attire-v1',
  policyVersion: 'proposal-approval-v1',
  modelPolicyVersion: 'anthropic-primary-v1',
  evalSuiteVersion: 'attire-conformance-v1',
  prompt: ATTIRE_AGENT_PROMPT_V1,
})

export const PHOTOGRAPHER_ARTIFACT_BUNDLE_V1: AgentArtifactBundle = Object.freeze({
  id: 'photographer-v1',
  packKey: 'vendor_team',
  mode: 'decision',
  promptVersion: 'photographer-system-v1',
  toolsVersion: 'photographer-tools-v1',
  domainPackVersion: 'us-photographer-v1',
  policyVersion: 'proposal-approval-v1',
  modelPolicyVersion: 'anthropic-primary-v1',
  evalSuiteVersion: 'photographer-conformance-v1',
  prompt: PHOTOGRAPHER_AGENT_PROMPT_V1,
})

export const ATTIRE_ARTIFACT_BUNDLE_V2: AgentArtifactBundle = Object.freeze({
  ...ATTIRE_ARTIFACT_BUNDLE_V1,
  id: 'attire-v2',
  promptVersion: 'attire-system-v2',
  evalSuiteVersion: 'attire-conformance-v2',
  prompt: ATTIRE_AGENT_PROMPT_V2,
})

export const PHOTOGRAPHER_ARTIFACT_BUNDLE_V2: AgentArtifactBundle = Object.freeze({
  ...PHOTOGRAPHER_ARTIFACT_BUNDLE_V1,
  id: 'photographer-v2',
  promptVersion: 'photographer-system-v2',
  evalSuiteVersion: 'photographer-conformance-v2',
  prompt: PHOTOGRAPHER_AGENT_PROMPT_V2,
})

export const ATTIRE_ARTIFACT_BUNDLE: AgentArtifactBundle = Object.freeze({
  ...ATTIRE_ARTIFACT_BUNDLE_V2,
  id: 'attire-v3',
  promptVersion: 'attire-system-v3',
  toolsVersion: 'attire-tools-v2',
  policyVersion: 'proposal-approval-v2',
  evalSuiteVersion: 'attire-conformance-v3',
  prompt: ATTIRE_AGENT_PROMPT_V3,
})

export const PHOTOGRAPHER_ARTIFACT_BUNDLE: AgentArtifactBundle = Object.freeze({
  ...PHOTOGRAPHER_ARTIFACT_BUNDLE_V2,
  id: 'photographer-v3',
  promptVersion: 'photographer-system-v3',
  toolsVersion: 'photographer-tools-v2',
  policyVersion: 'proposal-approval-v2',
  evalSuiteVersion: 'photographer-conformance-v3',
  prompt: PHOTOGRAPHER_AGENT_PROMPT_V3,
})

const questScopingBundleV1 = (questKey: string): AgentArtifactBundle => Object.freeze({
  id: `quest-scoping-${questKey}-v1`,
  packKey: `${questKey}:scoping`,
  mode: 'decision',
  promptVersion: 'quest-scoping-system-v1',
  toolsVersion: 'quest-scoping-tools-v1',
  domainPackVersion: `${questKey}-content-v1`,
  policyVersion: 'proposal-approval-v1',
  modelPolicyVersion: 'anthropic-primary-v1',
  evalSuiteVersion: 'quest-scoping-conformance-v1',
  prompt: QUEST_SCOPING_AGENT_PROMPT_V1,
})

export const QUEST_SCOPING_ARTIFACT_BUNDLES_V1 = Object.freeze({
  foundation: questScopingBundleV1('foundation'),
  venue_date: questScopingBundleV1('venue_date'),
  vendor_team: questScopingBundleV1('vendor_team'),
  wedding_party: questScopingBundleV1('wedding_party'),
  attire_beauty: questScopingBundleV1('attire_beauty'),
  guests_stationery: questScopingBundleV1('guests_stationery'),
  guest_experience: questScopingBundleV1('guest_experience'),
  food_beverage: questScopingBundleV1('food_beverage'),
  design_flowers: questScopingBundleV1('design_flowers'),
  ceremony: questScopingBundleV1('ceremony'),
  registry_rings_honeymoon: questScopingBundleV1('registry_rings_honeymoon'),
  legal: questScopingBundleV1('legal'),
  pre_wedding_events: questScopingBundleV1('pre_wedding_events'),
  final_30_and_day_of: questScopingBundleV1('final_30_and_day_of'),
})

const questScopingBundleV2 = (questKey: keyof typeof QUEST_SCOPING_ARTIFACT_BUNDLES_V1): AgentArtifactBundle => Object.freeze({
  ...QUEST_SCOPING_ARTIFACT_BUNDLES_V1[questKey],
  id: `quest-scoping-${questKey}-v2`,
  promptVersion: 'quest-scoping-system-v2',
  toolsVersion: 'quest-scoping-tools-v2',
  policyVersion: 'proposal-approval-v2',
  evalSuiteVersion: 'quest-scoping-conformance-v2',
  prompt: QUEST_SCOPING_AGENT_PROMPT_V2,
})

export const QUEST_SCOPING_ARTIFACT_BUNDLES = Object.freeze(Object.fromEntries(
  (Object.keys(QUEST_SCOPING_ARTIFACT_BUNDLES_V1) as Array<keyof typeof QUEST_SCOPING_ARTIFACT_BUNDLES_V1>)
    .map(key => [key, questScopingBundleV2(key)]),
) as { [K in keyof typeof QUEST_SCOPING_ARTIFACT_BUNDLES_V1]: AgentArtifactBundle })

export const AGENT_ARTIFACT_BUNDLES: readonly AgentArtifactBundle[] = Object.freeze([
  ATTIRE_ARTIFACT_BUNDLE_V1,
  PHOTOGRAPHER_ARTIFACT_BUNDLE_V1,
  ATTIRE_ARTIFACT_BUNDLE_V2,
  PHOTOGRAPHER_ARTIFACT_BUNDLE_V2,
  ATTIRE_ARTIFACT_BUNDLE,
  PHOTOGRAPHER_ARTIFACT_BUNDLE,
  ...Object.values(QUEST_SCOPING_ARTIFACT_BUNDLES_V1),
  ...Object.values(QUEST_SCOPING_ARTIFACT_BUNDLES),
])

const bundles = new Map<string, AgentArtifactBundle>([
  ...AGENT_ARTIFACT_BUNDLES.map(bundle => [bundle.id, bundle] as const),
])

export function hasArtifactBundle(id: string): boolean {
  return bundles.has(id)
}

export function artifactBundle(id: string): AgentArtifactBundle {
  const bundle = bundles.get(id)
  if (!bundle) throw new Error(`Unknown agent artifact bundle: ${id}`)
  return bundle
}
