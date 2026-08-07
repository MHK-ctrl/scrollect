package com.scrollect.app.ui.feed

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.VerticalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.filled.Report
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems
import androidx.paging.compose.collectAsLazyPagingItems
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.scrollect.app.core.data.model.Category
import com.scrollect.app.core.data.model.FeedItem
import com.scrollect.app.core.util.formatCount
import com.scrollect.app.core.util.isReduceMotionEnabled
import com.scrollect.app.ui.components.ErrorState
import com.scrollect.app.ui.components.FeedSkeleton
import com.scrollect.app.ui.components.GradientButton
import com.scrollect.app.ui.components.HeartBurst
import com.scrollect.app.ui.components.PillChip
import com.scrollect.app.ui.components.ShimmerSkeleton
import com.scrollect.app.ui.theme.Accent
import com.scrollect.app.ui.theme.AccentLight
import com.scrollect.app.ui.theme.Background
import com.scrollect.app.ui.theme.Coral
import com.scrollect.app.ui.theme.SurfaceDark
import com.scrollect.app.ui.theme.TextPrimary
import com.scrollect.app.ui.theme.TextSecondary

/**
 * Home feed (spec §4.4.3): edge-to-edge VerticalPager + Media3, glass pill row,
 * double-tap like burst, morphing icons, parallax overlays, all states.
 */
@OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
fun FeedScreen(
    onOpenCreator: (String) -> Unit,
    onOpenSettings: () -> Unit,
    // Default keeps call sites (nav host) unchanged; tests inject a real ViewModel.
    viewModel: FeedViewModel = hiltViewModel(),
) {
    val categories by viewModel.categories.collectAsState()
    val activeCats by viewModel.activeCategories.collectAsState()

    val pagingItems = viewModel.feed.collectAsLazyPagingItems()
    val pagerState = rememberPagerState(pageCount = { pagingItems.itemCount })
    val context = LocalContext.current
    val reduceMotion = isReduceMotionEnabled(context)

    val player = remember { ExoPlayer.Builder(context).build() }
    DisposableEffect(Unit) { onDispose { player.release() } }

    val currentPage = pagerState.currentPage

    // Drive the player from the current page; preload the next playable item.
    // Regression guard (feed-entry crash): Paging 3's get(index) throws
    // IndexOutOfBoundsException (PageStore.checkIndex) when the PageStore is
    // still empty — on the first frame of feed entry itemCount == 0, and the
    // old `pagingItems[currentPage]` crashed before the first page emitted.
    // itemAt() bounds-checks every access, and keying on `itemCount > 0` (a
    // stable boolean) re-runs this effect once items arrive so the first Reel
    // starts playback — while appends (12→20→28) keep the key true and never
    // restart the video the user is currently watching.
    LaunchedEffect(currentPage, activeCats, pagingItems.itemCount > 0) {
        if (currentPage !in 0 until pagingItems.itemCount) {
            player.pause()
            return@LaunchedEffect
        }
        val item = pagingItems.itemAt(currentPage)
        if (item == null) { player.pause(); return@LaunchedEffect }
        if (!item.isCardMode && item.videoUrl != null) {
            player.setMediaItem(MediaItem.fromUri(item.videoUrl))
            player.prepare()
            player.playWhenReady = true
            player.play()
            // Preload the next playable item into the playlist.
            val next = pagingItems.itemAt(currentPage + 1)
            if (next != null && !next.isCardMode && next.videoUrl != null) {
                player.addMediaItem(MediaItem.fromUri(next.videoUrl))
            }
        } else {
            player.pause()
        }
    }

    // Reset to the first page when switching categories.
    LaunchedEffect(activeCats) {
        if (pagerState.currentPage != 0) pagerState.scrollToPage(0)
    }

    Scaffold(
        containerColor = Background,
        bottomBar = {
            NavigationBar(containerColor = SurfaceDark) {
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Icon(Icons.Filled.PlayCircle, contentDescription = "Feed") },
                    label = { Text("Feed") },
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onOpenSettings,
                    icon = { Icon(Icons.Filled.Settings, contentDescription = "Settings") },
                    label = { Text("Settings") },
                )
            }
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            PillRow(categories = categories, active = activeCats, onSelect = viewModel::selectCategory)
            Box(Modifier.fillMaxSize()) {
                when (val refresh = pagingItems.loadState.refresh) {
                    is LoadState.Loading -> FeedSkeleton()
                    is LoadState.Error -> ErrorState(
                        message = "Can't load your feed — check your connection.",
                        onRetry = pagingItems::retry,
                        modifier = Modifier.fillMaxSize(),
                    )
                    else -> {
                        if (pagingItems.itemCount == 0) {
                            // Spec §4.4.7: an empty feed must render the designed
                            // empty state (headline + adjacent-category suggestions),
                            // never crash or show a blank screen.
                            EmptyFeedState(
                                categories = categories,
                                activeSlug = activeCats.singleOrNull(),
                                onSelectCategory = viewModel::selectCategory,
                                modifier = Modifier.fillMaxSize(),
                            )
                        } else {
                            VerticalPager(
                                state = pagerState,
                                beyondViewportPageCount = 2, // composes 2 pages ahead → Paging auto-loads append
                                modifier = Modifier.fillMaxSize().testTag("feed-pager"),
                            ) { page ->
                                val item = pagingItems[page]
                                if (item == null) {
                                    ShimmerSkeleton(Modifier.fillMaxSize(), shape = RoundedCornerShape(0.dp))
                                } else {
                                    ReelPage(
                                        item = item,
                                        isActive = page == currentPage,
                                        player = player,
                                        reduceMotion = reduceMotion,
                                        onLike = { viewModel.toggleLike(item) },
                                        onSave = { viewModel.toggleSave(item) },
                                        onOpenCreator = { onOpenCreator(item.creator.id) },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PillRow(categories: List<Category>, active: List<String>, onSelect: (String?) -> Unit) {
    LazyRow(
        modifier = Modifier.fillMaxWidth().testTag("pill-row"),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item { PillChip(label = "For you", selected = active.isEmpty(), onClick = { onSelect(null) }) }
        items(categories, key = { it.slug }) { c ->
            PillChip(label = c.label, emoji = c.emoji, selected = active.contains(c.slug), onClick = { onSelect(c.slug) })
        }
    }
}

/**
 * Spec §4.4.7 empty state: headline + adjacent-category suggestion pills. Shown
 * only after a refresh completes with zero items — the feed must never crash or
 * render blank when a category has "not enough content" (the seeded mock always
 * has content, but a filtered/live feed can legitimately be empty).
 */
@Composable
private fun EmptyFeedState(
    categories: List<Category>,
    activeSlug: String?,
    onSelectCategory: (String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val active = activeSlug?.let { slug -> categories.firstOrNull { it.slug == slug } }
    Column(
        modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("🛸", fontSize = 56.sp)
        Spacer(Modifier.height(12.dp))
        Text("Nothing here yet", style = MaterialTheme.typography.headlineMedium, color = TextPrimary)
        Spacer(Modifier.height(6.dp))
        Text(
            if (active != null) {
                "Not enough live Reels in ${active.label} yet — try a nearby topic."
            } else {
                "We're onboarding creators for this vibe. Check another category or come back soon."
            },
            style = MaterialTheme.typography.bodyLarge,
            color = TextSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 24.dp),
        )
        val adjacent = active?.adjacent.orEmpty()
            .mapNotNull { slug -> categories.firstOrNull { it.slug == slug } }
        if (adjacent.isNotEmpty()) {
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                adjacent.forEach { c ->
                    PillChip(label = c.label, emoji = c.emoji, selected = false, onClick = { onSelectCategory(c.slug) })
                }
            }
        }
        Spacer(Modifier.height(20.dp))
        GradientButton(text = "Browse all categories", onClick = { onSelectCategory(null) }, fullWidth = false)
    }
}

/**
 * Bounds-checked Paging access. Paging 3's [get] throws IndexOutOfBoundsException
 * from PageStore.checkIndex when the PageStore is empty or the index is out of
 * range — always guard with this instead of raw `pagingItems[i]`.
 */
private fun <T : Any> LazyPagingItems<T>.itemAt(index: Int): T? =
    if (index in 0 until itemCount) get(index) else null

@Composable
internal fun ReelPage(
    item: FeedItem,
    isActive: Boolean,
    player: ExoPlayer,
    reduceMotion: Boolean,
    onLike: () -> Unit,
    onSave: () -> Unit,
    onOpenCreator: () -> Unit,
) {
    var burstNonce by remember(item.id) { mutableIntStateOf(0) }
    var playing by remember(item.id) { mutableStateOf(true) }

    Box(
        Modifier
            .fillMaxSize()
            .testTag("feed-item")
            .pointerInput(item.id) {
                detectTapGestures(
                    onDoubleTap = { burstNonce += 1; onLike() },
                    onTap = {
                        if (!item.isCardMode) {
                            playing = !playing
                            if (playing) player.play() else player.pause()
                        }
                    },
                )
            },
    ) {
        if (item.isCardMode) {
            CardModeMedia(item, reduceMotion)
        } else {
            androidx.compose.ui.viewinterop.AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply { this.player = player; useController = false }
                },
                modifier = Modifier.fillMaxSize(),
            )
        }

        // Parallax + scrims
        val parallax by rememberInfiniteTransition(label = "parallax").animateFloat(
            0f, 14f, infiniteRepeatable(tween(3800), RepeatMode.Reverse), label = "parallax-y",
        )
        Box(
            Modifier.fillMaxWidth().height(140.dp).align(Alignment.TopCenter)
                .graphicsLayer { translationY = if (reduceMotion) 0f else -parallax }
                .background(Brush.verticalGradient(listOf(Color.Black.copy(alpha = 0.55f), Color.Transparent))),
        )
        Box(
            Modifier.fillMaxSize().align(Alignment.BottomCenter)
                .background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.65f)))),
        )

        // Paused indicator
        AnimatedVisibility(visible = !playing && !item.isCardMode, modifier = Modifier.align(Alignment.Center)) {
            Icon(Icons.Filled.PlayArrow, contentDescription = "Play", tint = Color.White.copy(alpha = 0.85f), modifier = Modifier.size(72.dp))
        }

        HeartBurst(nonce = burstNonce, modifier = Modifier.fillMaxSize())

        // Right rail (morphing like + save; share/report are V2)
        Column(
            Modifier.align(Alignment.CenterEnd).padding(end = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Crossfade(targetState = item.liked, label = "like-morph") { liked ->
                RailButton(
                    icon = if (liked) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                    tint = if (liked) Coral else Color.White,
                    label = formatCount(item.likeCount + if (liked) 1 else 0),
                    onClick = onLike,
                )
            }
            Crossfade(targetState = item.saved, label = "save-morph") { saved ->
                RailButton(
                    icon = if (saved) Icons.Filled.Bookmark else Icons.Outlined.BookmarkBorder,
                    tint = if (saved) AccentLight else Color.White,
                    onClick = onSave,
                )
            }
            RailButton(icon = Icons.Filled.Share, tint = Color.White, onClick = { /* TODO(freebuff-pro-ui): share sheet — V2 */ })
            RailButton(icon = Icons.Filled.Report, tint = Color.White, onClick = { /* TODO: report flow — V2 */ })
        }

        // Creator + caption glass card (bottom-left, behind the rail)
        Column(
            Modifier.align(Alignment.BottomStart).padding(start = 16.dp, bottom = 20.dp, end = 92.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(40.dp).clip(CircleShape)
                        .background(Brush.linearGradient(listOf(Accent, AccentLight))),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(item.creator.username.take(1).uppercase(), color = Color.White, fontWeight = FontWeight.Bold)
                }
                Spacer(Modifier.width(8.dp))
                Text(
                    "@${item.creator.username}",
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimary,
                    modifier = Modifier.clip(RoundedCornerShape(6.dp)).clickable(onClick = onOpenCreator),
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                item.caption ?: "",
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            if (item.isCardMode) {
                Spacer(Modifier.height(6.dp))
                Text("🎵 licensed audio — card mode", style = MaterialTheme.typography.labelSmall, color = TextSecondary)
            }
        }
    }
}

@Composable
private fun CardModeMedia(item: FeedItem, reduceMotion: Boolean) {
    val transition = rememberInfiniteTransition(label = "ken-burns")
    val t by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(9000), RepeatMode.Reverse), label = "ken-burns-t")
    Box(Modifier.fillMaxSize().background(Background)) {
        AsyncImage(
            model = ImageRequest.Builder(LocalContext.current)
                .data(item.thumbnailUrl)
                .crossfade(true)
                .build(),
            contentDescription = item.caption,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize().graphicsLayer {
                if (!reduceMotion) {
                    scaleX = 1.12f
                    scaleY = 1.12f
                    translationY = (-14f * t).dp.toPx()
                }
            },
        )
    }
}

@Composable
private fun RailButton(icon: ImageVector, onClick: () -> Unit, tint: Color = Color.White, label: String? = null) {
    Column(
        Modifier.clip(RoundedCornerShape(999.dp)).clickable(onClick = onClick).padding(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(30.dp))
        if (label != null) {
            Spacer(Modifier.height(2.dp))
            Text(label, color = Color.White.copy(alpha = 0.9f), style = MaterialTheme.typography.labelSmall)
        }
    }
}
