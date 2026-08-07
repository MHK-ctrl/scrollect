package com.scrollect.app.ui.onboarding

import androidx.test.core.app.ApplicationProvider
import com.scrollect.app.core.data.SessionManager
import com.scrollect.app.core.data.mock.MockRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Regression test for the stuck-RefineStep hang: after the mock repository (and
 * DataStore) complete, `finish()` must clear `saving` (so the button re-enables)
 * and flip `done` (so the screen navigates to the feed). Before the fix,
 * `saving` stayed `true` forever and navigation never fired — observed on-device
 * as a permanently disabled "Loading…" button on the "Your feed is ready." step.
 *
 * This test FAILS on the buggy code (the `saving.first { !it }` wait times out)
 * and PASSES after the fix. Run under Robolectric so the real `SessionManager`
 * DataStore writes are exercised exactly like on-device.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class OnboardingViewModelTest {

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun finish_clearsSavingAndFiresDone_whenMockRepositoryCompletes() {
        val viewModel = OnboardingViewModel(
            repository = MockRepository(),
            session = SessionManager(ApplicationProvider.getApplicationContext()),
        )
        viewModel.toggle("tech")
        viewModel.toggle("cars")
        viewModel.toggle("food")

        viewModel.finish()

        // The mock repo + DataStore complete in milliseconds; `saving` must
        // settle back to false (the loading flag) for the button to re-enable.
        runBlocking {
            withTimeout(10_000) { viewModel.saving.first { !it } }
        }

        assertFalse("saving must resolve to false so the button re-enables", viewModel.saving.value)
        assertTrue("done must flip true so the screen navigates to the feed", viewModel.done.value)
    }

    @Test
    fun finish_ignoresSecondCallWhileSaving() {
        val viewModel = OnboardingViewModel(
            repository = MockRepository(),
            session = SessionManager(ApplicationProvider.getApplicationContext()),
        )
        viewModel.toggle("tech")
        viewModel.toggle("cars")
        viewModel.toggle("food")

        viewModel.finish()
        viewModel.finish() // second call while saving is a no-op (no crash, still completes)

        runBlocking {
            withTimeout(10_000) { viewModel.saving.first { !it } }
        }
        assertTrue(viewModel.done.value)
    }
}
