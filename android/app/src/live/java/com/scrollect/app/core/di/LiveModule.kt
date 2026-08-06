package com.scrollect.app.core.di

import com.scrollect.app.core.data.ScrollectRepository
import com.scrollect.app.core.data.remote.RemoteRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * Live flavor DI: binds the repository to the backend-backed RemoteRepository
 * (Retrofit against BuildConfig.API_BASE_URL, which comes from
 * `scrollect.liveBaseUrl`). Compiled ONLY into the `live` variant — the `mock`
 * variant compiles MockModule instead, so exactly one ScrollectRepository
 * binding exists per variant.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class LiveModule {

    @Binds
    abstract fun bindRepository(impl: RemoteRepository): ScrollectRepository
}
