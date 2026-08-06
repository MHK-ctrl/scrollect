package com.scrollect.app.core.data

import com.scrollect.app.core.data.model.Category
import com.scrollect.app.core.data.model.CreatorSummary
import com.scrollect.app.core.data.model.FeedItem
import com.scrollect.app.core.data.model.FeedPage
import com.scrollect.app.core.data.model.UserSession

/**
 * Single repository contract. MockRepository (offline, seeded) and
 * RemoteRepository (backend API) both implement it — swapping is a build-time
 * flavor choice (mock vs live; see MockModule/LiveModule), never a code change
 * or runtime flag (spec: mock/live share interfaces).
 */
interface ScrollectRepository {
    suspend fun getCategories(): List<Category>
    suspend fun getFeed(categories: List<String>, cursor: String?, limit: Int): FeedPage
    suspend fun setLike(mediaId: String, liked: Boolean): Boolean
    suspend fun setSave(mediaId: String, saved: Boolean): Boolean
    suspend fun loginDevice(): UserSession
    suspend fun setInterests(interests: List<String>): List<String>
    suspend fun getCreator(creatorId: String): CreatorSummary?
    suspend fun getCreatorMedia(creatorId: String): List<FeedItem>
}
