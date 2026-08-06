package com.scrollect.app.core.data.mock

import com.scrollect.app.core.data.ScrollectRepository
import com.scrollect.app.core.data.model.Category
import com.scrollect.app.core.data.model.FeedItem
import com.scrollect.app.core.data.model.FeedPage
import com.scrollect.app.core.data.model.UserSession
import java.util.UUID
import javax.inject.Inject
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Offline mock — full UX (onboarding → feed → like/save → settings) with zero Meta setup. */
class MockRepository @Inject constructor() : ScrollectRepository {

    private val mutex = Mutex()
    private val liked = mutableSetOf<String>()
    private val saved = mutableSetOf<String>()
    private var deviceId: String? = null

    override suspend fun getCategories(): List<Category> = MockCatalog.categories

    override suspend fun getFeed(categories: List<String>, cursor: String?, limit: Int): FeedPage =
        mutex.withLock {
            val filtered = if (categories.isEmpty()) MockCatalog.allItems else MockCatalog.allItems.filter { item ->
                item.categories.any { categories.contains(it) }
            }
            val start = cursor?.let { c -> filtered.indexOfFirst { it.id == c } + 1 } ?: 0
            val page = filtered.drop(start).take(limit)
            FeedPage(
                items = page.map { it.copy(liked = liked.contains(it.id), saved = saved.contains(it.id)) },
                nextCursor = page.lastOrNull()?.id,
            )
        }

    override suspend fun setLike(mediaId: String, liked: Boolean): Boolean = mutex.withLock {
        if (liked) this.liked.add(mediaId) else this.liked.remove(mediaId)
        liked
    }

    override suspend fun setSave(mediaId: String, saved: Boolean): Boolean = mutex.withLock {
        if (saved) this.saved.add(mediaId) else this.saved.remove(mediaId)
        saved
    }

    override suspend fun loginDevice(): UserSession = mutex.withLock {
        val id = deviceId ?: "mock-device-${UUID.randomUUID()}".also { deviceId = it }
        UserSession(userId = id)
    }

    override suspend fun setInterests(interests: List<String>): List<String> = interests

    override suspend fun getCreator(creatorId: String): com.scrollect.app.core.data.model.CreatorSummary? =
        MockCatalog.creatorById(creatorId)

    override suspend fun getCreatorMedia(creatorId: String): List<FeedItem> =
        mutex.withLock { MockCatalog.byCreator(creatorId).map { it.copy(liked = liked.contains(it.id), saved = saved.contains(it.id)) } }
}
