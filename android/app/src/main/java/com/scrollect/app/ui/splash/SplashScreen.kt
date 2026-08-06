package com.scrollect.app.ui.splash

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.scrollect.app.core.data.SessionManager
import com.scrollect.app.core.util.isReduceMotionEnabled
import com.scrollect.app.ui.components.AuroraBackground
import com.scrollect.app.ui.components.ScrollectWordmark
import com.scrollect.app.ui.theme.TextSecondary
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first

/**
 * Splash (spec §4.4.1): aurora + wordmark + tagline; min 1.2s, tap to skip.
 * Decides onboarding vs feed from the persisted session.
 */
@Composable
fun SplashScreen(onDone: (Boolean) -> Unit) {
    val context = LocalContext.current
    val reduceMotion = isReduceMotionEnabled(context)
    val entryPoint = remember {
        EntryPointAccessors.fromApplication(context.applicationContext, SessionEntryPoint::class.java)
    }

    var completed by remember { mutableStateOf<Boolean?>(null) }
    LaunchedEffect(Unit) {
        delay(1200)
        val done = entryPoint.sessionManager().onboardingCompletedFlow.first()
        completed = done
        onDone(done)
    }

    val fade = remember { Animatable(0f) }
    LaunchedEffect(Unit) { fade.animateTo(1f, tween(700)) }

    Box(Modifier.fillMaxSize().clickable { completed?.let { onDone(it) } }) {
        AuroraBackground(reduceMotion = reduceMotion)
        Column(
            Modifier.align(Alignment.Center).padding(24.dp).alpha(fade.value),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            ScrollectWordmark()
            Spacer(Modifier.height(10.dp))
            Text(
                "your feed. your rules.",
                style = MaterialTheme.typography.titleMedium.copy(letterSpacing = 1.sp),
                color = TextSecondary,
            )
        }
    }
}

@EntryPoint
@InstallIn(SingletonComponent::class)
interface SessionEntryPoint {
    fun sessionManager(): SessionManager
}
