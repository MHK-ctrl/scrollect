import type { ModerationState } from '../../lib/db/types';

/**
 * Moderation (SCROLLECT-SPEC.md §3.2). Lexical NSFW screening + decision
 * mapping to moderation states. Never publishes flagged content.
 */

export const NSFW_TERMS: string[] = [
  'nsfw', 'nude', 'nudity', 'porn', 'sex', 'sextape', 'gore', 'selfharm', 'suicide',
  'naked', 'xxx', 'explicit content', 'lewd',
];

/** Tasteful lexical screening — Stage-2 CV/LLM screening is V2 (spec §5.2). */
export function hasNsfw(text: string): boolean {
  const lower = (text ?? '').toLowerCase();
  return NSFW_TERMS.some((t) => lower.includes(t));
}

export function moderationForDecision(decision: 'publish' | 'review' | 'reject'): ModerationState {
  switch (decision) {
    case 'publish':
      return 'approved';
    case 'review':
      return 'flagged';
    case 'reject':
      return 'rejected';
  }
}
