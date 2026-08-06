package com.scrollect.app.core.di

import com.scrollect.app.BuildConfig
import com.scrollect.app.core.data.remote.ScrollectApi
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/**
 * Live-flavor wiring smoke test (JVM, no network, no Meta credentials):
 *  - the live variant is actually configured (MOCK_MODE=false, base URL set);
 *  - the Retrofit + ScrollectApi network stack constructs with the stub base
 *    URL — the same pieces LiveModule wires into RemoteRepository.
 * Run with: ./gradlew :app:testLiveDebugUnitTest -Pscrollect.liveBaseUrl=http://10.0.2.2:8080
 */
class LiveFlavorSmokeTest {

    @Test
    fun buildConfigPointsAtLiveBackend() {
        assertFalse("live flavor must have MOCK_MODE=false", BuildConfig.MOCK_MODE)
        val url = BuildConfig.API_BASE_URL.toHttpUrlOrNull()
        assertNotNull("live flavor requires API_BASE_URL — set scrollect.liveBaseUrl", url)
        assertTrue("API_BASE_URL must have a host: ${BuildConfig.API_BASE_URL}", url!!.host.isNotBlank())
    }

    @Test
    fun networkStackConstructsWithStubBaseUrlWithoutNetwork() {
        val json = Json { ignoreUnknownKeys = true; isLenient = true }
        val client = OkHttpClient.Builder().build()
        val retrofit = Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL + "/")
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
        val api: ScrollectApi = retrofit.create(ScrollectApi::class.java)
        assertNotNull(api)
    }
}
