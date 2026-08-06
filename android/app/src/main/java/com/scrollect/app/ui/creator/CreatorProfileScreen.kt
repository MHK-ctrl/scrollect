package com.scrollect.app.ui.creator

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.scrollect.app.core.data.model.FeedItem
import com.scrollect.app.ui.components.EmptyState
import com.scrollect.app.ui.components.ShimmerSkeleton
import com.scrollect.app.ui.theme.Accent
import com.scrollect.app.ui.theme.AccentLight
import com.scrollect.app.ui.theme.Background
import com.scrollect.app.ui.theme.SurfaceDark
import com.scrollect.app.ui.theme.TextPrimary
import com.scrollect.app.ui.theme.TextSecondary

/** Creator profile (spec §4.4.5): header + masonry grid of their live Reels. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun CreatorProfileScreen(creatorId: String, onBack: () -> Unit, onOpenReel: (String) -> Unit) {
    val viewModel: CreatorViewModel = hiltViewModel()
    LaunchedEffect(creatorId) { viewModel.load(creatorId) }
    val creator by viewModel.creator.collectAsState()
    val media by viewModel.media.collectAsState()
    val loading by viewModel.loading.collectAsState()

    Box(Modifier.fillMaxSize().background(Background)) {
        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                }
                if (creator != null) {
                    Box(
                        Modifier.size(44.dp).clip(CircleShape)
                            .background(Brush.linearGradient(listOf(Accent, AccentLight))),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(creator!!.username.take(1).uppercase(), color = TextPrimary, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text("@" + creator!!.username, style = MaterialTheme.typography.titleLarge, color = TextPrimary)
                        Text(
                            "${media.size} Reels on SCROLLECT",
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary,
                        )
                    }
                }
            }

            if (loading && creator == null) {
                Column(Modifier.padding(16.dp)) {
                    ShimmerSkeleton(Modifier.fillMaxWidth().height(72.dp), shape = RoundedCornerShape(16.dp))
                    Spacer(Modifier.height(12.dp))
                    ShimmerSkeleton(Modifier.fillMaxWidth().height(300.dp), shape = RoundedCornerShape(24.dp))
                }
            } else if (media.isEmpty()) {
                EmptyState(
                    emoji = "🧑‍🎨",
                    title = "No live Reels yet",
                    body = "This creator hasn't published any live Reels on SCROLLECT yet.",
                    ctaText = null,
                    onCta = {},
                    modifier = Modifier.fillMaxSize(),
                )
            } else {
                LazyVerticalStaggeredGrid(
                    columns = StaggeredGridCells.Fixed(2),
                    contentPadding = PaddingValues(12.dp),
                    modifier = Modifier.fillMaxSize(),
                ) { items(media, key = { it.id }) { item -> CreatorReelThumb(item, onClick = { onOpenReel(creatorId) }) } }
            }
        }
    }
}

@Composable
private fun CreatorReelThumb(item: FeedItem, onClick: () -> Unit) {
    Box(
        Modifier
            .padding(4.dp)
            .height((150 + (item.id.hashCode() % 4) * 30).dp)
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceDark)
            .clickable(onClick = onClick),
    ) {
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current).data(item.thumbnailUrl).crossfade(true).build(),
            contentDescription = item.caption,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
    }
}
