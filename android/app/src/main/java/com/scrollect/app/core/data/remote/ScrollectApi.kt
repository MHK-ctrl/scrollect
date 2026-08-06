package com.scrollect.app.core.data.remote

import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

// Wire DTOs — mirror backend /api/v1 responses (shared/api-contract.md).
@Serializable
data class CategoryDto(val slug: String, val label: String, val emoji: String, val adjacent: List<String> = emptyList(), val liveCount: Int = 0)

@Serializable
data class CategoriesResponse(val categories: List<CategoryDto>)

@Serializable
data class CreatorDto(val id: String, val username: String, val accountType: String = "CREATOR", val status: String = "active", val mediaCount: Int = 0)

@Serializable
data class FeedItemDto(
    val id: String,
    val caption: String? = null,
    val mediaType: String = "VIDEO",
    val mediaUrl: String? = null,
    val thumbnailUrl: String? = null,
    val videoUrl: String? = null,
    val permalink: String? = null,
    val likeCount: Int = 0,
    val commentCount: Int = 0,
    val timestamp: String = "",
    val categories: List<String> = emptyList(),
    val isCardMode: Boolean = false,
    val liked: Boolean = false,
    val saved: Boolean = false,
    val creator: CreatorDto,
)

@Serializable
data class FeedResponse(val items: List<FeedItemDto>, val nextCursor: String? = null)

@Serializable
data class DeviceRequest(val deviceId: String)

@Serializable
data class DeviceResponse(val token: String, val user: UserDto)

@Serializable
data class UserDto(val id: String, val interests: List<String> = emptyList())

@Serializable
data class LikeRequest(val liked: Boolean)

@Serializable
data class LikeResponse(val liked: Boolean)

@Serializable
data class SaveRequest(val saved: Boolean)

@Serializable
data class SaveResponse(val saved: Boolean)

@Serializable
data class InterestsRequest(val interests: List<String>)

@Serializable
data class InterestsResponse(val interests: List<String>)

@Serializable
data class CreatorResponse(val creator: CreatorDto, val media: List<FeedItemDto> = emptyList())

@Serializable
data class ErrorEnvelope(val error: ErrorBody? = null)

@Serializable
data class ErrorBody(val code: String = "", val message: String = "")

interface ScrollectApi {
    @GET("api/v1/categories")
    suspend fun categories(): CategoriesResponse

    @GET("api/v1/feed")
    suspend fun feed(@Query("categories") categories: String?, @Query("cursor") cursor: String?, @Query("limit") limit: Int): FeedResponse

    @POST("api/v1/auth/device")
    suspend fun device(@Body body: DeviceRequest): DeviceResponse

    @PUT("api/v1/settings/interests")
    suspend fun interests(@Body body: InterestsRequest): InterestsResponse

    @PUT("api/v1/media/{id}/like")
    suspend fun like(@Path("id") id: String, @Body body: LikeRequest): LikeResponse

    @PUT("api/v1/media/{id}/save")
    suspend fun save(@Path("id") id: String, @Body body: SaveRequest): SaveResponse

    @GET("api/v1/creators/{id}")
    suspend fun creator(@Path("id") id: String): CreatorResponse
}
