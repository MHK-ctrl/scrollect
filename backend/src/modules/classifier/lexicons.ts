/** Category taxonomy + keyword lexicons (SCROLLECT-SPEC.md §3.1-§3.2). */

export interface CategoryInfo {
  slug: string;
  label: string;
  emoji: string;
  adjacent: string[];
}

export const CATEGORIES: CategoryInfo[] = [
  { slug: 'education', label: 'Education', emoji: '🎓', adjacent: ['science', 'tech'] },
  { slug: 'tech', label: 'Tech', emoji: '📱', adjacent: ['science', 'finance'] },
  { slug: 'cars', label: 'Cars', emoji: '🏎️', adjacent: ['travel', 'diy'] },
  { slug: 'fashion', label: 'Fashion', emoji: '🧥', adjacent: ['art-design', 'beauty'] },
  { slug: 'fitness', label: 'Fitness', emoji: '💪', adjacent: ['food', 'sports'] },
  { slug: 'food', label: 'Food', emoji: '🍜', adjacent: ['travel', 'fitness'] },
  { slug: 'travel', label: 'Travel', emoji: '🌍', adjacent: ['food', 'nature'] },
  { slug: 'gaming', label: 'Gaming', emoji: '🎮', adjacent: ['tech', 'comedy'] },
  { slug: 'music', label: 'Music', emoji: '🎧', adjacent: ['comedy', 'art-design'] },
  { slug: 'art-design', label: 'Art & Design', emoji: '🎨', adjacent: ['fashion', 'music'] },
  { slug: 'comedy', label: 'Comedy', emoji: '😂', adjacent: ['gaming', 'pets'] },
  { slug: 'finance', label: 'Finance', emoji: '💰', adjacent: ['tech', 'education'] },
  { slug: 'pets', label: 'Pets', emoji: '🐾', adjacent: ['comedy', 'nature'] },
  { slug: 'science', label: 'Science', emoji: '🔬', adjacent: ['education', 'tech'] },
];

export const CATEGORY_SLUGS = new Set(CATEGORIES.map((c) => c.slug));

/** Keyword lexicon per category (seed set; extend in classifier/lexicons.json later). */
export const LEXICONS: Record<string, string[]> = {
  education: ['learn', 'study', 'lesson', 'course', 'tutorial', 'school', 'college', 'university', 'exam', 'history', 'math', 'teacher', 'student', 'homework', 'education', 'class', 'lecture', 'grammar', 'scholar', 'degree', 'didyouknow', 'facts', 'explained', 'howto', 'skill'],
  tech: ['tech', 'gadget', 'phone', 'iphone', 'android', 'laptop', 'software', 'app', 'ai', 'coding', 'code', 'developer', 'programming', 'gpu', 'crypto', 'startup', 'robot', 'smartphone', 'unboxing', 'camera', 'cyber', 'machine learning', 'technews', 'devlife', 'opensource'],
  cars: ['car', 'tesla', 'bmw', 'mercedes', 'ferrari', 'porsche', 'lambo', 'drift', 'engine', 'detailing', 'garage', 'ev', 'horsepower', 'turbo', 'supercar', 'v8', 'jdm', 'motorsport', 'f1', 'racing', 'wheels', 'suv', 'truck', 'carreview', 'cargram'],
  fashion: ['fashion', 'style', 'outfit', 'ootd', 'streetwear', 'sneakers', 'drip', 'vintage', 'runway', 'stylist', 'wardrobe', 'boutique', 'fashionweek', 'lookbook', 'trend', 'jacket', 'dress', 'accessories', 'bag', 'jewelry', 'fitcheck'],
  fitness: ['fitness', 'gym', 'workout', 'exercise', 'training', 'muscle', 'protein', 'yoga', 'cardio', 'strength', 'reps', 'squat', 'deadlift', 'running', 'marathon', 'pilates', 'hiit', 'fitnessmotivation', 'bodybuilding', 'coach', 'diet', 'abs', 'lift', 'gymrat'],
  food: ['food', 'recipe', 'cook', 'cooking', 'baking', 'kitchen', 'chef', 'tasty', 'meal', 'breakfast', 'dinner', 'dessert', 'pizza', 'pasta', 'sushi', 'burger', 'vegan', 'snack', 'foodie', 'foodtok', 'grill', 'spice', 'flavor'],
  travel: ['travel', 'trip', 'vacation', 'journey', 'explore', 'wanderlust', 'beach', 'adventure', 'backpacking', 'tourist', 'roadtrip', 'passport', 'flight', 'hotel', 'island', 'hiking', 'destination', 'travelgram', 'bucketlist'],
  gaming: ['gaming', 'game', 'gamer', 'playstation', 'xbox', 'nintendo', 'pcgaming', 'esports', 'fortnite', 'minecraft', 'gta', 'cod', 'streamer', 'twitch', 'fps', 'rpg', 'gameplay', 'walkthrough', 'speedrun', 'indie', 'console', 'controller'],
  music: ['music', 'song', 'album', 'artist', 'rapper', 'beat', 'dj', 'concert', 'festival', 'guitar', 'piano', 'drums', 'singer', 'lyrics', 'tune', 'melody', 'remix', 'vocal', 'musicproducer', 'soundcloud', 'band'],
  'art-design': ['art', 'artist', 'drawing', 'painting', 'sketch', 'design', 'illustration', 'digitalart', 'procreate', 'sculpture', 'graffiti', 'animation', '3dart', 'creative', 'canvas', 'artwork', 'mural', 'tattoo', 'typography'],
  comedy: ['comedy', 'funny', 'joke', 'memes', 'meme', 'lol', 'hilarious', 'skit', 'prank', 'parody', 'comic', 'roast', 'sarcasm', 'comedian', 'funnyvideo', 'funnymoments', 'trending', 'relatable', 'satire'],
  finance: ['finance', 'money', 'invest', 'investing', 'stock', 'stocks', 'crypto', 'bitcoin', 'trading', 'savings', 'budget', 'debt', 'credit', 'wealth', 'passive income', 'retirement', 'loan', 'interest', 'tax', 'side hustle', 'fintok', 'financial'],
  pets: ['pet', 'pets', 'dog', 'cat', 'kitten', 'puppy', 'cute', 'animals', 'rescue', 'vet', 'hamster', 'parrot', 'petlove', 'petsoftiktok', 'dogsoftiktok', 'catsoftiktok', 'adopt', 'petcare'],
  science: ['science', 'physics', 'chemistry', 'biology', 'space', 'nasa', 'astronomy', 'experiment', 'lab', 'quantum', 'dna', 'evolution', 'atom', 'cosmos', 'galaxy', 'blackhole', 'scientist', 'stem', 'vaccine', 'research', 'discovery'],
};
