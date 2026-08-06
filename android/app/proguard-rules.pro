# SCROLLECT R8 rules — release builds run full minification (isMinifyEnabled)
# + resource shrinking (isShrinkResources). Hilt, Retrofit 2, Coil, and Media3
# ship their own consumer rules; only kotlinx.serialization needs explicit
# keeps below (official template, scoped to the app package).

-keepattributes *Annotation*, InnerClasses, Signature, EnclosingMethod

# --- kotlinx.serialization (official rule set) ---
# Generated serializer classes are looked up reflectively at runtime.
-keep,includedescriptorclasses class com.scrollect.app.**$$serializer { *; }
-keepclassmembers class com.scrollect.app.** {
    *** Companion;
}
-keepclasseswithmembers class com.scrollect.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-dontwarn kotlinx.serialization.**

# Retrofit service interface + response models are referenced reflectively.
-keep class com.scrollect.app.core.data.remote.** { *; }
-keepattributes Signature
-dontwarn org.jetbrains.annotations.**
