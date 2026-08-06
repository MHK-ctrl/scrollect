package com.scrollect.app.core.data.mock

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MockCatalogTest {

    @Test
    fun taxonomyHasAllFourteenCategories() {
        assertEquals(14, MockCatalog.categories.size)
    }

    @Test
    fun everyCategoryHasAtLeastOneItem() {
        val slugs = MockCatalog.categories.map { it.slug }.toSet()
        val itemSlugs = MockCatalog.allItems.flatMap { it.categories }.toSet()
        assertTrue("missing: ${slugs - itemSlugs}", slugs.all { it in itemSlugs })
    }

    @Test
    fun everyItemIsPlayableOrCardMode() {
        for (item in MockCatalog.allItems) {
            assertTrue(
                "item ${item.id} must be playable or card-mode",
                item.isCardMode || item.videoUrl != null,
            )
        }
    }

    @Test
    fun byCreatorFiltersItems() {
        val first = MockCatalog.allItems.first()
        val byCreator = MockCatalog.byCreator(first.creator.id)
        assertTrue(byCreator.isNotEmpty())
        assertTrue(byCreator.all { it.creator.id == first.creator.id })
    }

    @Test
    fun byIdRoundTrips() {
        val item = MockCatalog.allItems.first()
        assertEquals(item.id, MockCatalog.byId(item.id)?.id)
        assertNotNull(MockCatalog.creatorById(item.creator.id))
    }
}
