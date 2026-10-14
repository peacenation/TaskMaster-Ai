import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Where the appearance choice is kept. An interface so tests don't need
/// the platform keychain.
abstract interface class AppearanceStore {
  Future<String?> read();
  Future<void> write(String value);
}

class SecureAppearanceStore implements AppearanceStore {
  static const _key = 'appearance';
  static const _storage = FlutterSecureStorage();

  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String value) => _storage.write(key: _key, value: value);
}

class MemoryAppearanceStore implements AppearanceStore {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String v) async => value = v;
}

/// System, Light or Dark — follows the phone until the person picks one.
class Appearance extends ValueNotifier<ThemeMode> {
  Appearance([AppearanceStore? store])
    : _store = store ?? MemoryAppearanceStore(),
      super(ThemeMode.system);

  final AppearanceStore _store;

  Future<void> load() async {
    value =
        ThemeMode.values.asNameMap()[await _store.read()] ?? ThemeMode.system;
  }

  Future<void> choose(ThemeMode mode) async {
    value = mode;
    await _store.write(mode.name);
  }
}

class AppearanceScope extends InheritedNotifier<Appearance> {
  const AppearanceScope({
    super.key,
    required Appearance appearance,
    required super.child,
  }) : super(notifier: appearance);

  static Appearance of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<AppearanceScope>()!.notifier!;
}
