/**
 * Custom Expo Module: llama-cpp
 *
 * This module exposes the native llama.cpp JNI bridge.
 * The native implementation lives in:
 *   android/src/main/java/expo/modules/llamacpp/LlamaCppModule.kt
 *   android/src/main/jni/llama_jni.cpp
 *
 * For development without a native build, all methods throw descriptive errors.
 */
import { NativeModulesProxy, EventEmitter } from "expo-modules-core";

const LlamaCppModule = NativeModulesProxy.LlamaCpp;

const LlamaCpp = {
  /**
   * Load a GGUF model file from the given absolute path.
   * Must be called before generate().
   */
  async loadModel(modelPath: string): Promise<void> {
    if (!LlamaCppModule) {
      throw new Error(
        "LlamaCpp native module not found. Run `expo run:android` to build the native module."
      );
    }
    return LlamaCppModule.loadModel(modelPath);
  },

  /**
   * Generate a text completion for the given prompt.
   * Optionally pass a JSON grammar string for constrained decoding.
   */
  async generate(prompt: string, grammar?: string): Promise<string> {
    if (!LlamaCppModule) {
      throw new Error("LlamaCpp native module not found.");
    }
    return LlamaCppModule.generate(prompt, grammar ?? null);
  },

  /**
   * Free the loaded model from memory.
   */
  async freeModel(): Promise<void> {
    if (!LlamaCppModule) return;
    return LlamaCppModule.freeModel();
  },

  /**
   * Returns true if a model is currently loaded and ready.
   */
  async isModelLoaded(): Promise<boolean> {
    if (!LlamaCppModule) return false;
    return LlamaCppModule.isModelLoaded();
  },
};

export default LlamaCpp;
