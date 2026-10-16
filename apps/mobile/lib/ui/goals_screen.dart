import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'task_screen.dart';
import 'widgets.dart';

/// Goals (GET /api/v1/goals): longer-term direction, how much work is
/// moving each one, and a nudge when nothing is. Shown as a page of the
/// Projects tab and on its own from the account menu.
class GoalsView extends StatefulWidget {
  const GoalsView({super.key, this.header});

  /// Shown above the list (the Projects tab puts its switcher here).
  final Widget? header;

  @override
  State<GoalsView> createState() => _GoalsViewState();
}

class _GoalsViewState extends State<GoalsView> {
  int _generation = 0;

  void _reload() => setState(() => _generation++);

  Future<void> _addGoal() async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _NewGoalSheet(),
    );
    if (created == true && mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Loader<List<Goal>>(
      key: ValueKey(_generation),
      load: api.goals,
      builder: (context, goals, reload) => ListView(
        padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, Tm.s8),
        children: [
          ?widget.header,
          Row(
            children: [
              Expanded(
                child: Text(
                  'Where your work is heading.',
                  style: TextStyle(color: context.tm.textMuted, fontSize: 16),
                ),
              ),
              TextButton.icon(
                onPressed: _addGoal,
                icon: const Icon(Icons.add),
                label: const Text('New goal'),
              ),
            ],
          ),
          const SizedBox(height: Tm.s3),
          if (goals.isEmpty)
            EmptyState(
              icon: Icons.flag_outlined,
              title: 'No goals yet',
              message:
                  'Add one to anchor your work — “Run a 10k”, “Get promoted”, '
                  '“Learn Spanish”.',
              action: FilledButton.icon(
                onPressed: _addGoal,
                icon: const Icon(Icons.add),
                label: const Text('Add a goal'),
              ),
            ),
          for (final goal in goals) ...[
            _GoalCard(goal: goal, changed: reload),
            const SizedBox(height: Tm.s3),
          ],
        ],
      ),
    );
  }
}

/// Goals on their own screen (from the account menu).
class GoalsScreen extends StatelessWidget {
  const GoalsScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Goals')),
    body: const SafeArea(child: GoalsView()),
  );
}

class _GoalCard extends StatelessWidget {
  const _GoalCard({required this.goal, required this.changed});
  final Goal goal;
  final Future<void> Function() changed;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final open = goal.tasks
        .where(
          (t) =>
              t.status == TaskStatus.todo || t.status == TaskStatus.inProgress,
        )
        .toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(Tm.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const IconTile(Icons.flag_outlined, tone: TileTone.sage),
                const SizedBox(width: Tm.s3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        goal.title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        [
                          if (goal.targetDate != null)
                            'By ${DateFormat('d MMM y').format(goal.targetDate!)}',
                          '${goal.completed} of ${goal.linked} done',
                        ].join(' · '),
                        style: TextStyle(color: tm.textMuted, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: Tm.s3),
            ProgressBar(goal.fraction, color: TmColors.sage),
            if (goal.nudge != null) ...[
              const SizedBox(height: Tm.s3),
              Text(
                goal.nudge == GoalNudge.unlinked
                    ? 'Nothing is moving this goal yet. Add one small next step.'
                    : 'Only postponed work is left. Review it or add a fresh step.',
                style: TextStyle(color: tm.aiText),
              ),
            ],
            for (final task in open.take(3))
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: const Icon(Icons.radio_button_unchecked, size: 20),
                title: Text(task.title),
                onTap: () async {
                  if (await openTask(context, task.id)) await changed();
                },
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () async {
                  if (await showGoalSteps(context, goal)) await changed();
                },
                icon: const Icon(Icons.auto_awesome),
                label: const Text('Suggest next steps'),
              ),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () async {
                  if (await showQuickAdd(
                    context,
                    goalId: goal.id,
                    goalTitle: goal.title,
                  )) {
                    await changed();
                  }
                },
                icon: const Icon(Icons.add),
                label: const Text('Add a step towards this'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NewGoalSheet extends StatefulWidget {
  const _NewGoalSheet();

  @override
  State<_NewGoalSheet> createState() => _NewGoalSheetState();
}

class _NewGoalSheetState extends State<_NewGoalSheet> {
  final _title = TextEditingController();
  DateTime? _target;
  bool _busy = false;

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    if (title.isEmpty) return;
    setState(() => _busy = true);
    final api = SessionScope.read(context).api;
    final ok = await runAction(
      context,
      () => api.createGoal(title, targetDate: _target),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
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
          Text('New goal', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: Tm.s3),
          TextField(
            controller: _title,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Goal',
              hintText: 'Run a 10k',
            ),
          ),
          const SizedBox(height: Tm.s3),
          OutlinedButton.icon(
            onPressed: () async {
              final now = DateTime.now();
              final picked = await showDatePicker(
                context: context,
                initialDate: _target ?? now.add(const Duration(days: 90)),
                firstDate: now,
                lastDate: DateTime(now.year + 10),
              );
              if (picked != null) setState(() => _target = picked);
            },
            icon: const Icon(Icons.event_outlined),
            label: Text(
              _target == null
                  ? 'Target date (optional)'
                  : 'By ${DateFormat('d MMM y').format(_target!)}',
            ),
          ),
          const SizedBox(height: Tm.s4),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: Text(_busy ? 'Saving…' : 'Save goal'),
          ),
        ],
      ),
    );
  }
}

/// Suggested next steps for [goal]: edit or remove, then add them to the
/// list. True when saved.
Future<bool> showGoalSteps(BuildContext context, Goal goal) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _GoalStepsSheet(goal: goal),
  );
  return saved == true;
}

class _GoalStepsSheet extends StatefulWidget {
  const _GoalStepsSheet({required this.goal});
  final Goal goal;

  @override
  State<_GoalStepsSheet> createState() => _GoalStepsSheetState();
}

class _GoalStepsSheetState extends State<_GoalStepsSheet> {
  StepSuggestion? _suggestion;
  final _titles = <TextEditingController>[];
  final _minutes = <int?>[];
  String? _error;
  bool _busy = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    for (final c in _titles) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final session = SessionScope.read(context);
    try {
      final suggestion = await session.api.suggestGoalSteps(widget.goal.id);
      if (!mounted) return;
      setState(() {
        _suggestion = suggestion;
        for (final s in suggestion.steps) {
          _titles.add(TextEditingController(text: s.title));
          _minutes.add(s.estimatedMinutes);
        }
        _busy = false;
      });
    } on Object catch (e) {
      await session.handle(e);
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'Couldn’t suggest steps. Try again.';
        });
      }
    }
  }

  Future<void> _save() async {
    final steps = [
      for (final (i, c) in _titles.indexed)
        if (c.text.trim().isNotEmpty)
          (title: c.text.trim(), estimatedMinutes: _minutes[i]),
    ];
    if (steps.isEmpty) return;
    setState(() => _busy = true);
    final api = SessionScope.read(context).api;
    final messenger = ScaffoldMessenger.of(context);
    final ok = await runAction(
      context,
      () => api.saveGoalSteps(widget.goal.id, steps),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (!ok) return;
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          'Added ${steps.length} step${steps.length == 1 ? '' : 's'} to your list',
        ),
      ),
    );
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final suggestion = _suggestion;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Flexible(
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s2),
                children: [
                  Text(
                    'Next steps for ${widget.goal.title}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: Tm.s2),
                  if (suggestion == null && _error == null)
                    const Padding(
                      padding: EdgeInsets.all(Tm.s6),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                  if (_error != null)
                    Text(_error!, style: TextStyle(color: tm.danger)),
                  if (suggestion != null) ...[
                    Text(
                      suggestion.byAi
                          ? suggestion.reply
                          : '${suggestion.reply} (Suggested by built-in rules.)',
                      style: TextStyle(color: tm.textMuted),
                    ),
                    const SizedBox(height: Tm.s2),
                    for (final (i, c) in _titles.indexed)
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: c,
                              decoration: InputDecoration(
                                isDense: true,
                                labelText: 'Step ${i + 1}',
                                helperText: _minutes[i] == null
                                    ? null
                                    : formatMinutes(_minutes[i]!),
                              ),
                            ),
                          ),
                          IconButton(
                            tooltip: 'Remove step ${i + 1}',
                            onPressed: () => setState(() {
                              _titles.removeAt(i).dispose();
                              _minutes.removeAt(i);
                            }),
                            icon: const Icon(Icons.close),
                          ),
                        ],
                      ),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, Tm.s4),
              child: FilledButton(
                onPressed: _busy || _titles.isEmpty ? null : _save,
                child: Text(
                  _busy && suggestion != null
                      ? 'Saving…'
                      : 'Add these to my list',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
