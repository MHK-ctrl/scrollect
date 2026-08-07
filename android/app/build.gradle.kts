import java.util.Properties
import org.gradle.api.Project
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

/**
 * Resolves the live backend base URL. Priority:
 *   1. -Pscrollect.liveBaseUrl=...   (CLI / CI)
 *   2. scrollect.liveBaseUrl in gradle.properties
 *   3. scrollect.liveBaseUrl in local.properties
 * Returns null when unset so the live flavor can fail fast (never falls back to mock).
 *
 * NOTE (configuration-time values): all `scrollect.*` properties here are read at
 * Gradle CONFIGURATION time, not task-execution time. After editing
 * gradle.properties or local.properties, do a Gradle sync / restart the daemon —
 * do not expect a plain incremental build to pick up new values.
 */
fun resolveLiveBaseUrl(p: Project): String? {
    p.findProperty("scrollect.liveBaseUrl")?.toString()?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    val localProps = p.rootProject.file("local.properties")
    if (localProps.exists()) {
        val props = Properties()
        localProps.inputStream().use { props.load(it) }
        props.getProperty("scrollect.liveBaseUrl")?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    }
    return null
}

// ---------------------------------------------------------------------------
// Release signing — NEVER commit a keystore or keystore.properties.
//   Local dev:  keystore.properties  (gitignored)  -> storeFile, storePassword, keyAlias, keyPassword
//   CI:         env vars                          -> SCROLLECT_KEYSTORE_PATH, SCROLLECT_STORE_PASSWORD,
//                                                    SCROLLECT_KEY_ALIAS, SCROLLECT_KEY_PASSWORD
// When neither is present, release builds still succeed but produce an UNSIGNED
// APK (a warning is printed below). Generate the keystore once with:
//   keytool -genkeypair -v -keystore scrollect-release.jks -alias scrollect \
//     -keyalg RSA -keysize 2048 -validity 10000
// ---------------------------------------------------------------------------
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}

fun signingSecret(envName: String, propName: String): String? =
    System.getenv(envName)?.takeIf { it.isNotBlank() }
        ?: keystoreProps.getProperty(propName)?.takeIf { it.isNotBlank() }

val keystorePath = signingSecret("SCROLLECT_KEYSTORE_PATH", "storeFile")
val hasReleaseSigning =
    !keystorePath.isNullOrBlank() &&
        !signingSecret("SCROLLECT_STORE_PASSWORD", "storePassword").isNullOrBlank() &&
        !signingSecret("SCROLLECT_KEY_ALIAS", "keyAlias").isNullOrBlank() &&
        !signingSecret("SCROLLECT_KEY_PASSWORD", "keyPassword").isNullOrBlank()

// Guard: the pre-flavor -Pscrollect.mock flag was replaced by the mock/live
// flavors — warn instead of silently ignoring it.
if (project.findProperty("scrollect.mock") != null) {
    println("WARNING: -Pscrollect.mock is replaced by the 'mock'/'live' product flavors. Use ./gradlew :app:assembleMockDebug or :app:assembleLiveDebug.")
}

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

android {
    namespace = "com.scrollect.app"
    compileSdk = 35

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(keystorePath!!)
                storePassword = signingSecret("SCROLLECT_STORE_PASSWORD", "storePassword")
                keyAlias = signingSecret("SCROLLECT_KEY_ALIAS", "keyAlias")
                keyPassword = signingSecret("SCROLLECT_KEY_PASSWORD", "keyPassword")
            }
        }
    }

    defaultConfig {
        applicationId = "com.scrollect.app"
        minSdk = 26
        targetSdk = 35
        // Single source of truth: gradle.properties -> scrollect.versionCode / scrollect.versionName.
        versionCode = (project.findProperty("scrollect.versionCode") as? String)?.toIntOrNull() ?: 1
        versionName = project.findProperty("scrollect.versionName") as? String ?: "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // Build-time environment choice (mock = offline dev default; live = real backend).
    // Switching is a flavor selection — no code edits, no runtime flags.
    flavorDimensions += "env"
    productFlavors {
        create("mock") {
            dimension = "env"
            buildConfigField("boolean", "MOCK_MODE", "true")
            // Emulator -> host loopback; unused by the offline mock but kept valid.
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8080\"")
        }
        create("live") {
            dimension = "env"
            buildConfigField("boolean", "MOCK_MODE", "false")
            // Never hardcoded: read from scrollect.liveBaseUrl (gradle.properties,
            // local.properties, or -P). Empty here => fail fast at build time below.
            buildConfigField("String", "API_BASE_URL", "\"${resolveLiveBaseUrl(project) ?: ""}\"")
        }
    }

    buildTypes {
        release {
            // R8 full minification + resource shrinking (spec §7.1: signed 64-bit AAB).
            // Hilt/Retrofit/Media3 ship consumer rules; kotlinx.serialization keep
            // rules live in proguard-rules.pro.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            // Sign only when a keystore is configured; otherwise build unsigned (CI
            // uploads debug APKs; Play App Signing re-signs the AAB on upload anyway).
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

val requestedReleaseTask = project.gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }
if (!hasReleaseSigning && requestedReleaseTask) {
    println(
        "WARNING: no release signing configured (keystore.properties missing / env vars unset). " +
            "Release APKs will be UNSIGNED. See docs/LIVE-FLIP.md -> Phase B for the keytool command.",
    )
}

// Fail fast: the live flavor must never silently run against an unset base URL.
// The check runs at task EXECUTION time (doFirst) on the early preLive*Build
// tasks (and assembleLive* as a safety net), so mock builds stay unaffected
// even though all variants are configured up front.
tasks.matching {
    it.name.startsWith("assembleLive") || (it.name.startsWith("preLive") && it.name.endsWith("Build"))
}.configureEach {
    doFirst {
        if (resolveLiveBaseUrl(project).isNullOrBlank()) {
            throw GradleException(
                "SCROLLECT 'live' flavor requires a backend base URL — nothing is configured.\n" +
                    "  • Set it in gradle.properties or local.properties:\n" +
                    "      scrollect.liveBaseUrl=http://10.0.2.2:8080\n" +
                    "  • or pass it on the CLI / CI:\n" +
                    "      ./gradlew :app:assembleLiveDebug -Pscrollect.liveBaseUrl=http://10.0.2.2:8080\n" +
                    "  • Use the 'mock' flavor for offline development (zero configuration):\n" +
                    "      ./gradlew :app:assembleMockDebug",
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)

    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.media3.exoplayer)
    implementation(libs.media3.ui)
    implementation(libs.coil.compose)
    implementation(libs.paging.runtime)
    implementation(libs.paging.compose)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.android)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    // Compose UI tests on Robolectric (feed-entry regression: empty + seeded).
    testImplementation(platform(libs.androidx.compose.bom))
    testImplementation(libs.androidx.ui.test.junit4)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.ui.test.junit4)
    androidTestImplementation(libs.androidx.test.runner)
    // Pin androidx.tracing to 1.1.0: compose ui-test's EspressoLink calls
    // Trace.forceEnableAppTracing() (added in tracing 1.1.0), but activity 1.9.2
    // pins tracing 1.0.0 and AGP consistent-resolution propagates that into the
    // androidTest config, breaking Espresso idling in instrumented tests (the
    // splash effect never advances). debugImplementation bumps it for the debug
    // APK the instrumented tests run against; release builds stay untouched.
    debugImplementation(libs.androidx.tracing)
    debugImplementation(libs.androidx.ui.test.manifest)
}
