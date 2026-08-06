package com.scrollect.app.core.util

/** Compact count formatting: 8420 -> "8.4k", 1_200_000 -> "1.2M". */
fun formatCount(n: Int): String = when {
    n >= 1_000_000 -> compact(n / 1_000_000.0, "M")
    n >= 1_000 -> compact(n / 1_000.0, "k")
    else -> n.toString()
}

private fun compact(value: Double, suffix: String): String {
    val s = "%.1f".format(value).removeSuffix(".0")
    return s + suffix
}
