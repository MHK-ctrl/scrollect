import { LEXICONS, CATEGORY_SLUGS } from './lexicons';
import { hasNsfw } from './moderation';

/**
 * Lexical (Stage 1) classifier — SCROLLECT-SPEC.md §3.2.
 * Pure functions; zero I/O; unit-tested to ≥80% line coverage.
 *
 * Weighted scoring:
 *   exact hashtag 3.0 | keyword in caption 2.0 | light lemma 1.5 | creator bio 1.0
 * conf = min(1, raw / 6). Multi-tag: top-3 categories with conf ≥ 0.35.
 */

export const HASHTAG_WEIGHT = 3.0;
export const CAPTION_WEIGHT = 2.0;
export const LEMMA_WEIGHT = 1.5;
export const BIO_WEIGHT = 1.0;
export const CONF_SCALE = 6.0;

export const PUBLISH_CONFIDENCE = 0.75; // lexical alone is enough above this
export const MULTI_TAG_CONFIDENCE = 0.35; // top-3 tags kept above this

export interface CategoryScore {
  slug: string;
  confidence: number;
}

export type ClassifyDecision = 'publish' | 'review' | 'reject';

export interface ClassifierInput {
  caption: string;
  bio: string;
  username: string;
}

export interface ClassificationResult {
  categories: CategoryScore[]; // all with conf ≥ 0.05, descending
  publishedTags: string[]; // top-3 with conf ≥ 0.35 (feed membership)
  top: CategoryScore | null;
  nsfw: boolean;
  decision: ClassifyDecision;
  reason: string;
}

export function parseHashtags(caption: string): string[] {
  const out = new Set<string>();
  for (const m of caption.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    out.add(m[1].toLowerCase());
  }
  return [...out];
}

/** Normalize a lexicon term to hashtag form: "machine learning" -> "machinelearning". */
export function termToHashtag(term: string): string {
  return term.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function lightLemma(word: string, term: string): boolean {
  if (word === term) return true;
  // cheap stem: "drift" matches "drifting", "learn" matches "learning"
  return word.startsWith(term) && word.length <= term.length + 4;
}

function captionWords(caption: string): string[] {
  return caption.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean);
}

export function scoreCategory(caption: string, bio: string, slug: string): number {
  const terms = LEXICONS[slug] ?? [];
  if (terms.length === 0) return 0;

  const hashtags = parseHashtags(caption);
  const tagSet = new Set(hashtags.map((h) => h.toLowerCase()));
  const words = captionWords(caption);
  const bioLower = bio.toLowerCase();
  const captionLower = caption.toLowerCase();

  let raw = 0;
  for (const term of terms) {
    const termTag = termToHashtag(term);
    // Hashtag hit: exact, or prefix for plurals/derivatives ("#cars" ~ "car").
    const tagHit = [...tagSet].some((h) => h === termTag || (termTag.length >= 3 && h.startsWith(termTag)));
    if (tagHit) {
      raw += HASHTAG_WEIGHT;
      continue;
    }
    if (captionLower.includes(term)) {
      raw += CAPTION_WEIGHT;
      continue;
    }
    if (words.some((w) => lightLemma(w, term))) raw += LEMMA_WEIGHT;
    if (bioLower.includes(term)) raw += BIO_WEIGHT;
  }
  return Math.min(1, raw / CONF_SCALE);
}

/** Pure decision rule (MVP = lexical only; Stage-2 fusion is V2 per spec §5.2). */
export function decide(maxConfidence: number, nsfw: boolean): { decision: ClassifyDecision; reason: string } {
  if (nsfw) return { decision: 'reject', reason: 'nsfw' };
  if (maxConfidence >= PUBLISH_CONFIDENCE) return { decision: 'publish', reason: 'lexical-confidence' };
  if (maxConfidence >= MULTI_TAG_CONFIDENCE) {
    return { decision: 'review', reason: 'below-publish-threshold-stage2-in-v2' };
  }
  return { decision: 'review', reason: 'low-confidence' };
}

export function classify(input: ClassifierInput): ClassificationResult {
  const caption = (input.caption ?? '').toLowerCase();
  const bio = (input.bio ?? '').toLowerCase();

  const scores: CategoryScore[] = [];
  for (const slug of CATEGORY_SLUGS) {
    const confidence = scoreCategory(caption, bio, slug);
    if (confidence >= 0.05) scores.push({ slug, confidence });
  }
  scores.sort((a, b) => b.confidence - a.confidence);

  const top = scores[0] ?? null;
  const publishedTags = scores.filter((s) => s.confidence >= MULTI_TAG_CONFIDENCE).slice(0, 3).map((s) => s.slug);
  const nsfw = hasNsfw(`${caption} ${bio}`);
  const { decision, reason } = decide(top?.confidence ?? 0, nsfw);

  return { categories: scores, publishedTags, top, nsfw, decision, reason };
}
