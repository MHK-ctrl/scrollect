package com.scrollect.app.ui.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.Pager
import androidx.paging.PagingConfig
import androidx.paging.PagingData
import androidx.paging.PagingSource
import androidx.paging.PagingState
import androidx.paging.cachedIn
import com.scrollect.app.core.data.ScrollectRepository
import com.scrollect.app.core.data.SessionManager
import com.scrollect.app.core.data.model.Category
import com.scrollect.app.core.data.model.FeedItem
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class FeedViewModel @Inject constructor(
    private val repository: ScrollectRepository,
    session: SessionManager,
) : ViewModel() {

    val categories = MutableStateFlow<List<Category>>(emptyList())

    /** Empty list = "For you" (all published content). A single slug = category-locked feed. */
    private val query = MutableStateFlow<List<String>>(emptyList())
    val activeCategories: StateFlow<List<String>> = query.asStateFlow()

    val hideCardMode: StateFlow<Boolean> = session.hideCardModeFlow.stateIn(
        viewModelScope, SharingStarted.Eagerly, false,
    )

    init {
        viewModelScope.launch { categories.value = repository.getCategories() }
    }

    val feed: Flow<PagingData<FeedItem>> = combine(query, hideCardMode) { cats, hide -> FeedQuery(cats, hide) }
        .flatMapLatest { q ->
            Pager(PagingConfig(pageSize = 8, prefetchDistance = 4, initialLoadSize = 12)) {
                FeedPagingSource(repository, q.categories, q.hideCardMode)
            }.flow
        }
        .cachedIn(viewModelScope)

    fun selectCategory(slug: String?) {
        query.value = slug?.let { listOf(it) } ?: emptyList()
    }

    fun toggleLike(item: FeedItem) {
        viewModelScope.launch { repository.setLike(item.id, !item.liked) }
    }

    fun toggleSave(item: FeedItem) {
        viewModelScope.launch { repository.setSave(item.id, !item.saved) }
    }
}

private data class FeedQuery(val categories: List<String>, val hideCardMode: Boolean)

/** Cursor-backed PagingSource (Paging 3) over the shared repository contract. */
class FeedPagingSource(
    private val repository: ScrollectRepository,
    private val categories: List<String>,
    private val hideCardMode: Boolean = false,
) : PagingSource<String, FeedItem>() {

    override suspend fun load(params: LoadParams<String>): LoadResult<String, FeedItem> = try {
        val page = repository.getFeed(categories, params.key, params.loadSize.coerceAtMost(20))
        val filtered = if (hideCardMode) page.items.filter { !it.isCardMode } else page.items
        LoadResult.Page(filtered, prevKey = null, nextKey = page.nextCursor)
    } catch (e: Exception) {
        LoadResult.Error(e)
    }

    override fun getRefreshKey(state: PagingState<String, FeedItem>): String? =
        state.anchorPosition?.let { anchor -> state.closestItemToPosition(anchor)?.id }
}
