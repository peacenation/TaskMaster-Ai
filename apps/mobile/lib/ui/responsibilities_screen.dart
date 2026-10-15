import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'brain_dump_screen.dart';
import 'widgets.dart';

/// Recurring responsibilities (GET /api/v1/responsibilities): repeating
/// work in its own lane, with the next 30 days of instances. They're
/// captured from a Brain Dump ("gym three times a week").
class ResponsibilitiesScreen extends StatefulWidget {
  const ResponsibilitiesScreen({super.key});

  @override
  State<ResponsibilitiesScreen> createState() => _ResponsibilitiesScreenState();
}

class _ResponsibilitiesScreenState extends State<ResponsibilitiesScreen> {
  int _generation = 0;

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    final tm = context.tm;
    return Scaffold(
      appBar: AppBar(title: const Text('Responsibilities')),
      body: SafeArea(
        child: Loader<List<Responsibility>>(
          key: ValueKey(_generation),
          load: api.responsibilities,
          builder: (context, all, reload) {
            final active = all.where((r) => !r.stopped).toList();
            final stopped = all.where((r) => r.stopped).toList();
            Future<void> capture() async {
              if (await openBrainDump(context)) {
                setState(() => _generation++);
              }
            }

            return ListView(
              padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s8),
              children: [
                Text(
                  'Repeating work, kept out of the way until it’s due.',
                  style: TextStyle(color: tm.textMuted, fontSize: 16),
                ),
                const SizedBox(height: Tm.s4),
                if (active.isEmpty)
                  EmptyState(
                    icon: Icons.repeat,
                    title: 'No active responsibilities',
                    message:
                        'Capture a repeating commitment in a Brain Dump, such '
                        'as “go to the gym three times a week”.',
                    action: FilledButton.icon(
                      onPressed: capture,
                      icon: const Icon(Icons.auto_awesome),
                      label: const Text('Start a Brain Dump'),
                    ),
                  ),
                for (final rule in active) ...[
                  _RuleCard(rule: rule, changed: reload),
                  const SizedBox(height: Tm.s3),
                ],
                if (stopped.isNotEmpty) ...[
                  const SizedBox(height: Tm.s3),
                  Text(
                    'Stopped',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  for (final rule in stopped)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(rule.title),
                      subtitle: const Text(
                        'Past instances stay in your history.',
                      ),
                    ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _RuleCard extends StatelessWidget {
  const _RuleCard({required this.rule, required this.changed});
  final Responsibility rule;
  final Future<void> Function() changed;

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.read(context).api;
    final tm = context.tm;
    final upcoming = rule.upcoming
        .where(
          (o) =>
              o.status != TaskStatus.completed &&
              o.status != TaskStatus.dropped,
        )
        .take(5)
        .toList();
    return SectionCard(
      title: rule.title,
      trailing: TextButton(
        onPressed: () async {
          final sure = await showDialog<bool>(
            context: context,
            builder: (dialog) => AlertDialog(
              title: Text('Stop “${rule.title}”?'),
              content: const Text(
                'No new instances will be created. Past ones stay in your '
                'history.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(dialog).pop(false),
                  child: const Text('Cancel'),
                ),
                TextButton(
                  onPressed: () => Navigator.of(dialog).pop(true),
                  child: const Text('Stop'),
                ),
              ],
            ),
          );
          if (sure != true || !context.mounted) return;
          if (await runAction(context, () => api.stopResponsibility(rule.id))) {
            await changed();
          }
        },
        child: const Text('Stop'),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            _capitalise(rule.cadence),
            style: TextStyle(color: tm.textMuted),
          ),
          if (upcoming.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: Tm.s2),
              child: Text('Nothing due in the next 30 days.'),
            ),
          for (final o in upcoming)
            Row(
              children: [
                CompleteCircle(
                  title: o.title,
                  onDone: () async {
                    final ok = await runAction(
                      context,
                      () => api.setStatus(o.id, TaskStatus.completed),
                    );
                    if (ok) await changed();
                  },
                ),
                Expanded(child: Text(DateFormat('EEE d MMM').format(o.date))),
              ],
            ),
        ],
      ),
    );
  }
}

String _capitalise(String s) =>
    s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
