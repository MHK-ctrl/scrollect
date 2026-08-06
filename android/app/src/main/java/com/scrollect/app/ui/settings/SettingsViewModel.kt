package com.scrollect.app.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.scrollect.app.core.data.ScrollectRepository
import com.scrollect.app.core.data.SessionManager
import com.scrollect.app.core.data.model.Category
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val repository: ScrollectRepository,
    private val session: SessionManager,
) : ViewModel() {

    val categories = MutableStateFlow<List<Category>>(emptyList())
    val interests: StateFlow<List<String>> = session.interestsFlow.stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())
    val hideCardMode: StateFlow<Boolean> = session.hideCardModeFlow.stateIn(viewModelScope, SharingStarted.Eagerly, false)

    private val _deleted = MutableStateFlow(false)
    val deleted = _deleted.asStateFlow()

    init {
        viewModelScope.launch { categories.value = repository.getCategories() }
    }

    fun toggleInterest(slug: String) {
        viewModelScope.launch {
            val current = interests.value
            val next = if (slug in current) current - slug else current + slug
            session.setInterests(next)
            repository.setInterests(next)
        }
    }

    fun setHideCardMode(hide: Boolean) {
        viewModelScope.launch { session.setHideCardMode(hide) }
    }

    fun deleteAccount() {
        viewModelScope.launch {
            session.clearSession()
            _deleted.value = true
        }
    }
}
