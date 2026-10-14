import java.util.Properties

// TaskMaster for Android: a Trusted Web Activity that opens the deployed PWA
// full-screen in Chrome. All features run on the web app, so it needs a
// connection (the service worker shows an offline page without one).

plugins {
    id("com.android.application")
}

val siteHost = "taskmaster-ai-omega.vercel.app"
val siteUrl = "https://$siteHost"

// Release signing lives outside the repo (see android/README.md). Point at it
// with TASKMASTER_KEYSTORE_PROPERTIES or keep it at the default path.
val keystoreProperties = Properties().apply {
    val path = System.getenv("TASKMASTER_KEYSTORE_PROPERTIES")
        ?: "${System.getProperty("user.home")}/.android-release-keys/taskmaster/keystore.properties"
    val file = File(path)
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "app.vercel.taskmaster_ai_omega.twa"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.vercel.taskmaster_ai_omega.twa"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        manifestPlaceholders["hostName"] = siteHost
        resValue("string", "launchUrl", "$siteUrl/")
        resValue(
            "string",
            "assetStatements",
            "[{\\\"relation\\\": [\\\"delegate_permission/common.handle_all_urls\\\"], " +
                "\\\"target\\\": {\\\"namespace\\\": \\\"web\\\", \\\"site\\\": \\\"$siteUrl\\\"}}]",
        )
    }

    signingConfigs {
        create("release") {
            if (keystoreProperties.isNotEmpty()) {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystoreProperties.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
        }
    }

    buildFeatures {
        resValues = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.4")
}
