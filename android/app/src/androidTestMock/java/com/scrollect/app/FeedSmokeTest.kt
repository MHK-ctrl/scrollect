package com.scrollect.app

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.datastore.preferences.core.edit
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.scrollect.app.core.data.scrollectDataStore
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Smoke test (quality bar): a fresh install in the mock flavor walks onboarding
 * (welcome → pick 3 interests → land) and asserts the seeded feed renders with
 * the pill row and at least one Reel item. Deterministic — offline mock data.
 *
 * Lives in `src/androidTestMock` so it can ONLY run against the offline mock
 * repository — the live flavor physically cannot execute it (no Meta/network).
 */
@RunWith(AndroidJUnit4::class)
class FeedSmokeTest {

    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Before
    fun resetSession() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        runBlocking { context.scrollectDataStore.edit { it.clear() } }
    }

    @Test
    fun onboardingToFeedRendersSeededData() {
        // Step 1 — welcome
        composeRule.onNodeWithText("Get started").performClick()

        // Step 2 — pick 3 interests (min selection = 3)
        composeRule.onNodeWithTag("category-tech").performClick()
        composeRule.onNodeWithTag("category-cars").performClick()
        composeRule.onNodeWithTag("category-food").performClick()
        composeRule.onNodeWithText("Continue").performClick()

        // Step 3 — land in the first feed
        composeRule.onNodeWithText("Start scrolling").performClick()

        // Feed renders: pill row + at least one seeded Reel page
        composeRule.onNodeWithTag("pill-row").assertExists()
        composeRule.waitUntil(timeoutMillis = 20_000) {
            composeRule.onAllNodesWithTag("feed-item").fetchSemanticsNodes().isNotEmpty()
        }
        composeRule.onAllNodesWithTag("feed-item")[0].assertExists()
    }
}
