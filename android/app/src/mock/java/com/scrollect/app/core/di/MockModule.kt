package com.scrollect.app.core.di

import com.scrollect.app.core.data.ScrollectRepository
import com.scrollect.app.core.data.mock.MockRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * Mock flavor DI: binds the repository to the fully offline, seeded
 * MockRepository (zero Meta setup / zero network). Compiled ONLY into the
 * `mock` variant — the `live` variant compiles LiveModule instead, so exactly
 * one ScrollectRepository binding exists per variant.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class MockModule {

    @Binds
    abstract fun bindRepository(impl: MockRepository): ScrollectRepository
}
