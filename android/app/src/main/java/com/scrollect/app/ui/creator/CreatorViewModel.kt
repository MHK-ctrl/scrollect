package com.scrollect.app.ui.creator

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.scrollect.app.core.data.ScrollectRepository
import com.scrollect.app.core.data.model.CreatorSummary
import com.scrollect.app.core.data.model.FeedItem
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

@HiltViewModel
class CreatorViewModel @Inject constructor(
    private val repository: ScrollectRepository,
) : ViewModel() {

    val creator = MutableStateFlow<CreatorSummary?>(null)
    val media = MutableStateFlow<List<FeedItem>>(emptyList())
    val loading = MutableStateFlow(false)

    private val loadedFor = MutableStateFlow<String?>(null)

    fun load(creatorId: String) {
        if (loadedFor.value == creatorId) return
        loadedFor.value = creatorId
        loading.value = true
        viewModelScope.launch {
            try {
                creator.value = repository.getCreator(creatorId)
                media.value = repository.getCreatorMedia(creatorId)
            } finally {
                // Always clear the flag: a stuck `loading = true` shows the
                // skeleton forever (same class of bug as the onboarding fix).
                loading.value = false
            }
        }
    }

    fun toggleLike(item: FeedItem) {
        viewModelScope.launch { repository.setLike(item.id, !item.liked) }
    }

    fun toggleSave(item: FeedItem) {
        viewModelScope.launch { repository.setSave(item.id, !item.saved) }
    }
}
