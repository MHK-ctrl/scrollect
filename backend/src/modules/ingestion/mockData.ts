/**
 * Deterministic MOCK dataset (MOCK_MODE). Seeded creators + Reels metadata so
 * the full UX works with zero Meta setup. Mirror of the Android offline mock.
 * Thumbnails: picsum.photos (network) — Coil/async images degrade to a gradient
 * placeholder offline. Playable items use public sample videos so Media3 has a
 * real URL; card-mode items (videoUrl null) exercise the licensed-audio fallback.
 */

export interface MockCreatorSeed {
  username: string;
  igUserId: string;
  accountType: string;
  bio: string;
}

export interface MockMediaSeed {
  username: string;
  caption: string;
  playable: boolean;
  likeCount: number;
  commentCount: number;
  daysAgo: number;
}

export const MOCK_CREATORS: MockCreatorSeed[] = [
  { username: 'grid.queen', igUserId: 'mock-ig-101', accountType: 'CREATOR', bio: 'fashion stylist & streetwear. outfit of the day posts.' },
  { username: 'bytebuddy', igUserId: 'mock-ig-102', accountType: 'CREATOR', bio: 'tech reviews, unboxing and coding tutorials.' },
  { username: 'driftdiaries', igUserId: 'mock-ig-103', accountType: 'CREATOR', bio: 'cars, drifting, detailing and garage builds.' },
  { username: 'macro.munchies', igUserId: 'mock-ig-104', accountType: 'CREATOR', bio: 'cooking recipes, kitchen tips and food.' },
  { username: 'ironvibes', igUserId: 'mock-ig-105', accountType: 'CREATOR', bio: 'gym training, workouts and fitness motivation.' },
  { username: 'wanderfax', igUserId: 'mock-ig-106', accountType: 'CREATOR', bio: 'travel guides, road trips and adventure.' },
  { username: 'pixelpunk', igUserId: 'mock-ig-107', accountType: 'CREATOR', bio: 'gaming, gameplays and esports.' },
  { username: 'bassdrop', igUserId: 'mock-ig-108', accountType: 'CREATOR', bio: 'music producer, beats and studio sessions.' },
  { username: 'canvas.kid', igUserId: 'mock-ig-109', accountType: 'CREATOR', bio: 'digital art, drawing and design.' },
  { username: 'lolpress', igUserId: 'mock-ig-110', accountType: 'CREATOR', bio: 'comedy skits, memes and jokes.' },
  { username: 'finfree', igUserId: 'mock-ig-111', accountType: 'CREATOR', bio: 'personal finance, investing and budgeting.' },
  { username: 'pawprint', igUserId: 'mock-ig-112', accountType: 'CREATOR', bio: 'pets, dogs, cats and rescue stories.' },
  { username: 'newton.mind', igUserId: 'mock-ig-113', accountType: 'CREATOR', bio: 'science experiments and physics explained.' },
  { username: 'study.streak', igUserId: 'mock-ig-114', accountType: 'CREATOR', bio: 'study tips, education and learning.' },
];

const SAMPLE_VIDEOS = [
  'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
  'https://storage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
];

// 3 Reels per category; ~40% playable (the rest exercise card mode).
export const MOCK_MEDIA: MockMediaSeed[] = [
  { username: 'grid.queen', caption: 'this #ootd is the whole fit check 🧥✨ #fashion #streetwear', playable: true, likeCount: 8420, commentCount: 312, daysAgo: 1 },
  { username: 'grid.queen', caption: 'vintage jacket styling — style tips for your wardrobe', playable: false, likeCount: 3100, commentCount: 89, daysAgo: 3 },
  { username: 'grid.queen', caption: 'new sneakers, new drip. #fashionweek lookbook', playable: false, likeCount: 5210, commentCount: 142, daysAgo: 5 },
  { username: 'bytebuddy', caption: 'this new smartphone camera is insane 📱 #tech #unboxing', playable: true, likeCount: 12040, commentCount: 640, daysAgo: 1 },
  { username: 'bytebuddy', caption: 'coding tutorial: build an app in 60 seconds #developer #coding', playable: false, likeCount: 9870, commentCount: 410, daysAgo: 2 },
  { username: 'bytebuddy', caption: 'AI explained for beginners #ai #machine learning', playable: false, likeCount: 15000, commentCount: 980, daysAgo: 6 },
  { username: 'driftdiaries', caption: 'night drift session 🏎️ #drift #jdm #cars', playable: true, likeCount: 20400, commentCount: 1100, daysAgo: 1 },
  { username: 'driftdiaries', caption: 'engine build in the garage — full detail #engine #garage', playable: false, likeCount: 7300, commentCount: 250, daysAgo: 4 },
  { username: 'driftdiaries', caption: 'electric vehicle vs supercar — which wins? #ev #supercar', playable: false, likeCount: 12800, commentCount: 1340, daysAgo: 7 },
  { username: 'macro.munchies', caption: '30-second pasta recipe 🍜 #recipe #cooking #foodie', playable: true, likeCount: 9800, commentCount: 420, daysAgo: 1 },
  { username: 'macro.munchies', caption: 'vegan burger that actually tastes good #vegan #foodtok', playable: false, likeCount: 6200, commentCount: 280, daysAgo: 3 },
  { username: 'macro.munchies', caption: 'sushi at home — chef skills #chef #kitchen', playable: false, likeCount: 4500, commentCount: 160, daysAgo: 8 },
  { username: 'ironvibes', caption: 'leg day — no excuses 💪 #gym #workout #fitnessmotivation', playable: true, likeCount: 8800, commentCount: 350, daysAgo: 1 },
  { username: 'ironvibes', caption: '10 min yoga for beginners #yoga #flexibility', playable: false, likeCount: 5200, commentCount: 190, daysAgo: 4 },
  { username: 'ironvibes', caption: 'protein recipes for muscle #protein #diet', playable: false, likeCount: 3400, commentCount: 95, daysAgo: 9 },
  { username: 'wanderfax', caption: 'road trip through the coast 🌍 #travel #roadtrip', playable: true, likeCount: 7400, commentCount: 300, daysAgo: 2 },
  { username: 'wanderfax', caption: 'backpacking 101 — first trip guide #backpacking #adventure', playable: false, likeCount: 6100, commentCount: 220, daysAgo: 5 },
  { username: 'wanderfax', caption: 'hidden island beaches #island #bucketlist', playable: false, likeCount: 8900, commentCount: 410, daysAgo: 10 },
  { username: 'pixelpunk', caption: 'ranked grind — gameplays 🎮 #gaming #esports #twitch', playable: true, likeCount: 6600, commentCount: 290, daysAgo: 1 },
  { username: 'pixelpunk', caption: 'speedrun of the classic — new record #speedrun #indie', playable: false, likeCount: 4800, commentCount: 175, daysAgo: 6 },
  { username: 'pixelpunk', caption: 'best indie games you missed #indie #rpg', playable: false, likeCount: 3900, commentCount: 130, daysAgo: 11 },
  { username: 'bassdrop', caption: 'beat drop in the studio 🎧 #musicproducer #beat', playable: true, likeCount: 5700, commentCount: 210, daysAgo: 2 },
  { username: 'bassdrop', caption: 'guitar riff of the day #guitar #band', playable: false, likeCount: 4300, commentCount: 150, daysAgo: 5 },
  { username: 'bassdrop', caption: 'festival season setlist #festival #dj', playable: false, likeCount: 7600, commentCount: 340, daysAgo: 12 },
  { username: 'canvas.kid', caption: 'drawing a portrait — timelapse #digitalart #drawing', playable: true, likeCount: 6900, commentCount: 260, daysAgo: 1 },
  { username: 'canvas.kid', caption: 'procreate tutorial: glow effect #procreate #art', playable: false, likeCount: 5100, commentCount: 185, daysAgo: 4 },
  { username: 'canvas.kid', caption: 'street mural in progress #graffiti #mural', playable: false, likeCount: 8200, commentCount: 390, daysAgo: 9 },
  { username: 'lolpress', caption: 'POV: you forget your wallet 😂 #comedy #skit #relatable', playable: true, likeCount: 21000, commentCount: 1500, daysAgo: 1 },
  { username: 'lolpress', caption: 'my dog judging my cooking #memes #funny', playable: false, likeCount: 17400, commentCount: 1100, daysAgo: 3 },
  { username: 'lolpress', caption: 'office pranks gone wrong #prank #funnyvideo', playable: false, likeCount: 13000, commentCount: 820, daysAgo: 8 },
  { username: 'finfree', caption: '5 passive income ideas that work 💰 #finance #passive income', playable: true, likeCount: 11200, commentCount: 720, daysAgo: 2 },
  { username: 'finfree', caption: 'budgeting for beginners #budget #savings', playable: false, likeCount: 6800, commentCount: 240, daysAgo: 5 },
  { username: 'finfree', caption: 'investing vs saving — the math #invest #stocks #fintok', playable: false, likeCount: 9400, commentCount: 510, daysAgo: 10 },
  { username: 'pawprint', caption: 'puppy tries stairs for the first time 🐾 #puppy #cute #pets', playable: true, likeCount: 26000, commentCount: 1900, daysAgo: 1 },
  { username: 'pawprint', caption: 'cat rescue story #rescue #catsoftiktok', playable: false, likeCount: 15000, commentCount: 900, daysAgo: 4 },
  { username: 'pawprint', caption: 'teaching my parrot to talk #parrot #petlove', playable: false, likeCount: 11000, commentCount: 620, daysAgo: 7 },
  { username: 'newton.mind', caption: 'black hole explained in 60s #space #astronomy #physics', playable: true, likeCount: 9800, commentCount: 540, daysAgo: 1 },
  { username: 'newton.mind', caption: 'home experiment: DIY battery #experiment #science', playable: false, likeCount: 7100, commentCount: 310, daysAgo: 6 },
  { username: 'newton.mind', caption: 'quantum physics for everyone #quantum #stem', playable: false, likeCount: 8600, commentCount: 470, daysAgo: 11 },
  { username: 'study.streak', caption: 'study tips that actually work 🎓 #study #education #student', playable: true, likeCount: 5300, commentCount: 200, daysAgo: 2 },
  { username: 'study.streak', caption: 'how to take better notes #study #homework', playable: false, likeCount: 4100, commentCount: 140, daysAgo: 5 },
  { username: 'study.streak', caption: 'exam prep in 7 days #exam #course', playable: false, likeCount: 4800, commentCount: 175, daysAgo: 9 },
];

const thumb = (seed: string) => `https://picsum.photos/seed/${seed}/720/1280`;

export function mockThumbnailFor(igMediaId: string): string {
  return thumb(igMediaId);
}

export function mockVideoFor(index: number): string {
  return SAMPLE_VIDEOS[index % SAMPLE_VIDEOS.length];
}

export function mediaSeedsFor(username: string): MockMediaSeed[] {
  return MOCK_MEDIA.filter((m) => m.username === username).sort((a, b) => b.daysAgo - a.daysAgo);
}
