package com.scrollect.app.core.data.mock

import com.scrollect.app.core.data.model.Category
import com.scrollect.app.core.data.model.CreatorSummary
import com.scrollect.app.core.data.model.FeedItem

/**
 * Deterministic offline MOCK dataset — mirrors the backend mock (spec: zero
 * Meta setup). Thumbnails: picsum.photos; playable items use public sample
 * videos; card-mode items (videoUrl == null) exercise the licensed-audio
 * fallback (spec §3.4). Offline, Coil renders the gradient placeholder.
 */
object MockCatalog {

    val categories: List<Category> = listOf(
        Category("education", "Education", "🎓", listOf("science", "tech")),
        Category("tech", "Tech", "📱", listOf("science", "finance")),
        Category("cars", "Cars", "🏎️", listOf("travel")),
        Category("fashion", "Fashion", "🧥", listOf("art-design")),
        Category("fitness", "Fitness", "💪", listOf("food")),
        Category("food", "Food", "🍜", listOf("travel", "fitness")),
        Category("travel", "Travel", "🌍", listOf("food")),
        Category("gaming", "Gaming", "🎮", listOf("tech", "comedy")),
        Category("music", "Music", "🎧", listOf("comedy", "art-design")),
        Category("art-design", "Art & Design", "🎨", listOf("fashion", "music")),
        Category("comedy", "Comedy", "😂", listOf("gaming", "pets")),
        Category("finance", "Finance", "💰", listOf("tech", "education")),
        Category("pets", "Pets", "🐾", listOf("comedy")),
        Category("science", "Science", "🔬", listOf("education", "tech")),
    )

    private data class MockCreator(val id: String, val username: String)

    private val creators = listOf(
        MockCreator("c-grid-queen", "grid.queen"),
        MockCreator("c-bytebuddy", "bytebuddy"),
        MockCreator("c-drift", "driftdiaries"),
        MockCreator("c-munchies", "macro.munchies"),
        MockCreator("c-iron", "ironvibes"),
        MockCreator("c-wander", "wanderfax"),
        MockCreator("c-pixel", "pixelpunk"),
        MockCreator("c-bass", "bassdrop"),
        MockCreator("c-canvas", "canvas.kid"),
        MockCreator("c-lol", "lolpress"),
        MockCreator("c-fin", "finfree"),
        MockCreator("c-paw", "pawprint"),
        MockCreator("c-newton", "newton.mind"),
        MockCreator("c-study", "study.streak"),
    )

    private val sampleVideos = listOf(
        "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    )

    // slug -> (creator index, captions). Even index playable, odd index card-mode.
    private val seeds: Map<String, List<Pair<Int, String>>> = mapOf(
        "fashion" to listOf(0 to "this #ootd is the whole fit check 🧥✨ #fashion #streetwear", 0 to "vintage jacket styling — style tips for your wardrobe"),
        "tech" to listOf(1 to "this new smartphone camera is insane 📱 #tech #unboxing", 1 to "coding tutorial: build an app in 60 seconds #developer #coding"),
        "cars" to listOf(2 to "night drift session 🏎️ #drift #jdm #cars", 2 to "engine build in the garage — full detail #engine #garage"),
        "food" to listOf(3 to "30-second pasta recipe 🍜 #recipe #cooking #foodie", 3 to "vegan burger that actually tastes good #vegan #foodtok"),
        "fitness" to listOf(4 to "leg day — no excuses 💪 #gym #workout #fitnessmotivation", 4 to "10 min yoga for beginners #yoga"),
        "travel" to listOf(5 to "road trip through the coast 🌍 #travel #roadtrip", 5 to "backpacking 101 — first trip guide #backpacking #adventure"),
        "gaming" to listOf(6 to "ranked grind — gameplays 🎮 #gaming #esports", 6 to "speedrun of the classic — new record #speedrun"),
        "music" to listOf(7 to "beat drop in the studio 🎧 #musicproducer #beat", 7 to "guitar riff of the day #guitar"),
        "art-design" to listOf(8 to "drawing a portrait — timelapse #digitalart #drawing", 8 to "procreate tutorial: glow effect #procreate #art"),
        "comedy" to listOf(9 to "POV: you forget your wallet 😂 #comedy #skit #relatable", 9 to "my dog judging my cooking #memes #funny"),
        "finance" to listOf(10 to "5 passive income ideas that work 💰 #finance", 10 to "budgeting for beginners #budget #savings"),
        "pets" to listOf(11 to "puppy tries stairs for the first time 🐾 #puppy #cute #pets", 11 to "cat rescue story #rescue #catsoftiktok"),
        "science" to listOf(12 to "black hole explained in 60s #space #astronomy #physics", 12 to "home experiment: DIY battery #experiment #science"),
        "education" to listOf(13 to "study tips that actually work 🎓 #study #education #student", 13 to "how to take better notes #study"),
    )

    private fun thumb(seed: String) = "https://picsum.photos/seed/$seed/720/1280"

    private val generated: List<FeedItem> = run {
        val items = mutableListOf<FeedItem>()
        var n = 0
        for ((slug, creatorAndCaptions) in seeds) {
            for ((creatorIndex, caption) in creatorAndCaptions) {
                val creator = creators[creatorIndex]
                val playable = n % 2 == 0
                val id = "mock-$slug-$n"
                items += FeedItem(
                    id = id,
                    caption = caption,
                    mediaType = "VIDEO",
                    thumbnailUrl = thumb(id),
                    videoUrl = if (playable) sampleVideos[n % sampleVideos.size] else null,
                    permalink = "https://instagram.com/${creator.username}/reel/$id",
                    likeCount = 3_000 + (n * 777) % 24_000,
                    commentCount = 50 + (n * 37) % 1_900,
                    categories = listOf(slug),
                    isCardMode = !playable,
                    liked = false,
                    saved = false,
                    creator = CreatorSummary(creator.id, creator.username),
                )
                n += 1
            }
        }
        items.shuffled(Random(42)) // stable pseudo-random order across launches
    }

    val allItems: List<FeedItem> = generated

    fun byId(id: String): FeedItem? = generated.firstOrNull { it.id == id }

    fun byCreator(creatorId: String): List<FeedItem> = generated.filter { it.creator.id == creatorId }

    fun creatorById(creatorId: String): CreatorSummary? = creators.firstOrNull { it.id == creatorId }?.let { CreatorSummary(it.id, it.username) }
}

private class Random(seed: Long) : kotlin.random.Random() {
    private var state = seed
    override fun nextBits(bitCount: Int): Int {
        state = state * 6364136223846793005L + 1442695040888963407L
        return (state ushr (64 - bitCount)).toInt()
    }
}
