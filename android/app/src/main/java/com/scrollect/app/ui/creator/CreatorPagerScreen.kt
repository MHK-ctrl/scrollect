package com.scrollect.app.ui.creator

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.hilt.navigation.compose.hiltViewModel
import com.scrollect.app.core.util.isReduceMotionEnabled
import com.scrollect.app.ui.feed.ReelPage
import com.scrollect.app.ui.theme.Background
import com.scrollect.app.ui.theme.TextPrimary

/** Full-screen vertical pager over one creator's Reels (spec §4.4.5 "tap → pager"). */
@Composable
fun CreatorPagerScreen(creatorId: String, onBack: () -> Unit) {
    val viewModel: CreatorViewModel = hiltViewModel()
    LaunchedEffect(creatorId) { viewModel.load(creatorId) }
    val media by viewModel.media.collectAsState()
    val context = LocalContext.current
    val reduceMotion = isReduceMotionEnabled(context)

    val player = remember { ExoPlayer.Builder(context).build() }
    DisposableEffect(Unit) { onDispose { player.release() } }

    val pagerState = rememberPagerState(pageCount = { media.size })
    val currentPage = pagerState.currentPage

    LaunchedEffect(currentPage, media.size) {
        val item = media.getOrNull(currentPage)
        if (item != null && !item.isCardMode && item.videoUrl != null) {
            player.setMediaItem(MediaItem.fromUri(item.videoUrl))
            player.prepare()
            player.playWhenReady = true
            player.play()
        } else {
            player.pause()
        }
    }

    Box(Modifier.fillMaxSize().background(Background)) {
        if (media.isEmpty()) {
            // Pager needs >=1 page; keep the loading box until media arrives.
            Box(Modifier.fillMaxSize())
        } else {
            VerticalPager(state = pagerState, modifier = Modifier.fillMaxSize().testTag("creator-pager")) { page ->
                val item = media[page]
                ReelPage(
                    item = item,
                    isActive = page == currentPage,
                    player = player,
                    reduceMotion = reduceMotion,
                    onLike = { viewModel.toggleLike(item) },
                    onSave = { viewModel.toggleSave(item) },
                    onOpenCreator = {},
                )
            }
        }
        IconButton(onClick = onBack, modifier = Modifier.align(Alignment.TopStart).background(Background.copy(alpha = 0.4f))) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)
        }
    }
}
