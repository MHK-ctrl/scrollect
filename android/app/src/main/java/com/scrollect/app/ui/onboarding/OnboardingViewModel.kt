package com.scrollect.app.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.scrollect.app.core.data.OnboardingLogic
import com.scrollect.app.core.data.ScrollectRepository
import com.scrollect.app.core.data.SessionManager
import com.scrollect.app.core.data.model.Category
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Onboarding (spec §4.4.2): pick 3–8 interests (visual grid) + surprise me. */
@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val repository: ScrollectRepository,
    private val session: SessionManager,
) : ViewModel() {

    val categories = MutableStateFlow<List<Category>>(emptyList())
    val selected = MutableStateFlow<Set<String>>(emptySet())
    val step = MutableStateFlow(1)
    val saving = MutableStateFlow(false)

    private val _done = MutableStateFlow(false)
    val done = _done.asStateFlow()

    init {
        viewModelScope.launch {
            categories.value = repository.getCategories()
        }
    }

    val canContinue: Boolean get() = OnboardingLogic.canContinue(selected.value.size)

    fun toggle(slug: String) {
        val current = selected.value
        selected.value = when {
            slug in current -> current - slug
            current.size < OnboardingLogic.MAX_SELECTION -> current + slug
            else -> current
        }
    }

    fun surpriseMe() {
        val pool = categories.value.map { it.slug }
        if (pool.isNotEmpty()) selected.value = OnboardingLogic.surprisePick(pool).toSet()
    }

    fun next() {
        if (step.value >= 3) finish() else step.value += 1
    }

    fun finish() {
        if (saving.value) return
        viewModelScope.launch {
            saving.value = true
            val interests = selected.value.toList()
            session.setInterests(interests)
            repository.setInterests(interests)
            session.setOnboardingCompleted()
            _done.value = true
        }
    }
}
