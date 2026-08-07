package com.scrollect.app.ui.feed

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.test.core.app.ApplicationProvider
import com.scrollect.app.core.data.ScrollectRepository
import com.scrollect.app.core.data.SessionManager
import com.scrollect.app.core.data.model.Category
import com.scrollect.app.core.data.model.CreatorSummary
import com.scrollect.app.core.data.model.FeedItem
import com.scrollect.app.core.data.model.FeedPage
import com.scrollect.app.core.data.model.UserSession
import com.scrollect.app.core.data.mock.MockRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Regression tests for the feed-entry crash (on-device stack trace):
 *
 * ```
 * java.lang.IndexOutOfBoundsException: Index: 0, Size: 0
 *   at androidx.paging.PageStore.checkIndex(PageStore.kt:56)
 *   at androidx.paging.compose.LazyPagingItems.get(LazyPagingItems.kt:109)
 *   at FeedScreenKt$FeedScreen$2$1.invokeSuspend(FeedScreen.kt:121)
 * ```
 *
 * Tapping "Start scrolling" composed FeedScreen while Paging's PageStore was
 * still empty (itemCount == 0); the old unguarded `pagingItems[currentPage]`
 * threw. These tests render FeedScreen with a real FeedViewModel (injected
 * directly — no Hilt) over an EMPTY Paging source (must show the empty state,
 * not crash) and over the SEEDED mock source (must render the first Reel, and
 * playback can only target a bounds-valid item).
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class FeedScreenEntryTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun emptyFeed_rendersEmptyState_withoutCrash() {
        val viewModel = FeedViewModel(
            repository = EmptyFeedRepository(),
            session = SessionManager(ApplicationProvider.getApplicationContext()),
        )
        composeRule.setContent {
            FeedScreen(onOpenCreator = {}, onOpenSettings = {}, viewModel = viewModel)
        }

        // The empty page must settle and the spec §4.4.7 empty state appears —
        // NOT an IndexOutOfBoundsException from `pagingItems[0]`.
        composeRule.waitUntil(timeoutMillis = 15_000) {
            composeRule.onAllNodesWithText("Nothing here yet").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onNodeWithText("Nothing here yet").assertExists()
    }

    // NOTE: this asserts the first item RENDERS (the crash gate). Playback
    // itself (ExoPlayer) is created inside the composable with no seam, so
    // "playback targets a valid item" is only indirectly covered — acceptable
    // without adding a test-only seam.
    @Test
    fun seededFeed_rendersFirstItem_withoutCrash() {
        val viewModel = FeedViewModel(
            repository = MockRepository(),
            session = SessionManager(ApplicationProvider.getApplicationContext()),
        )
        composeRule.setContent {
            FeedScreen(onOpenCreator = {}, onOpenSettings = {}, viewModel = viewModel)
        }

        composeRule.waitUntil(timeoutMillis = 20_000) {
            composeRule.onAllNodesWithTag("feed-item").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onAllNodesWithTag("feed-item")[0].assertExists()
    }
}

/** Minimal fake: categories exist, the feed is always empty (the crash scenario). */
private class EmptyFeedRepository : ScrollectRepository {
    override suspend fun getCategories(): List<Category> = listOf(
        Category(slug = "tech", label = "Tech", emoji = "📱", adjacent = listOf("science", "finance")),
    )

    override suspend fun getFeed(categories: List<String>, cursor: String?, limit: Int): FeedPage =
        FeedPage(items = emptyList(), nextCursor = null)

    override suspend fun setLike(mediaId: String, liked: Boolean): Boolean = liked
    override suspend fun setSave(mediaId: String, saved: Boolean): Boolean = saved
    override suspend fun loginDevice(): UserSession = UserSession(userId = "test-device")
    override suspend fun setInterests(interests: List<String>): List<String> = interests
    override suspend fun getCreator(creatorId: String): CreatorSummary? = null
    override suspend fun getCreatorMedia(creatorId: String): List<FeedItem> = emptyList()
}
