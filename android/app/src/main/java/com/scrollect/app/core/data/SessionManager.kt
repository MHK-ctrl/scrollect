package com.scrollect.app.core.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Provider

val Context.scrollectDataStore by preferencesDataStore(name = "scrollect_prefs")

/** Viewer session + prefs persisted via DataStore (no PII; offline-first). */
@Singleton
class SessionManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private object Keys {
        val deviceId = stringPreferencesKey("device_id")
        val authToken = stringPreferencesKey("auth_token")
        val interests = stringSetPreferencesKey("interests")
        val onboardingCompleted = stringPreferencesKey("onboarding_completed")
        val hideCardMode = stringPreferencesKey("hide_card_mode")
    }

    val hideCardModeFlow: Flow<Boolean> = context.scrollectDataStore.data.map { prefs ->
        prefs[Keys.hideCardMode] == "true"
    }

    val interestsFlow: Flow<List<String>> = context.scrollectDataStore.data.map { prefs ->
        prefs[Keys.interests]?.toList() ?: emptyList()
    }

    val onboardingCompletedFlow: Flow<Boolean> = context.scrollectDataStore.data.map { prefs ->
        prefs[Keys.onboardingCompleted] == "true"
    }

    suspend fun ensureDeviceId(): String {
        val prefs = context.scrollectDataStore.data.first()
        prefs[Keys.deviceId]?.let { return it }
        val id = "device-${UUID.randomUUID()}"
        context.scrollectDataStore.edit { it[Keys.deviceId] = id }
        return id
    }

    suspend fun setAuthToken(token: String) {
        context.scrollectDataStore.edit { it[Keys.authToken] = token }
    }

    suspend fun setInterests(interests: List<String>) {
        context.scrollectDataStore.edit { it[Keys.interests] = interests.toSet() }
    }

    suspend fun setOnboardingCompleted() {
        context.scrollectDataStore.edit { it[Keys.onboardingCompleted] = "true" }
    }

    suspend fun setHideCardMode(hide: Boolean) {
        context.scrollectDataStore.edit { it[Keys.hideCardMode] = hide.toString() }
    }

    suspend fun clearSession() {
        context.scrollectDataStore.edit { it.clear() }
    }
}
