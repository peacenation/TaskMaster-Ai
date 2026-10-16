import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

/// Whether the app is reaching TaskMasterAi, what it's showing when it
/// isn't, and how many offline captures are waiting to sync.
class Connection extends ChangeNotifier {
  bool offline = false;

  /// When the data on screen was fetched, while offline.
  DateTime? showingDataFrom;

  /// Quick Adds made offline, not yet sent.
  int pending = 0;

  void markOffline(DateTime dataFrom) {
    if (offline && showingDataFrom == dataFrom) return;
    offline = true;
    showingDataFrom = dataFrom;
    notifyListeners();
  }

  void markOnline() {
    if (!offline) return;
    offline = false;
    showingDataFrom = null;
    notifyListeners();
  }

  void setPending(int count) {
    if (pending == count) return;
    pending = count;
    notifyListeners();
  }
}

/// Where the last good responses and the offline queue are kept.
abstract interface class OfflineStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> clear();
}

class MemoryOfflineStore implements OfflineStore {
  final values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> clear() async => values.clear();
}

/// One file per key in the app's private support directory (not backed up
/// to shared storage; removed on sign-out and with the app).
class FileOfflineStore implements OfflineStore {
  Directory? _dir;

  Future<Directory> _directory() async {
    if (_dir != null) return _dir!;
    final base = await getApplicationSupportDirectory();
    return _dir = await Directory('${base.path}/offline')
        .create(recursive: true);
  }

  Future<File> _file(String key) async {
    final name = sha256.convert(utf8.encode(key)).toString().substring(0, 32);
    return File('${(await _directory()).path}/$name.json');
  }

  @override
  Future<String?> read(String key) async {
    try {
      final file = await _file(key);
      return await file.exists() ? await file.readAsString() : null;
    } on Object {
      return null;
    }
  }

  @override
  Future<void> write(String key, String value) async {
    try {
      final file = await _file(key);
      // Write then rename, so a crash mid-write never leaves half a file.
      final tmp = File('${file.path}.tmp');
      await tmp.writeAsString(value, flush: true);
      await tmp.rename(file.path);
    } on Object {
      // A full disk shouldn't break the app; it just won't work offline.
    }
  }

  @override
  Future<void> clear() async {
    try {
      final dir = await _directory();
      if (await dir.exists()) await dir.delete(recursive: true);
      _dir = null;
    } on Object {
      // Nothing cached.
    }
  }
}
