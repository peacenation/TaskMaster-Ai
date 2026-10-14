# Branding assets

All drawn from the TaskMasterAi mark — a "T" whose stem finishes in a check
(the same geometry as `LogoMark` in `lib/ui/widgets.dart` and
`apps/web/components/shell/icons.tsx`).

| File | Use |
|---|---|
| `logo-mark.png` | Master mark, transparent |
| `icon.png` | App icon (iOS, legacy Android): mark on espresso `#35251F` |
| `icon_foreground.png` | Android adaptive icon foreground (inside the safe zone) |
| `icon_monochrome.png` | Android 13+ themed icon |
| `splash_logo.png` | Native launch screen |
| `splash_android12.png` | Android 12+ launch screen (mark fits the 768px icon circle) |

Regenerate the platform files after changing any of these:

    dart run flutter_launcher_icons
    dart run flutter_native_splash:create
