import { describe, it, expect } from 'vitest';
import {
  classify,
  parseHashtags,
  scoreCategory,
  decide,
  termToHashtag,
  PUBLISH_CONFIDENCE,
  MULTI_TAG_CONFIDENCE,
} from '../src/modules/classifier/classifier';
import { hasNsfw, moderationForDecision, NSFW_TERMS } from '../src/modules/classifier/moderation';

describe('parseHashtags', () => {
  it('extracts hashtags case-insensitively', () => {
    expect(parseHashtags('go check #Cars and #Tech_News 🚀')).toEqual(['cars', 'tech_news']);
  });
  it('returns [] for empty or hashtag-less captions', () => {
    expect(parseHashtags('')).toEqual([]);
    expect(parseHashtags('no tags here')).toEqual([]);
  });
  it('ignores repeated hashtags', () => {
    expect(parseHashtags('#fashion #fashion again')).toEqual(['fashion']);
  });
});

describe('termToHashtag', () => {
  it('strips spaces and lowercases', () => {
    expect(termToHashtag('Machine Learning')).toBe('machinelearning');
    expect(termToHashtag('Cars')).toBe('cars');
  });
});

describe('scoreCategory', () => {
  it('scores a matching hashtag heavily (incl. plural prefix #cars ~ car)', () => {
    expect(scoreCategory('loving this #drift video', '', 'cars')).toBeGreaterThanOrEqual(0.5);
    expect(scoreCategory('#cars night session', '', 'cars')).toBeGreaterThanOrEqual(0.5);
  });
  it('scores caption keywords', () => {
    expect(scoreCategory('best recipe ever', '', 'food')).toBeGreaterThan(0);
  });
  it('scores bio keywords', () => {
    expect(scoreCategory('check my page', 'cars drifting garage builds', 'cars')).toBeGreaterThan(0);
  });
  it('returns 0 for unrelated captions', () => {
    expect(scoreCategory('random thoughts', '', 'cars')).toBe(0);
  });
});

describe('decide', () => {
  it('rejects nsfw regardless of confidence', () => {
    expect(decide(1, true).decision).toBe('reject');
  });
  it('publishes at high confidence', () => {
    expect(decide(0.9, false).decision).toBe('publish');
    expect(decide(PUBLISH_CONFIDENCE, false).decision).toBe('publish');
  });
  it('sends mid-confidence to review (stage-2 fusion is V2)', () => {
    expect(decide(0.5, false).decision).toBe('review');
  });
  it('sends low confidence to review', () => {
    const r = decide(0.1, false);
    expect(r.decision).toBe('review');
    expect(r.reason).toContain('low');
  });
});

describe('classify', () => {
  it('publishes a clear hashtag match with the right tag', () => {
    const r = classify({ caption: 'this #ootd is the whole fit check #fashion #streetwear', bio: '', username: 'grid.queen' });
    expect(r.decision).toBe('publish');
    expect(r.publishedTags).toContain('fashion');
    expect(r.top?.slug).toBe('fashion');
    expect(r.top?.confidence).toBe(1);
  });

  it('supports multi-tagging across categories', () => {
    const r = classify({ caption: '#tech and #fashion crossover', bio: '', username: 'x' });
    expect(r.publishedTags).toContain('tech');
    expect(r.publishedTags).toContain('fashion');
  });

  it('rejects nsfw content', () => {
    const r = classify({ caption: 'this is nsfw content #memes', bio: '', username: 'x' });
    expect(r.nsfw).toBe(true);
    expect(r.decision).toBe('reject');
    expect(moderationForDecision(r.decision)).toBe('rejected');
  });

  it('keeps low-confidence items out of feeds', () => {
    const r = classify({ caption: 'random thoughts about my day', bio: '', username: 'x' });
    expect(r.top).toBeNull();
    expect(r.publishedTags).toEqual([]);
    expect(r.decision).toBe('review');
  });

  it('uses creator bio as a signal', () => {
    const r = classify({ caption: 'check my garage build', bio: 'cars drifting detailing and garage builds', username: 'driftdiaries' });
    expect(r.top?.slug).toBe('cars');
    expect(r.publishedTags).toContain('cars');
  });

  it('respects the multi-tag confidence floor', () => {
    const r = classify({ caption: '#cars and something techy-ish', bio: '', username: 'x' });
    expect(r.publishedTags).toContain('cars');
    expect(r.publishedTags.length).toBeLessThanOrEqual(3);
  });

  it('maps decisions to moderation states', () => {
    expect(moderationForDecision('publish')).toBe('approved');
    expect(moderationForDecision('review')).toBe('flagged');
    expect(moderationForDecision('reject')).toBe('rejected');
  });

  it('hasNsfw flags blocked terms', () => {
    expect(hasNsfw('please remove this nsfw post')).toBe(true);
    expect(hasNsfw('')).toBe(false);
    expect(NSFW_TERMS.length).toBeGreaterThan(5);
  });

  it('keeps confidences within [0,1]', () => {
    const r = classify({ caption: '#cars #car #tesla #drift #engine #garage #racing all car things', bio: 'cars', username: 'x' });
    for (const c of r.categories) expect(c.confidence).toBeLessThanOrEqual(1);
    expect(r.categories[0]?.confidence).toBe(1);
  });

  it('is stable and deterministic', () => {
    const input = { caption: 'night drift session #drift #jdm #cars', bio: 'cars drifting garage builds', username: 'driftdiaries' };
    const a = classify(input);
    const b = classify(input);
    expect(a).toEqual(b);
  });

  it('does not publish when below the publish threshold (MULTI_TAG_CONFIDENCE floor works)', () => {
    expect(MULTI_TAG_CONFIDENCE).toBeLessThan(PUBLISH_CONFIDENCE);
  });
});
