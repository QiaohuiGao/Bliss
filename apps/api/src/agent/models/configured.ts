import type { AgentModel } from '../types'
import { AnthropicAgentModel } from './anthropic'
import { GeminiAgentModel } from './gemini'

export type AgentModelProvider = 'anthropic' | 'gemini'

function providerFromEnvironment(): AgentModelProvider | null {
  const configured = process.env['AGENT_MODEL_PROVIDER']?.trim().toLowerCase()
  if (configured === 'anthropic' || configured === 'gemini') return configured
  if (configured) return null
  if (process.env['GEMINI_API_KEY'] && process.env['GEMINI_MODEL']) return 'gemini'
  if (process.env['ANTHROPIC_API_KEY'] && process.env['ANTHROPIC_MODEL']) return 'anthropic'
  return null
}

export function configuredAgentModel(): AgentModel | null {
  const provider = providerFromEnvironment()
  if (provider === 'gemini') {
    const apiKey = process.env['GEMINI_API_KEY']
    const model = process.env['GEMINI_MODEL']
    if (!apiKey || !model) return null
    return new GeminiAgentModel({ apiKey, model })
  }
  if (provider === 'anthropic') {
    const apiKey = process.env['ANTHROPIC_API_KEY']
    const model = process.env['ANTHROPIC_MODEL']
    if (!apiKey || !model) return null
    return new AnthropicAgentModel({ apiKey, model })
  }
  return null
}
