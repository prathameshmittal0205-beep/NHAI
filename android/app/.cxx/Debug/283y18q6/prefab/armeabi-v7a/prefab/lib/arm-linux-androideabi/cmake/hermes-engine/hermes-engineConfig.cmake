if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "C:/Users/pratm/.gradle/caches/transforms-4/5e2e37959f5e4784b566f4ff1d656470/transformed/hermes-android-0.73.6-debug/prefab/modules/libhermes/libs/android.armeabi-v7a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/pratm/.gradle/caches/transforms-4/5e2e37959f5e4784b566f4ff1d656470/transformed/hermes-android-0.73.6-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

