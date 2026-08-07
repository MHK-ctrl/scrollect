package com.scrollect.app.core.util

import android.content.Context
import android.provider.Settings
import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType

/** Haptics map (spec §4.3): subtle on selection/swipes; none on passive scroll. */
object Haptics {
    fun selection(haptics: HapticFeedback) = haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
}

/** Respect system "reduce motion" (spec §4.3): disables parallax, bursts, aurora drift. */
fun isReduceMotionEnabled(context: Context): Boolean =
    Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
