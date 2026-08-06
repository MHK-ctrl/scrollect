package com.scrollect.app.core.data

/** Onboarding rules (spec §4.4.2): pick 3–8 interests; "surprise me" picks 4. */
object OnboardingLogic {
    const val MIN_SELECTION = 3
    const val MAX_SELECTION = 8
    const val SURPRISE_COUNT = 4

    fun canContinue(selectedCount: Int): Boolean = selectedCount in MIN_SELECTION..MAX_SELECTION

    fun surprisePick(available: List<String>): List<String> =
        available.shuffled().take(SURPRISE_COUNT)
}
