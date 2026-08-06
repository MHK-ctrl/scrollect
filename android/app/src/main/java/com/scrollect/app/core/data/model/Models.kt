package com.scrollect.app.core.data.model

data class Category(
    val slug: String,
    val label: String,
    val emoji: String,
    val adjacent: List<String> = emptyList(),
)

data class CreatorSummary(
    val id: String,
    val username: String,
)

data class FeedItem(
    val id: String,
    val caption: String?,
    val mediaType: String,
    val thumbnailUrl: String?,
    val videoUrl: String?,
    val permalink: String?,
    val likeCount: Int,
    val commentCount: Int,
    val categories: List<String>,
    val isCardMode: Boolean,
    val liked: Boolean,
    val saved: Boolean,
    val creator: CreatorSummary,
)

data class FeedPage(
    val items: List<FeedItem>,
    val nextCursor: String?,
)

data class UserSession(
    val userId: String,
    val interests: List<String> = emptyList(),
)
