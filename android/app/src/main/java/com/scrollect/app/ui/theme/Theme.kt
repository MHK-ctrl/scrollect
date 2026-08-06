package com.scrollect.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

// Dark-first theming with one accent + semantic palette (spec §4.1).
// Dynamic color + light mode are explicitly V2 (spec §5.2).
private val ScrollectDarkColors = darkColorScheme(
    primary = Accent,
    onPrimary = TextPrimary,
    primaryContainer = Accent.copy(alpha = 0.22f),
    onPrimaryContainer = AccentLight,
    secondary = Volt,
    onSecondary = Background,
    tertiary = Coral,
    background = Background,
    onBackground = TextPrimary,
    surface = SurfaceDark,
    onSurface = TextPrimary,
    surfaceVariant = SurfaceRaised,
    onSurfaceVariant = TextSecondary,
    error = ErrorColor,
    onError = Background,
)

@Composable
fun ScrollectTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ScrollectDarkColors,
        typography = ScrollectTypography,
        content = content,
    )
}
