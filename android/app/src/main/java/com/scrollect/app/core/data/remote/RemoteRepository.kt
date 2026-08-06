package com.scrollect.app.core.data.remote

import com.scrollect.app.core.data.ScrollectRepository
import com.scrollect.app.core.data.SessionManager
import com.scrollect.app.core.data.model.Category
import com.scrollect.app.core.data.model.CreatorSummary
import com.scrollect.app.core.data.model.FeedItem
import com.scrollect.app.core.data.model.FeedPage
import com.scrollect.app.core.data.model.UserSession
import java.io.IOException
import javax.inject.Inject

/** Backend-backed implementation (live flavor). Same contract as MockRepository. */
class RemoteRepository @Inject constructor(
    private val api: ScrollectApi,
    private val session: SessionManager,
) : ScrollectRepository {

    private fun dtoToItem(d: FeedItemDto): FeedItem = FeedItem(
        id = d.id,
        caption = d.caption,
        mediaType = d.mediaType,
        thumbnailUrl = d.thumbnailUrl,
        videoUrl = d.videoUrl,
        permalink = d.permalink,
        likeCount = d.likeCount,
        commentCount = d.commentCount,
        categories = d.categories,
        isCardMode = d.isCardMode,
        liked = d.liked,
        saved = d.saved,
        creator = CreatorSummary(d.creator.id, d.creator.username),
    )

    override suspend fun getCategories(): List<Category> =
        api.categories().categories.map { Category(it.slug, it.label, it.emoji, it.adjacent) }

    override suspend fun getFeed(categories: List<String>, cursor: String?, limit: Int): FeedPage {
        val res = api.feed(categories.joinToString(",").ifBlank { null }, cursor, limit)
        return FeedPage(res.items.map(::dtoToItem), res.nextCursor)
    }

    override suspend fun setLike(mediaId: String, liked: Boolean): Boolean = try {
        api.like(mediaId, LikeRequest(liked)).liked
    } catch (e: IOException) {
        // Offline: local-only echo; state re-syncs on next load.
        liked
    }

    override suspend fun setSave(mediaId: String, saved: Boolean): Boolean = try {
        api.save(mediaId, SaveRequest(saved)).saved
    } catch (e: IOException) {
        saved
    }

    override suspend fun loginDevice(): UserSession {
        val deviceId = session.ensureDeviceId()
        val res = api.device(DeviceRequest(deviceId))
        session.setAuthToken(res.token)
        return UserSession(res.user.id, res.user.interests)
    }

    override suspend fun setInterests(interests: List<String>): List<String> {
        val res = api.interests(InterestsRequest(interests))
        session.setInterests(res.interests)
        return res.interests
    }

    override suspend fun getCreator(creatorId: String): CreatorSummary? =
        api.creator(creatorId).creator.let { CreatorSummary(it.id, it.username) }

    override suspend fun getCreatorMedia(creatorId: String): List<FeedItem> =
        api.creator(creatorId).media.map(::dtoToItem)
}
