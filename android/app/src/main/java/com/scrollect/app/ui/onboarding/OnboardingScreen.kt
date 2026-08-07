package com.scrollect.app.ui.onboarding

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.scrollect.app.core.data.OnboardingLogic
import com.scrollect.app.core.util.isReduceMotionEnabled
import com.scrollect.app.ui.components.AuroraBackground
import com.scrollect.app.ui.components.GradientButton
import com.scrollect.app.ui.components.PillChip
import com.scrollect.app.ui.theme.Accent
import com.scrollect.app.ui.theme.AccentLight
import com.scrollect.app.ui.theme.Background
import com.scrollect.app.ui.theme.GlassScrim
import com.scrollect.app.ui.theme.TextPrimary
import com.scrollect.app.ui.theme.TextSecondary
import com.scrollect.app.ui.theme.Volt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun OnboardingScreen(onDone: () -> Unit) {
    val viewModel: OnboardingViewModel = hiltViewModel()
    val step by viewModel.step.collectAsState()
    val selected by viewModel.selected.collectAsState()
    val categories by viewModel.categories.collectAsState()
    val saving by viewModel.saving.collectAsState()
    val done by viewModel.done.collectAsState()
    val context = LocalContext.current
    val reduceMotion = isReduceMotionEnabled(context)

    // Key on the VALUE, not the StateFlow object: keying on the flow instance
    // never re-runs the effect, so navigation never fired after `done` flipped
    // true and the RefineStep hung on a disabled "Loading…" button.
    // Navigation must always run on the main thread (NavController enforces it
    // and would otherwise crash); in production effects already run on main, so
    // withContext(Main.immediate) is a no-op there but keeps the nav safe under
    // any dispatcher (including compose test harnesses).
    LaunchedEffect(done) {
        if (done) withContext(Dispatchers.Main.immediate) { onDone() }
    }

    Box(Modifier.fillMaxSize()) {
        AuroraBackground(reduceMotion = reduceMotion)
        AnimatedContent(targetState = step, label = "onboarding-step") { currentStep ->
            when (currentStep) {
                1 -> WelcomeStep(onNext = viewModel::next)
                2 -> InterestStep(
                    categories = categories,
                    selected = selected,
                    canContinue = viewModel.canContinue,
                    onToggle = viewModel::toggle,
                    onSurprise = viewModel::surpriseMe,
                    onNext = viewModel::next,
                )
                else -> RefineStep(saving = saving, onDone = viewModel::finish)
            }
        }
        ProgressDots(step = step, modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 28.dp))
    }
}

@Composable
private fun WelcomeStep(onNext: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("👀", fontSize = 64.sp)
        Spacer(Modifier.height(18.dp))
        Text(
            "Reels that match your vibe.",
            style = MaterialTheme.typography.headlineMedium,
            color = TextPrimary,
        )
        Spacer(Modifier.height(10.dp))
        Text(
            "Pick your interests. We only show you opted-in creators posting exactly that. No noise feed.",
            style = MaterialTheme.typography.bodyLarge,
            color = TextSecondary,
        )
        Spacer(Modifier.height(28.dp))
        GradientButton(text = "Get started", onClick = onNext, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun InterestStep(
    categories: List<com.scrollect.app.core.data.model.Category>,
    selected: Set<String>,
    canContinue: Boolean,
    onToggle: (String) -> Unit,
    onSurprise: () -> Unit,
    onNext: () -> Unit,
) {
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Spacer(Modifier.height(36.dp))
        Text("Pick your vibe", style = MaterialTheme.typography.headlineMedium, color = TextPrimary)
        Spacer(Modifier.height(4.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${selected.size}/${OnboardingLogic.MAX_SELECTION} selected",
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
            )
            Spacer(Modifier.weight(1f))
            PillChip(label = "Surprise me", emoji = "🎲", selected = false, onClick = onSurprise)
        }
        Spacer(Modifier.height(12.dp))
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            contentPadding = PaddingValues(bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.weight(1f),
        ) {
            items(categories, key = { it.slug }) { category ->
                CategoryCard(
                    emoji = category.emoji,
                    label = category.label,
                    selected = category.slug in selected,
                    onClick = { onToggle(category.slug) },
                    testTag = "category-${category.slug}",
                )
            }
        }
        GradientButton(
            text = "Continue",
            onClick = onNext,
            enabled = canContinue,
            modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
        )
    }
}

@Composable
private fun CategoryCard(emoji: String, label: String, selected: Boolean, onClick: () -> Unit, testTag: String) {
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.06f else 1f,
        animationSpec = spring(dampingRatio = 0.5f, stiffness = 700f),
        label = "card-bounce",
    )
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .then(if (selected) Modifier.background(Brush.linearGradient(listOf(Accent, AccentLight))) else Modifier.background(GlassScrim))
            .clickable(onClick = onClick)
            .padding(vertical = 18.dp, horizontal = 8.dp)
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .testTag(testTag),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(emoji, fontSize = 34.sp)
            if (selected) {
                Box(
                    Modifier.align(Alignment.TopEnd).size(22.dp).clip(RoundedCornerShape(11.dp)).background(Background),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.Check, contentDescription = "Selected", tint = Volt, modifier = Modifier.size(14.dp))
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(label, style = MaterialTheme.typography.labelMedium, color = TextPrimary, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun RefineStep(saving: Boolean, onDone: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(horizontal = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("✨", fontSize = 56.sp)
        Spacer(Modifier.height(16.dp))
        Text("Your feed is ready.", style = MaterialTheme.typography.headlineMedium, color = TextPrimary)
        Spacer(Modifier.height(8.dp))
        Text(
            "We'll start with your top picks. Tune interests anytime in Settings.",
            style = MaterialTheme.typography.bodyLarge,
            color = TextSecondary,
        )
        Spacer(Modifier.height(28.dp))
        GradientButton(text = if (saving) "Loading…" else "Start scrolling", onClick = onDone, enabled = !saving, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun ProgressDots(step: Int, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        repeat(3) { i ->
            val active = i + 1 == step
            Box(
                Modifier
                    .size(width = if (active) 20.dp else 8.dp, height = 8.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (active) AccentLight else TextSecondary.copy(alpha = 0.4f)),
            )
        }
    }
}
