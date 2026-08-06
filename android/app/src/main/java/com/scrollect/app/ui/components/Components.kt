package com.scrollect.app.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.minDimension
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.scrollect.app.core.util.Haptics
import com.scrollect.app.ui.theme.Accent
import com.scrollect.app.ui.theme.AccentLight
import com.scrollect.app.ui.theme.Background
import com.scrollect.app.ui.theme.Coral
import com.scrollect.app.ui.theme.GlassBorderTop
import com.scrollect.app.ui.theme.GlassScrim
import com.scrollect.app.ui.theme.SurfaceRaised
import com.scrollect.app.ui.theme.TextPrimary
import com.scrollect.app.ui.theme.TextSecondary
import com.scrollect.app.ui.theme.Volt
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * SCROLLECT component kit (spec §4.1). Components map to `freebuff-pro-ui`
 * (React web kit) — swap points stay in this file so the V2 web player can
 * reuse the kit directly. Missing/adapted pieces are marked TODO(freebuff-pro-ui).
 */

// --- Gradient CTA (mapping: freebuff-pro-ui Button / GlassButton) ---
@Composable
fun GradientButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    fullWidth: Boolean = true,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed) 0.96f else 1f,
        animationSpec = spring(dampingRatio = 0.55f, stiffness = 800f),
        label = "cta-press",
    )
    val haptics = LocalHapticFeedback.current
    val shape = RoundedCornerShape(999.dp)
    val height = if (fullWidth) 56.dp else 48.dp
    Box(
        modifier = modifier
            .height(height)
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .shadow(12.dp, shape, spotColor = Accent.copy(alpha = 0.55f))
            .clip(shape)
            .background(Brush.linearGradient(listOf(Accent, AccentLight)))
            .clickable(
                interactionSource = interactionSource,
                indication = null, // TODO(freebuff-pro-ui): ripple parity
                enabled = enabled,
                onClick = {
                    Haptics.selection(haptics)
                    onClick()
                },
            )
            .padding(horizontal = 24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = TextPrimary,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

// --- Glass card with a 1px "lit" top edge (mapping: GlassCard / LiquidGlass) ---
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    corner: Dp = 16.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(corner)
    Box(
        modifier
            .clip(shape)
            .background(GlassScrim)
            .drawBehind {
                drawLine(GlassBorderTop, Offset(0f, 0f), Offset(size.width, 0f), strokeWidth = 1.dp.toPx())
            },
    ) {
        Column(Modifier.padding(16.dp), content = content)
    }
}

// --- Glass pill chip; active = gradient + glow + spring bounce (mapping: Tabs/Select patterns) ---
@Composable
fun PillChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    emoji: String? = null,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (pressed || selected) 1.06f else 1f,
        animationSpec = spring(dampingRatio = 0.5f, stiffness = 700f),
        label = "pill-bounce",
    )
    val haptics = LocalHapticFeedback.current
    val shape = RoundedCornerShape(999.dp)
    Box(
        modifier = modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .shadow(if (selected) 8.dp else 0.dp, shape, spotColor = Accent.copy(alpha = 0.6f))
            .clip(shape)
            .then(if (selected) Modifier.background(Brush.linearGradient(listOf(Accent, AccentLight))) else Modifier.background(GlassScrim))
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = {
                    Haptics.selection(haptics)
                    onClick()
                },
            )
            .padding(horizontal = 16.dp, vertical = 9.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = if (emoji != null) "$emoji $label" else label,
            color = if (selected) Color.White else TextSecondary,
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

// --- Shimmer skeleton (mapping: freebuff-pro-ui Skeleton) ---
@Composable
fun ShimmerSkeleton(modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(16.dp)) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val shift by transition.animateFloat(
        initialValue = -1f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1200, easing = LinearEasing), RepeatMode.Restart),
        label = "shimmer-shift",
    )
    val highlight = Color(0xFF2A2A38)
    Box(
        modifier
            .clip(shape)
            .drawBehind {
                drawRect(
                    Brush.linearGradient(
                        colors = listOf(SurfaceRaised, highlight, SurfaceRaised),
                        start = Offset(size.width * shift, 0f),
                        end = Offset(size.width * shift + size.width * 0.8f, size.height),
                    ),
                )
            },
    )
}

// Feed-shaped skeleton (spec §4.4.7: mirrors final layout, not a spinner).
@Composable
fun FeedSkeleton() {
    Column(
        Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        repeat(3) {
            Box(Modifier.fillMaxSize().weight(1f).clip(RoundedCornerShape(24.dp)).background(SurfaceRaised))
        }
    }
}

// --- Empty state (spec §4.4.7) ---
@Composable
fun EmptyState(
    emoji: String,
    title: String,
    body: String,
    ctaText: String?,
    onCta: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text(emoji, fontSize = 56.sp)
        Spacer(Modifier.height(12.dp))
        Text(title, style = MaterialTheme.typography.headlineMedium, color = TextPrimary)
        Spacer(Modifier.height(6.dp))
        Text(body, style = MaterialTheme.typography.bodyLarge, color = TextSecondary, modifier = Modifier.padding(horizontal = 32.dp))
        if (ctaText != null) {
            Spacer(Modifier.height(20.dp))
            GradientButton(text = ctaText, onClick = onCta, fullWidth = false)
        }
    }
}

// --- Error state with retry (spec §4.4.7: never a blank screen) ---
@Composable
fun ErrorState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Icon(Icons.Filled.Refresh, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(40.dp))
        Spacer(Modifier.height(12.dp))
        Text(message, style = MaterialTheme.typography.bodyLarge, color = TextSecondary)
        Spacer(Modifier.height(16.dp))
        GradientButton(text = "Retry", onClick = onRetry, fullWidth = false)
    }
}

// --- Offline banner (spec §4.4.7) ---
@Composable
fun OfflineBanner(text: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(GlassScrim)
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.CloudOff, contentDescription = null, tint = Volt, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(text, style = MaterialTheme.typography.labelMedium, color = TextPrimary)
    }
}

// --- Aurora / mesh-gradient background (mapping: AuroraBackground + MeshGradient) ---
@Composable
fun AuroraBackground(modifier: Modifier = Modifier, reduceMotion: Boolean = false) {
    val transition = rememberInfiniteTransition(label = "aurora")
    val p1 by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(6000, easing = LinearEasing), RepeatMode.Reverse), label = "p1")
    val p2 by transition.animateFloat(1f, 0f, infiniteRepeatable(tween(7500, easing = LinearEasing), RepeatMode.Reverse), label = "p2")
    val p3 by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(5000, easing = LinearEasing), RepeatMode.Reverse), label = "p3")

    val k1 = if (reduceMotion) 0.5f else p1
    val k2 = if (reduceMotion) 0.5f else p2
    val k3 = if (reduceMotion) 0.5f else p3

    Canvas(modifier.fillMaxSize()) {
        drawRect(Background)
        val r = size.minDimension * 0.55f
        val c1 = Offset(size.width * (0.25f + 0.2f * k1), size.height * (0.2f + 0.2f * k2))
        val c2 = Offset(size.width * (0.8f - 0.2f * k2), size.height * (0.7f - 0.2f * k3))
        val c3 = Offset(size.width * (0.6f + 0.15f * k3), size.height * (0.35f + 0.2f * k1))
        drawCircle(Brush.radialGradient(listOf(Accent.copy(alpha = 0.38f), Color.Transparent), center = c1, radius = r), radius = r, center = c1)
        drawCircle(Brush.radialGradient(listOf(Volt.copy(alpha = 0.16f), Color.Transparent), center = c2, radius = r * 0.8f), radius = r * 0.8f, center = c2)
        drawCircle(Brush.radialGradient(listOf(Coral.copy(alpha = 0.2f), Color.Transparent), center = c3, radius = r * 0.7f), radius = r * 0.7f, center = c3)
    }
}

// --- Heart burst on double-tap (mapping: FloatingParticles / Sparks + useExplode) ---
@Composable
fun HeartBurst(nonce: Int, modifier: Modifier = Modifier, size: Dp = 96.dp) {
    if (nonce <= 0) return
    var show by remember(nonce) { mutableStateOf(false) }
    val scale = remember { Animatable(0.4f) }
    val fade = remember { Animatable(1f) }
    LaunchedEffect(nonce) {
        show = true
        launch { scale.animateTo(1.15f, spring(dampingRatio = 0.4f, stiffness = 500f)) }
        launch { fade.animateTo(0f, tween(520)) }
        delay(560)
        show = false
    }
    if (!show) return
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val progress = 1f - fade.value
            val n = 10
            for (i in 0 until n) {
                val angle = Math.toRadians((i * 360.0) / n)
                val dist = this.size.minDimension * (0.12f + 0.22f * progress) // this.size = DrawScope.size; outer `size` is the Dp param
                drawCircle(
                    color = Coral.copy(alpha = fade.value * 0.8f),
                    radius = 3.dp.toPx(),
                    center = Offset(center.x + (Math.cos(angle) * dist).toFloat(), center.y + (Math.sin(angle) * dist).toFloat()),
                )
            }
        }
        Icon(
            imageVector = Icons.Filled.Favorite,
            contentDescription = "Liked",
            tint = Coral,
            modifier = Modifier.size(size).graphicsLayer {
                scaleX = scale.value
                scaleY = scale.value
                alpha = fade.value
            },
        )
    }
}

// --- Wordmark with gradient text ---
@OptIn(ExperimentalTextApi::class)
@Composable
fun ScrollectWordmark(modifier: Modifier = Modifier) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Text(
            text = "SCROLLECT",
            style = MaterialTheme.typography.displayLarge.copy(
                letterSpacing = 6.sp,
                fontWeight = FontWeight.Black,
                brush = Brush.linearGradient(listOf(AccentLight, Volt)),
            ),
        )
    }
}
