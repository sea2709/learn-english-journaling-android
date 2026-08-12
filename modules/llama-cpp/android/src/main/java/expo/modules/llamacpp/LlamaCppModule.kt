package expo.modules.llamacpp

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class LlamaCppModule : Module() {

    companion object {
        init {
            System.loadLibrary("llamacpp_jni")
        }
    }

    // JNI native methods
    private external fun nativeLoadModel(modelPath: String): Boolean
    private external fun nativeGenerate(prompt: String, grammar: String?): String
    private external fun nativeFreeModel()
    private external fun nativeIsModelLoaded(): Boolean

    override fun definition() = ModuleDefinition {
        Name("LlamaCpp")

        AsyncFunction("loadModel") { modelPath: String ->
            withContext(Dispatchers.IO) {
                val success = nativeLoadModel(modelPath)
                if (!success) throw Exception("Failed to load model from: $modelPath")
            }
        }

        AsyncFunction("generate") { prompt: String, grammar: String? ->
            withContext(Dispatchers.IO) {
                nativeGenerate(prompt, grammar)
            }
        }

        AsyncFunction("freeModel") {
            withContext(Dispatchers.IO) {
                nativeFreeModel()
            }
        }

        AsyncFunction("isModelLoaded") {
            nativeIsModelLoaded()
        }
    }
}
