/**
 * JNI bridge for llama.cpp using the modern sampler-chain API.
 *
 * Tested against llama.cpp commit 153d324bc (Aug 2026).
 * Key API changes vs older versions:
 *   - Grammar via llama_sampler_init_grammar(vocab, str, root)
 *   - Sampling via llama_sampler_chain_init / llama_sampler_chain_add / llama_sampler_sample
 *   - llama_model_get_vocab(model) replaces direct vocab access
 */
#include <jni.h>
#include <string>
#include <vector>
#include <android/log.h>

#include "llama.h"

#define TAG "LlamaCppJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

static llama_model*   g_model = nullptr;
static llama_context* g_ctx   = nullptr;

extern "C" {

JNIEXPORT jboolean JNICALL
Java_expo_modules_llamacpp_LlamaCppModule_nativeLoadModel(
        JNIEnv* env, jobject, jstring jModelPath) {

    // Release any previously loaded model
    if (g_ctx)   { llama_free(g_ctx);        g_ctx   = nullptr; }
    if (g_model) { llama_free_model(g_model); g_model = nullptr; }

    const char* modelPath = env->GetStringUTFChars(jModelPath, nullptr);

    llama_model_params mparams = llama_model_default_params();
    mparams.n_gpu_layers = 0;   // CPU-only; most Android devices have no Vulkan driver for Gemma

    g_model = llama_load_model_from_file(modelPath, mparams);
    env->ReleaseStringUTFChars(jModelPath, modelPath);

    if (!g_model) {
        LOGE("Failed to load model");
        return JNI_FALSE;
    }

    llama_context_params cparams = llama_context_default_params();
    cparams.n_ctx        = 2048;
    cparams.n_threads    = 4;
    cparams.n_threads_batch = 4;

    g_ctx = llama_new_context_with_model(g_model, cparams);
    if (!g_ctx) {
        LOGE("Failed to create context");
        llama_free_model(g_model);
        g_model = nullptr;
        return JNI_FALSE;
    }

    LOGI("Model loaded successfully");
    return JNI_TRUE;
}

JNIEXPORT jstring JNICALL
Java_expo_modules_llamacpp_LlamaCppModule_nativeGenerate(
        JNIEnv* env, jobject, jstring jPrompt, jstring jGrammar) {

    if (!g_ctx || !g_model) {
        return env->NewStringUTF("[ERROR: model not loaded]");
    }

    const char* prompt = env->GetStringUTFChars(jPrompt, nullptr);

    // Tokenize prompt
    std::vector<llama_token> tokens(4096);
    int n = llama_tokenize(g_model, prompt, (int32_t)strlen(prompt),
                           tokens.data(), (int32_t)tokens.size(),
                           /*add_special=*/true, /*parse_special=*/true);
    env->ReleaseStringUTFChars(jPrompt, prompt);

    if (n <= 0) {
        return env->NewStringUTF("[ERROR: tokenization failed]");
    }
    tokens.resize(n);

    // Build sampler chain
    auto sparams = llama_sampler_chain_default_params();
    llama_sampler* chain = llama_sampler_chain_init(sparams);

    // Optional grammar sampler
    if (jGrammar != nullptr) {
        const char* grammarStr = env->GetStringUTFChars(jGrammar, nullptr);
        const llama_vocab* vocab = llama_model_get_vocab(g_model);
        llama_sampler_chain_add(chain,
            llama_sampler_init_grammar(vocab, grammarStr, "root"));
        env->ReleaseStringUTFChars(jGrammar, grammarStr);
    }

    // Low temperature for JSON output, greedy pick
    llama_sampler_chain_add(chain, llama_sampler_init_temp(0.2f));
    llama_sampler_chain_add(chain, llama_sampler_init_greedy());

    // Evaluate the prompt batch
    llama_batch batch = llama_batch_init(512, 0, 1);
    for (int i = 0; i < n; i++) {
        llama_batch_add(batch, tokens[i], i, {0}, false);
    }
    batch.logits[batch.n_tokens - 1] = true;
    llama_decode(g_ctx, batch);
    llama_batch_free(batch);

    // Generation loop
    std::string output;
    const int max_new = 1024;
    int n_past = n;
    llama_token eos = llama_token_eos(g_model);

    for (int i = 0; i < max_new; i++) {
        llama_token tok = llama_sampler_sample(chain, g_ctx, -1);
        if (tok == eos) break;

        char buf[256];
        int len = llama_token_to_piece(g_model, tok, buf, sizeof(buf), 0, true);
        if (len > 0) output.append(buf, len);

        // Feed the new token back
        llama_batch single = llama_batch_init(1, 0, 1);
        llama_batch_add(single, tok, n_past++, {0}, true);
        llama_decode(g_ctx, single);
        llama_batch_free(single);
    }

    llama_sampler_free(chain);
    llama_kv_cache_clear(g_ctx);

    return env->NewStringUTF(output.c_str());
}

JNIEXPORT void JNICALL
Java_expo_modules_llamacpp_LlamaCppModule_nativeFreeModel(JNIEnv*, jobject) {
    if (g_ctx)   { llama_free(g_ctx);        g_ctx   = nullptr; }
    if (g_model) { llama_free_model(g_model); g_model = nullptr; }
    LOGI("Model freed");
}

JNIEXPORT jboolean JNICALL
Java_expo_modules_llamacpp_LlamaCppModule_nativeIsModelLoaded(JNIEnv*, jobject) {
    return (g_ctx != nullptr && g_model != nullptr) ? JNI_TRUE : JNI_FALSE;
}

} // extern "C"
