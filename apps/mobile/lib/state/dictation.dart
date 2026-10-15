import 'package:speech_to_text/speech_to_text.dart';

/// Speak a Brain Dump instead of typing it, with the phone's own speech
/// recognition. TaskMasterAi only receives the text that ends up in the
/// box, never audio.
abstract interface class Dictation {
  /// Start listening; [onWords] gets everything heard so far, [onDone]
  /// when listening stops. Returns false (with [onError]) if unavailable.
  Future<bool> start({
    required void Function(String words) onWords,
    required void Function() onDone,
    required void Function(String message) onError,
  });

  Future<void> stop();
}

class DeviceDictation implements Dictation {
  final _speech = SpeechToText();
  bool _ready = false;

  @override
  Future<bool> start({
    required void Function(String words) onWords,
    required void Function() onDone,
    required void Function(String message) onError,
  }) async {
    try {
      _ready =
          _ready ||
          await _speech.initialize(
            onStatus: (status) {
              if (status == 'done' || status == 'notListening') onDone();
            },
            onError: (error) {
              onError(
                error.errorMsg == 'error_permission'
                    ? 'Microphone access is off. Allow it in Settings to dictate.'
                    : 'Dictation stopped. Try again, or type instead.',
              );
              onDone();
            },
          );
      if (!_ready) {
        onError('Speech recognition isn’t available on this phone.');
        return false;
      }
      await _speech.listen(
        onResult: (result) => onWords(result.recognizedWords),
        listenOptions: SpeechListenOptions(
          listenMode: ListenMode.dictation,
          partialResults: true,
          cancelOnError: true,
          autoPunctuation: true,
          pauseFor: const Duration(seconds: 6),
        ),
      );
      return true;
    } on Object {
      onError('Speech recognition isn’t available on this phone.');
      return false;
    }
  }

  @override
  Future<void> stop() => _speech.stop();
}
