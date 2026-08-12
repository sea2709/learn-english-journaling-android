cmake_minimum_required(VERSION 3.22.1)
project(llamacpp_jni)

set(LLAMA_CPP_DIR "${CMAKE_CURRENT_SOURCE_DIR}/llama.cpp")

# Disable features that don't build on Android
set(LLAMA_BUILD_TESTS    OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER   OFF CACHE BOOL "" FORCE)
set(GGML_METAL           OFF CACHE BOOL "" FORCE)
set(GGML_CUDA            OFF CACHE BOOL "" FORCE)

add_subdirectory(${LLAMA_CPP_DIR} llama_build)

add_library(llamacpp_jni SHARED llama_jni.cpp)

target_include_directories(llamacpp_jni PRIVATE
    ${LLAMA_CPP_DIR}/include
    ${LLAMA_CPP_DIR}/common
    ${LLAMA_CPP_DIR}/ggml/include
)

target_link_libraries(llamacpp_jni
    llama
    ggml
    android
    log
)

target_compile_options(llamacpp_jni PRIVATE
    -std=c++17
    -ffast-math
    -O3
)
