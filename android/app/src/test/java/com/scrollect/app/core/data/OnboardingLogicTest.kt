package com.scrollect.app.core.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class OnboardingLogicTest {

    @Test
    fun rejectsFewerThanThreeInterests() {
        assertFalse(OnboardingLogic.canContinue(0))
        assertFalse(OnboardingLogic.canContinue(2))
    }

    @Test
    fun acceptsThreeToEightInterests() {
        assertTrue(OnboardingLogic.canContinue(3))
        assertTrue(OnboardingLogic.canContinue(5))
        assertTrue(OnboardingLogic.canContinue(8))
    }

    @Test
    fun rejectsMoreThanEightInterests() {
        assertFalse(OnboardingLogic.canContinue(9))
        assertFalse(OnboardingLogic.canContinue(20))
    }

    @Test
    fun surprisePickReturnsFourUniqueFromPool() {
        val pool = listOf("a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n")
        val pick = OnboardingLogic.surprisePick(pool)
        assertEquals(4, pick.size)
        assertEquals(4, pick.toSet().size)
        assertTrue(pool.containsAll(pick))
    }

    @Test
    fun surprisePickHandlesTinyPool() {
        val pick = OnboardingLogic.surprisePick(listOf("a", "b"))
        assertTrue(pick.size <= 2)
    }
}
