package com.scrollect.app.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.scrollect.app.core.data.model.Category
import com.scrollect.app.ui.components.GlassCard
import com.scrollect.app.ui.theme.Accent
import com.scrollect.app.ui.theme.AccentLight
import com.scrollect.app.ui.theme.Background
import com.scrollect.app.ui.theme.Coral
import com.scrollect.app.ui.theme.GlassScrim
import com.scrollect.app.ui.theme.TextPrimary
import com.scrollect.app.ui.theme.TextSecondary
import com.scrollect.app.ui.theme.Volt

/** Settings (spec §4.4.6): live interest management, content filters, data & privacy. */
@Composable
fun SettingsScreen(onBack: () -> Unit, onLoggedOut: () -> Unit) {
    val viewModel: SettingsViewModel = hiltViewModel()
    val categories by viewModel.categories.collectAsState()
    val interests by viewModel.interests.collectAsState()
    val hideCardMode by viewModel.hideCardMode.collectAsState()
    val deleted by viewModel.deleted.collectAsState()
    var showDeleteDialog by remember { mutableStateOf(false) }

    // Key on the VALUE, not the StateFlow object (same hang class as the
    // onboarding bug): keying on the flow instance never re-runs after `deleted`
    // flips true, so account deletion never navigates away.
    LaunchedEffect(deleted) {
        if (deleted) onLoggedOut()
    }

    Box(Modifier.fillMaxSize().background(Background)) {
        LazyColumn(Modifier.fillMaxSize()) {
            item {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                    Text("Settings", style = MaterialTheme.typography.headlineMedium, color = TextPrimary)
                }
            }

            item { SectionHeader("Your interests") }
            item {
                GlassCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                    InterestChips(categories = categories, selected = interests, onToggle = viewModel::toggleInterest)
                }
            }

            item { SectionHeader("Content filters") }
            item {
                GlassCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text("Hide licensed-audio Reels", style = MaterialTheme.typography.titleMedium, color = TextPrimary)
                            Text("Skips card-mode items (thumbnail + caption) in your feed.", style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                        }
                        Switch(checked = hideCardMode, onCheckedChange = viewModel::setHideCardMode)
                    }
                }
            }

            item { SectionHeader("Data & privacy") }
            item {
                GlassCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                    Text(
                        "SCROLLECT never stores your Instagram data and never scrapes content. Creators opt in; you can always revoke.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary,
                    )
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Delete my account & data",
                        color = Coral,
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { showDeleteDialog = true }
                            .padding(8.dp),
                    )
                }
            }

            item { SectionHeader("About") }
            item {
                GlassCard(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                    Text("SCROLLECT v0.1.0 · your feed. your rules.", style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
                    Text("Privacy policy & compliance: docs/privacy-policy-draft.md", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
                }
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }

    if (showDeleteDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Delete account?") },
            text = { Text("Your account, likes and saved picks will be removed from this device.") },
            confirmButton = {
                TextButton(onClick = { showDeleteDialog = false; viewModel.deleteAccount() }) {
                    Text("Delete", color = Coral)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) { Text("Cancel") }
            },
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun InterestChips(categories: List<Category>, selected: List<String>, onToggle: (String) -> Unit) {
    if (categories.isEmpty()) {
        Text("Loading…", color = TextSecondary)
        return
    }
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        categories.forEach { category ->
            val isSelected = category.slug in selected
            Box(
                Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .then(if (isSelected) Modifier.background(Brush.linearGradient(listOf(Accent, AccentLight))) else Modifier.background(GlassScrim))
                    .clickable { onToggle(category.slug) }
                    .testTag("interest-${category.slug}")
                    .padding(horizontal = 14.dp, vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "${category.emoji} ${category.label}",
                    color = if (isSelected) Volt else TextSecondary,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        title,
        style = MaterialTheme.typography.labelMedium.copy(color = TextSecondary),
        modifier = Modifier.padding(start = 20.dp, top = 20.dp, bottom = 8.dp),
    )
}
