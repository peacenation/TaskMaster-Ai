import 'package:flutter/material.dart';
import 'package:flutter_timezone/flutter_timezone.dart';

import '../api/client.dart';
import '../auth/auth_gateway.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'widgets.dart';

/// Settings: the same preferences as the web (time zone, length of the
/// working day, plan view, notifications) and permanent account deletion,
/// which app stores require in-app.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final me = session.me;
    final tm = context.tm;
    if (me == null) return const Scaffold();
    final prefs = me.preferences;

    Future<void> save(Map<String, Object?> changes) async {
      final ok = await runAction(
        context,
        () => session.savePreferences(changes),
      );
      if (ok && context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Saved')));
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s8),
          children: [
            SectionCard(
              title: 'Planning',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Time zone'),
                    subtitle: Text(
                      prefs.timeZone ?? '${me.timeZone} (this device)',
                    ),
                    trailing: TextButton(
                      onPressed: () async {
                        final zone = await FlutterTimezone.getLocalTimezone();
                        await save({'timeZone': zone.identifier});
                      },
                      child: const Text('Use this device'),
                    ),
                  ),
                  const SizedBox(height: Tm.s2),
                  Text(
                    'Working day: ${formatMinutes(prefs.dayMinutes)}',
                    style: TextStyle(color: tm.textMuted),
                  ),
                  _DaySlider(
                    minutes: prefs.dayMinutes,
                    onSaved: (m) => save({'dayMinutes': m}),
                  ),
                  const SizedBox(height: Tm.s2),
                  Text('Plan view', style: TextStyle(color: tm.textMuted)),
                  const SizedBox(height: Tm.s1),
                  SegmentedButton<String>(
                    showSelectedIcon: false,
                    segments: const [
                      ButtonSegment(value: 'flexible', label: Text('Flexible')),
                      ButtonSegment(
                        value: 'scheduled',
                        label: Text('Scheduled'),
                      ),
                    ],
                    selected: {prefs.planMode},
                    onSelectionChanged: (s) => save({'planMode': s.first}),
                  ),
                  const SizedBox(height: Tm.s3),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Important reminders'),
                    subtitle: const Text('Due today, missed blocks, deadlines'),
                    value: prefs.notifications == 'important',
                    onChanged: (on) =>
                        save({'notifications': on ? 'important' : 'off'}),
                  ),
                ],
              ),
            ),
            const SizedBox(height: Tm.s4),
            SectionCard(
              title: 'Delete your account',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'This permanently deletes your account and everything in '
                    'it: tasks, Brain Dumps, plans, projects and goals. It '
                    'can’t be undone.',
                    style: TextStyle(color: tm.textMuted),
                  ),
                  const SizedBox(height: Tm.s3),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(foregroundColor: tm.danger),
                    onPressed: () => showModalBottomSheet<void>(
                      context: context,
                      isScrollControlled: true,
                      showDragHandle: true,
                      builder: (_) => _DeleteSheet(hasPassword: me.hasPassword),
                    ),
                    child: const Text('Delete account…'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Saves when the thumb is released, not on every step.
class _DaySlider extends StatefulWidget {
  const _DaySlider({required this.minutes, required this.onSaved});
  final int minutes;
  final ValueChanged<int> onSaved;

  @override
  State<_DaySlider> createState() => _DaySliderState();
}

class _DaySliderState extends State<_DaySlider> {
  late double _value = widget.minutes.clamp(60, 720).toDouble();

  @override
  Widget build(BuildContext context) => Slider(
    value: _value,
    min: 60,
    max: 720,
    divisions: (720 - 60) ~/ 30,
    label: formatMinutes(_value.round()),
    onChanged: (v) => setState(() => _value = v),
    onChangeEnd: (v) => widget.onSaved(v.round()),
  );
}

class _DeleteSheet extends StatefulWidget {
  const _DeleteSheet({required this.hasPassword});
  final bool hasPassword;

  @override
  State<_DeleteSheet> createState() => _DeleteSheetState();
}

class _DeleteSheetState extends State<_DeleteSheet> {
  final _confirm = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _confirm.dispose();
    _password.dispose();
    super.dispose();
  }

  bool get _ready =>
      _confirm.text == 'DELETE' &&
      (!widget.hasPassword || _password.text.isNotEmpty);

  Future<void> _delete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = SessionScope.read(context);
    final navigator = Navigator.of(context);
    try {
      await session.deleteAccount(
        password: widget.hasPassword ? _password.text : null,
      );
      // Signed out: the app returns to sign-in under this sheet.
      navigator.popUntil((route) => route.isFirst);
    } on SignInCancelled {
      if (mounted) setState(() => _busy = false);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = e.message;
        });
      }
    } on Object {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'Could not delete the account. Try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        Tm.s4,
        0,
        Tm.s4,
        MediaQuery.viewInsetsOf(context).bottom + Tm.s4,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Delete your account?',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: Tm.s2),
          Text(
            widget.hasPassword
                ? 'Type DELETE and enter your password to confirm.'
                : 'Type DELETE, then confirm with Google.',
            style: TextStyle(color: tm.textMuted),
          ),
          const SizedBox(height: Tm.s3),
          TextField(
            controller: _confirm,
            autocorrect: false,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(labelText: 'Type DELETE'),
            onChanged: (_) => setState(() {}),
          ),
          if (widget.hasPassword) ...[
            const SizedBox(height: Tm.s3),
            TextField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password'),
              onChanged: (_) => setState(() {}),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: Tm.s3),
            Semantics(
              liveRegion: true,
              child: Text(_error!, style: TextStyle(color: tm.danger)),
            ),
          ],
          const SizedBox(height: Tm.s4),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: tm.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: _busy || !_ready ? null : _delete,
            child: Text(
              _busy
                  ? 'Deleting…'
                  : widget.hasPassword
                  ? 'Permanently delete account'
                  : 'Confirm with Google and delete',
            ),
          ),
        ],
      ),
    );
  }
}
