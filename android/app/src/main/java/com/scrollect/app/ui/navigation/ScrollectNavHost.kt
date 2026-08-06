package com.scrollect.app.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.scrollect.app.ui.creator.CreatorPagerScreen
import com.scrollect.app.ui.creator.CreatorProfileScreen
import com.scrollect.app.ui.feed.FeedScreen
import com.scrollect.app.ui.onboarding.OnboardingScreen
import com.scrollect.app.ui.settings.SettingsScreen
import com.scrollect.app.ui.splash.SplashScreen

object Routes {
    const val SPLASH = "splash"
    const val ONBOARDING = "onboarding"
    const val FEED = "feed"
    const val SETTINGS = "settings"
    const val CREATOR = "creator/{creatorId}"
    const val CREATOR_PLAY = "creator-play/{creatorId}"

    fun creator(creatorId: String) = "creator/$creatorId"
    fun creatorPlay(creatorId: String) = "creator-play/$creatorId"
}

@Composable
fun ScrollectNavHost() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = Routes.SPLASH) {
        composable(Routes.SPLASH) {
            SplashScreen(
                onDone = { hasCompletedOnboarding ->
                    navController.navigate(if (hasCompletedOnboarding) Routes.FEED else Routes.ONBOARDING) {
                        popUpTo(Routes.SPLASH) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.ONBOARDING) {
            OnboardingScreen(onDone = {
                navController.navigate(Routes.FEED) { popUpTo(Routes.ONBOARDING) { inclusive = true } }
            })
        }
        composable(Routes.FEED) {
            FeedScreen(
                onOpenCreator = { id -> navController.navigate(Routes.creator(id)) },
                onOpenSettings = { navController.navigate(Routes.SETTINGS) },
            )
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(onBack = { navController.popBackStack() }, onLoggedOut = {
                navController.navigate(Routes.ONBOARDING) { popUpTo(0) { inclusive = true } }
            })
        }
        composable(Routes.CREATOR) { backStackEntry ->
            val creatorId = backStackEntry.arguments?.getString("creatorId").orEmpty()
            CreatorProfileScreen(creatorId = creatorId, onBack = { navController.popBackStack() }, onOpenReel = { id -> navController.navigate(Routes.creatorPlay(id)) })
        }
        composable(Routes.CREATOR_PLAY) { backStackEntry ->
            val creatorId = backStackEntry.arguments?.getString("creatorId").orEmpty()
            CreatorPagerScreen(creatorId = creatorId, onBack = { navController.popBackStack() })
        }
    }
}

internal fun NavHostController.goToFeedClearingBackStack() {
    navigate(Routes.FEED) { popUpTo(0) { inclusive = true } }
}
