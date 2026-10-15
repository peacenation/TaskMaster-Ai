import 'package:flutter/material.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'task_screen.dart';
import 'widgets.dart';

// The decisions Today asks for, on the phone: missed blocks to recover, a
// Reality Check when the day is overloaded, work that keeps slipping, and
// how much time today really has. Nothing changes until the user decides.

/// A card that asks for attention: a coloured left edge and a heading.
class _AttentionCard extends StatelessWidget {
  const _AttentionCard({
    required this.kicker,
    required this.title,
    required this.children,
    this.calm = false,
  });
  final String kicker;
  final String title;
  final List<Widget> children;
  final bool calm;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    // A Material (not a decorated box) so list rows inside keep their ink.
    return Material(
      color: calm ? tm.calmSubtle : tm.dangerSubtle,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(Tm.radiusLg),
      ),
      clipBehavior: Clip.antiAlias,
      child: Container(
        padding: const EdgeInsets.all(Tm.s4),
        decoration: BoxDecoration(
          border: Border(
            left: BorderSide(color: calm ? tm.success : tm.danger, width: 4),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              kicker.toUpperCase(),
              style: TextStyle(
                fontSize: 11,
                letterSpacing: 0.5,
                fontWeight: FontWeight.w700,
                color: calm ? tm.success : tm.danger,
              ),
            ),
            const SizedBox(height: Tm.s1),
            Semantics(
              header: true,
              child: Text(
                title,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            const SizedBox(height: Tm.s2),
            ...children,
          ],
        ),
      ),
    );
  }
}

/// Missed plan blocks: keep, postpone or drop each, then save together.
class RecoveryCard extends StatefulWidget {
  const RecoveryCard({super.key, required this.items, required this.saved});
  final List<RecoveryItem> items;
  final Future<void> Function() saved;

  @override
  State<RecoveryCard> createState() => _RecoveryCardState();
}

class _RecoveryCardState extends State<RecoveryCard> {
  late final Map<String, RecoveryChoice> _choices = {
    for (final item in widget.items) item.id: RecoveryChoice.keep,
  };
  bool _busy = false;

  Future<void> _save() async {
    setState(() => _busy = true);
    final api = SessionScope.read(context).api;
    final ok = await runAction(context, () => api.recover(_choices));
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) await widget.saved();
  }

  @override
  Widget build(BuildContext context) {
    final count = widget.items.length;
    return _AttentionCard(
      kicker: 'Your day changed',
      title: count == 1
          ? '1 planned block was missed'
          : '$count planned blocks were missed',
      children: [
        const Text('Decide what happens to each. Keep leaves it on your list.'),
        const SizedBox(height: Tm.s3),
        for (final item in widget.items) ...[
          Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: Tm.s1),
          SegmentedButton<RecoveryChoice>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: RecoveryChoice.keep, label: Text('Keep')),
              ButtonSegment(
                value: RecoveryChoice.postpone,
                label: Text('Postpone'),
              ),
              ButtonSegment(value: RecoveryChoice.drop, label: Text('Drop')),
            ],
            selected: {_choices[item.id]!},
            onSelectionChanged: (s) =>
                setState(() => _choices[item.id] = s.first),
          ),
          const SizedBox(height: Tm.s3),
        ],
        FilledButton(
          onPressed: _busy ? null : _save,
          child: Text(_busy ? 'Saving…' : 'Save decisions'),
        ),
      ],
    );
  }
}

/// Deadline-critical work is more than the day holds: postpone or drop
/// something, or open it to simplify. Each choice is confirmed.
class RealityCheckCard extends StatelessWidget {
  const RealityCheckCard({
    super.key,
    required this.check,
    required this.decided,
  });
  final RealityCheck check;
  final Future<void> Function() decided;

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.read(context).api;

    Future<void> decide(String id, String title, TaskStatus status) async {
      final verb = status == TaskStatus.dropped ? 'Drop' : 'Postpone';
      final sure = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: Text('$verb “$title”?'),
          content: Text(
            status == TaskStatus.dropped
                ? 'It leaves your active work. You can bring it back later.'
                : 'It leaves today’s plan and stays on your list.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialog).pop(false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialog).pop(true),
              child: Text(verb),
            ),
          ],
        ),
      );
      if (sure != true || !context.mounted) return;
      if (await runAction(context, () => api.setStatus(id, status))) {
        await decided();
      }
    }

    return _AttentionCard(
      kicker: 'Reality Check',
      title: 'Something needs to move',
      children: [
        Text(
          'You have about ${formatMinutes(check.workMinutes)} of '
          'deadline-critical work and roughly '
          '${formatMinutes(check.usableMinutes)} of usable time. That leaves '
          '${formatMinutes(check.excessMinutes)} to resolve. You decide.',
        ),
        const SizedBox(height: Tm.s3),
        if (check.tasks.isEmpty)
          const Text('Review your estimates or available time below.'),
        for (final task in check.tasks) ...[
          Text(
            '${task.title} · ${formatMinutes(task.minutes)}',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          Wrap(
            spacing: Tm.s1,
            children: [
              TextButton(
                onPressed: () =>
                    decide(task.id, task.title, TaskStatus.postponed),
                child: const Text('Postpone'),
              ),
              TextButton(
                onPressed: () async {
                  if (await openTask(context, task.id)) await decided();
                },
                child: const Text('Simplify'),
              ),
              TextButton(
                onPressed: () =>
                    decide(task.id, task.title, TaskStatus.dropped),
                child: const Text('Drop'),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// Waiting On: the follow-up date has come for work someone else owes you.
class FollowUpCard extends StatelessWidget {
  const FollowUpCard({super.key, required this.tasks, required this.changed});
  final List<Task> tasks;
  final Future<void> Function() changed;

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.read(context).api;
    Future<void> update(String id, Map<String, Object?> changes) async {
      if (await runAction(context, () => api.updateTask(id, changes))) {
        await changed();
      }
    }

    return _AttentionCard(
      calm: true,
      kicker: 'Time to follow up',
      title: tasks.length == 1
          ? 'Something you’re waiting on'
          : 'Things you’re waiting on',
      children: [
        for (final task in tasks) ...[
          Text(task.title, style: const TextStyle(fontWeight: FontWeight.w600)),
          Text('Waiting on ${task.waitingOn}'),
          Wrap(
            spacing: Tm.s1,
            children: [
              TextButton(
                onPressed: () => update(task.id, {'waitingOn': null}),
                child: const Text('It’s arrived'),
              ),
              TextButton(
                onPressed: () => update(task.id, {
                  'followUpAt': DateTime.now()
                      .add(const Duration(days: 2))
                      .toUtc()
                      .toIso8601String(),
                }),
                child: const Text('Chased · check in 2 days'),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// A task postponed three times in a row: a gentle nudge to rethink it.
class ProcrastinationCard extends StatelessWidget {
  const ProcrastinationCard({
    super.key,
    required this.tasks,
    required this.changed,
  });
  final List<TaskRef> tasks;
  final Future<void> Function() changed;

  @override
  Widget build(BuildContext context) {
    return _AttentionCard(
      calm: true,
      kicker: 'A pattern worth noticing',
      title: tasks.length == 1
          ? 'A task has moved three times'
          : '${tasks.length} tasks have moved three times',
      children: [
        const Text(
          'That can mean the next step, scope, timing or priority needs a '
          'second look. Break it down or revisit it.',
        ),
        for (final task in tasks)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(task.title),
            trailing: const Icon(Icons.chevron_right),
            onTap: () async {
              if (await openTask(context, task.id)) await changed();
            },
          ),
      ],
    );
  }
}

/// What's realistic today: planned minutes against usable time, and the
/// "I have 90 minutes and low energy" control that rebuilds the plan.
class CapacityCard extends StatelessWidget {
  const CapacityCard({super.key, required this.today, required this.rebuilt});
  final Today today;
  final Future<void> Function() rebuilt;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final available = today.availableMinutes ?? today.settings.dayMinutes;
    return SectionCard(
      title: 'What’s realistic',
      trailing: TextButton(
        onPressed: () async {
          if (await showAdjustDay(context, today.settings)) await rebuilt();
        },
        child: const Text('Adjust my day'),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text.rich(
            TextSpan(
              text: '${today.plannedMinutes}',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              children: [
                TextSpan(
                  text: ' of $available min planned',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w400,
                    color: tm.textMuted,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: Tm.s2),
          Semantics(
            label: '${today.plannedMinutes} of $available minutes planned',
            excludeSemantics: true,
            child: ProgressBar(
              available == 0 ? 0 : today.plannedMinutes / available,
              color: today.overloaded ? tm.danger : null,
            ),
          ),
          const SizedBox(height: Tm.s2),
          Text(
            [
              if (today.meetingMinutes > 0)
                '${formatMinutes(today.meetingMinutes)} of meetings taken out',
              if (today.settings.energy != null)
                '${today.settings.energy![0].toUpperCase()}'
                    '${today.settings.energy!.substring(1)} energy',
              today.overloaded
                  ? 'More is due than fits today.'
                  : 'A buffer is held back for the unexpected.',
            ].join(' · '),
            style: TextStyle(color: tm.textMuted, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

/// The Adjust my day sheet; true when the plan was rebuilt.
Future<bool> showAdjustDay(BuildContext context, TodaySettings current) async {
  final rebuilt = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _AdjustDaySheet(current: current),
  );
  return rebuilt == true;
}

class _AdjustDaySheet extends StatefulWidget {
  const _AdjustDaySheet({required this.current});
  final TodaySettings current;

  @override
  State<_AdjustDaySheet> createState() => _AdjustDaySheetState();
}

class _AdjustDaySheetState extends State<_AdjustDaySheet> {
  /// Time for work today: sizes the plan (the web's "time available today").
  late double _day = widget.current.dayMinutes.clamp(30, 720).toDouble();

  /// A short stretch right now: picks a next action that fits it.
  late int? _rightNow =
      const [15, 30, 60].contains(widget.current.availableMinutes)
      ? widget.current.availableMinutes
      : null;
  late String? _energy = widget.current.energy;
  bool _busy = false;

  Future<void> _save() async {
    setState(() => _busy = true);
    final api = SessionScope.read(context).api;
    final ok = await runAction(
      context,
      () => api.rebuildToday(
        TodaySettings(
          dayMinutes: _day.round(),
          availableMinutes: _rightNow,
          energy: _energy,
        ),
      ),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Padding(
      padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s6),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Adjust my day', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: Tm.s1),
          Text(
            'Tell TaskMasterAi how much time you really have; it rebuilds '
            'today’s plan around it.',
            style: TextStyle(color: tm.textMuted),
          ),
          const SizedBox(height: Tm.s4),
          Text('Time for work today: ${formatMinutes(_day.round())}'),
          Slider(
            value: _day,
            min: 30,
            max: 720,
            divisions: (720 - 30) ~/ 15,
            label: formatMinutes(_day.round()),
            onChanged: (v) => setState(() => _day = v),
          ),
          Text(
            'Meetings in your calendar come out of this automatically.',
            style: TextStyle(color: tm.textMuted, fontSize: 13),
          ),
          const SizedBox(height: Tm.s3),
          const Text('Right now I have'),
          const SizedBox(height: Tm.s1),
          SegmentedButton<int?>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: null, label: Text('Any')),
              ButtonSegment(value: 15, label: Text('15m')),
              ButtonSegment(value: 30, label: Text('30m')),
              ButtonSegment(value: 60, label: Text('1h')),
            ],
            selected: {_rightNow},
            onSelectionChanged: (s) => setState(() => _rightNow = s.first),
          ),
          const SizedBox(height: Tm.s2),
          const Text('Energy right now'),
          const SizedBox(height: Tm.s1),
          SegmentedButton<String?>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: null, label: Text('Any')),
              ButtonSegment(value: 'low', label: Text('Low')),
              ButtonSegment(value: 'medium', label: Text('Medium')),
              ButtonSegment(value: 'high', label: Text('High')),
            ],
            selected: {_energy},
            onSelectionChanged: (s) => setState(() => _energy = s.first),
          ),
          const SizedBox(height: Tm.s5),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: Text(_busy ? 'Rebuilding…' : 'Rebuild today’s plan'),
          ),
        ],
      ),
    );
  }
}

/// Pick your own next action from today's plan; true when chosen.
Future<bool> chooseNextTask(BuildContext context, Today today) async {
  final current = today.recommendation?.task.id;
  final options = [
    for (final item in today.plan)
      if (item.task.id != current) item.task,
  ];
  final chosen = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (sheet) => SafeArea(
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s4),
        children: [
          Text(
            'What would you rather do next?',
            style: Theme.of(sheet).textTheme.titleMedium,
          ),
          const SizedBox(height: Tm.s2),
          if (options.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: Tm.s4),
              child: Text('Nothing else is planned for today.'),
            ),
          for (final task in options)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(task.title),
              subtitle: task.project == null ? null : Text(task.project!.name),
              onTap: () => Navigator.of(sheet).pop(task.id),
            ),
        ],
      ),
    ),
  );
  if (chosen == null || !context.mounted) return false;
  final api = SessionScope.read(context).api;
  return runAction(context, () => api.chooseNext(chosen));
}
