# android-browser-helper starts and toggles its activities by class name;
# renaming them crashes LauncherActivity ("Component class … does not exist").
-keep class com.google.androidbrowserhelper.** { *; }
