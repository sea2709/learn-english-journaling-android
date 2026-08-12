package expo.modules.llamacpp

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.Package

class LlamaCppPackage : Package {
    override fun createModules(): List<Module> = listOf(LlamaCppModule())
}
