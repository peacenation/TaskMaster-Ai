import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'focus_screen.dart';
import 'widgets.dart';

/// Opens a task's screen; true when something changed, so the caller
/// reloads.
Future<bool> openTask(BuildContext context, String id) async {
  final changed = await Navigator.of(context)
      .push<bool>(MaterialPageRoute(builder: (_) => TaskScreen(id: id)));
  return changed == true;
}

/// One task (GET /api/v1/tasks/{id}): act on it, focus, edit it, break a
/// large one into steps, or delete it — the web's task page.
class TaskScreen extends StatefulWidget {
  const TaskScreen({super.key, required this.id});
  final String id;

  @override
  State<TaskScreen> createState() => _TaskScreenState();
}

class _TaskScreenState extends State<TaskScreen> {
  int _generation = 0;
  bool _changed = false;

  void _reload() => setState(() {
    _changed = true;
    _generation++;
  });

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return PopScope<bool>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) Navigator.of(context).pop(_changed);
      },
      child: Scaffold(
        appBar: AppBar(),
        body: SafeArea(
          child: Loader<TaskDetail>(
            key: ValueKey(_generation),
            load: () => api.taskDetail(widget.id),
            builder: (context, detail, _) => _Body(
              detail: detail,
              changed: _reload,
              deleted: () => Navigator.of(context).pop(true),
            ),
          ),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.detail,
    required this.changed,
    required this.deleted,
  });
  final TaskDetail detail;
  final VoidCallback changed;
  final VoidCallback deleted;

  bool get _open => const [
    TaskStatus.todo,
    TaskStatus.inProgress,
    TaskStatus.inbox,
  ].contains(detail.task.status);

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final task = detail.task;
    final api = SessionScope.read(context).api;

    Future<void> act(TaskStatus status) async {
      if (await runAction(context, () => api.setStatus(task.id, status))) {
        changed();
      }
    }

    Future<void> remove() async {
      final sure = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: const Text('Delete this task?'),
          content: Text('“${task.title}” and its history will be removed.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialog).pop(false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialog).pop(true),
              child: const Text('Delete'),
            ),
          ],
        ),
      );
      if (sure != true || !context.mounted) return;
      if (await runAction(context, () => api.deleteTask(task.id))) deleted();
    }

    final facts = [
      if (task.dueAt != null)
        'Due ${DateFormat('EEE d MMM, HH:mm').format(task.dueAt!)}',
      if (task.estimatedMinutes != null) formatMinutes(task.estimatedMinutes!),
      if (detail.energy != null) '${_capitalise(detail.energy!)} energy',
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s8),
      children: [
        Text(
          _statusLabel(task.status),
          style: TextStyle(
            color: tm.aiText,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: Tm.s1),
        Semantics(
          header: true,
          child: Text(
            task.title,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
        ),
        const SizedBox(height: Tm.s2),
        Wrap(
          spacing: Tm.s2,
          runSpacing: Tm.s2,
          children: [
            if (task.priority != null) PriorityBadge(task.priority!),
            if (task.project != null)
              _Chip(icon: Icons.folder_outlined, label: task.project!.name),
            if (detail.goal != null)
              _Chip(icon: Icons.flag_outlined, label: detail.goal!.title),
          ],
        ),
        if (facts.isNotEmpty) ...[
          const SizedBox(height: Tm.s2),
          Text(facts.join(' · '), style: TextStyle(color: tm.textMuted)),
        ],
        if (detail.description?.isNotEmpty ?? false) ...[
          const SizedBox(height: Tm.s3),
          Text(detail.description!),
        ],
        if (task.waitingOn != null) ...[
          const SizedBox(height: Tm.s3),
          _WaitingBanner(task: task, changed: changed),
        ],
        const SizedBox(height: Tm.s5),
        if (_open) ...[
          FilledButton.icon(
            onPressed: () async {
              final done = await openFocus(context, task);
              if (done) changed();
            },
            icon: const Icon(Icons.timer_outlined),
            label: const Text('Start focus'),
          ),
          const SizedBox(height: Tm.s2),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => act(TaskStatus.completed),
                  child: const Text('Complete'),
                ),
              ),
              const SizedBox(width: Tm.s2),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => act(TaskStatus.postponed),
                  child: const Text('Postpone'),
                ),
              ),
              const SizedBox(width: Tm.s2),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => act(TaskStatus.dropped),
                  child: const Text('Drop'),
                ),
              ),
            ],
          ),
          if (task.waitingOn == null)
            TextButton.icon(
              onPressed: () async {
                if (await showWaitingSheet(context, task)) changed();
              },
              icon: const Icon(Icons.hourglass_empty),
              label: const Text('Waiting on someone…'),
            ),
        ] else
          OutlinedButton(
            onPressed: () => act(TaskStatus.todo),
            child: const Text('Bring back to my list'),
          ),
        const SizedBox(height: Tm.s4),
        if (detail.steps.isNotEmpty)
          SectionCard(
            title: 'Steps',
            child: Column(
              children: [
                for (final step in detail.steps)
                  Row(
                    children: [
                      step.status == TaskStatus.completed
                          ? Padding(
                              padding: const EdgeInsets.all(11),
                              child: Icon(
                                Icons.check_circle,
                                color: tm.success,
                                size: 26,
                              ),
                            )
                          : CompleteCircle(
                              title: step.title,
                              onDone: () async {
                                final ok = await runAction(
                                  context,
                                  () => api.setStatus(
                                    step.id,
                                    TaskStatus.completed,
                                  ),
                                );
                                if (ok) changed();
                              },
                            ),
                      Expanded(
                        child: Text(
                          step.title,
                          style: TextStyle(
                            decoration: step.status == TaskStatus.completed
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          )
        else if (detail.canBreakDown && detail.suggestedSteps.isNotEmpty)
          _Breakdown(
            taskId: task.id,
            suggested: detail.suggestedSteps,
            saved: changed,
          ),
        const SizedBox(height: Tm.s4),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () async {
                  if (await showEditTask(context, detail)) changed();
                },
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Edit'),
              ),
            ),
            const SizedBox(width: Tm.s2),
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(foregroundColor: tm.danger),
                onPressed: remove,
                icon: const Icon(Icons.delete_outline),
                label: const Text('Delete'),
              ),
            ),
          ],
        ),
        if (detail.history.isNotEmpty) ...[
          const SizedBox(height: Tm.s5),
          Text('History', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: Tm.s2),
          for (final event in detail.history.reversed.take(8))
            Padding(
              padding: const EdgeInsets.only(bottom: Tm.s1),
              child: Text(
                '${_capitalise(event.type.replaceAll('_', ' '))} · '
                '${DateFormat('d MMM, HH:mm').format(event.at)}',
                style: TextStyle(color: tm.textMuted, fontSize: 13),
              ),
            ),
        ],
      ],
    );
  }

  static String _statusLabel(TaskStatus status) => switch (status) {
    TaskStatus.inbox => 'IN YOUR INBOX',
    TaskStatus.todo => 'TO DO',
    TaskStatus.inProgress => 'IN PROGRESS',
    TaskStatus.completed => 'COMPLETED',
    TaskStatus.postponed => 'POSTPONED',
    TaskStatus.dropped => 'DROPPED',
  };
}

String _capitalise(String s) =>
    s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Tm.s2, vertical: 2),
      decoration: BoxDecoration(
        color: tm.sunken,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: tm.textMuted),
          const SizedBox(width: Tm.s1),
          Text(label, style: TextStyle(color: tm.textMuted, fontSize: 12)),
        ],
      ),
    );
  }
}

/// Task Breakdown: suggested steps the user edits, removes or adds to
/// before saving — nothing is created until they do.
class _Breakdown extends StatefulWidget {
  const _Breakdown({
    required this.taskId,
    required this.suggested,
    required this.saved,
  });
  final String taskId;
  final List<String> suggested;
  final VoidCallback saved;

  @override
  State<_Breakdown> createState() => _BreakdownState();
}

class _BreakdownState extends State<_Breakdown> {
  late final List<TextEditingController> _steps = [
    for (final s in widget.suggested) TextEditingController(text: s),
  ];
  bool _busy = false;

  @override
  void dispose() {
    for (final c in _steps) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final steps = [
      for (final c in _steps)
        if (c.text.trim().isNotEmpty) c.text.trim(),
    ];
    if (steps.isEmpty) return;
    setState(() => _busy = true);
    final api = SessionScope.read(context).api;
    final ok = await runAction(
      context,
      () => api.breakDown(widget.taskId, steps),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) widget.saved();
  }

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Break it down',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Big or vague tasks are easier as small steps. Edit these, then save.',
            style: TextStyle(color: context.tm.textMuted),
          ),
          const SizedBox(height: Tm.s2),
          for (final (i, step) in _steps.indexed)
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: step,
                    decoration: InputDecoration(
                      isDense: true,
                      labelText: 'Step ${i + 1}',
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Remove step ${i + 1}',
                  onPressed: () => setState(() => _steps.removeAt(i).dispose()),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () =>
                  setState(() => _steps.add(TextEditingController())),
              icon: const Icon(Icons.add),
              label: const Text('Add a step'),
            ),
          ),
          FilledButton(
            onPressed: _busy || _steps.isEmpty ? null : _save,
            child: Text(_busy ? 'Saving…' : 'Save steps'),
          ),
        ],
      ),
    );
  }
}

/// The edit sheet; true when saved.
Future<bool> showEditTask(BuildContext context, TaskDetail detail) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _EditTaskSheet(detail: detail),
  );
  return saved == true;
}

class _EditTaskSheet extends StatefulWidget {
  const _EditTaskSheet({required this.detail});
  final TaskDetail detail;

  @override
  State<_EditTaskSheet> createState() => _EditTaskSheetState();
}

class _EditTaskSheetState extends State<_EditTaskSheet> {
  late final _title = TextEditingController(text: widget.detail.task.title);
  late final _description = TextEditingController(
    text: widget.detail.description ?? '',
  );
  late final _minutes = TextEditingController(
    text: widget.detail.task.estimatedMinutes?.toString() ?? '',
  );
  late final _project = TextEditingController(
    text: widget.detail.task.project?.name ?? '',
  );
  late final _goal = TextEditingController(
    text: widget.detail.goal?.title ?? '',
  );
  late DateTime? _due = widget.detail.task.dueAt;
  late int? _priority = widget.detail.task.priority;
  late String? _energy = widget.detail.energy;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_title, _description, _minutes, _project, _goal]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDue() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _due ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 5),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(
        _due ?? DateTime(now.year, now.month, now.day, 17),
      ),
    );
    if (!mounted) return;
    setState(() {
      _due = DateTime(
        date.year,
        date.month,
        date.day,
        time?.hour ?? 17,
        time?.minute ?? 0,
      );
    });
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    if (title.isEmpty) return;
    final minutes = int.tryParse(_minutes.text.trim());
    String? orNull(TextEditingController c) =>
        c.text.trim().isEmpty ? null : c.text.trim();
    setState(() => _busy = true);
    final api = SessionScope.read(context).api;
    final ok = await runAction(
      context,
      () => api.updateTask(widget.detail.task.id, {
        'title': title,
        'description': orNull(_description),
        'dueAt': _due?.toUtc().toIso8601String(),
        'estimatedMinutes': minutes != null && minutes > 0 ? minutes : null,
        'priority': _priority,
        'energy': _energy,
        'project': orNull(_project),
        'goal': orNull(_goal),
      }),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
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
                padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s4),
                children: [
                  Text(
                    'Edit task',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: Tm.s3),
                  TextField(
                    controller: _title,
                    decoration: const InputDecoration(labelText: 'Title'),
                  ),
                  const SizedBox(height: Tm.s3),
                  TextField(
                    controller: _description,
                    minLines: 2,
                    maxLines: 5,
                    decoration: const InputDecoration(labelText: 'Notes'),
                  ),
                  const SizedBox(height: Tm.s3),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _pickDue,
                          icon: const Icon(Icons.event_outlined),
                          label: Text(
                            _due == null
                                ? 'Add a due date'
                                : DateFormat('EEE d MMM, HH:mm').format(_due!),
                          ),
                        ),
                      ),
                      if (_due != null)
                        IconButton(
                          tooltip: 'Clear due date',
                          onPressed: () => setState(() => _due = null),
                          icon: const Icon(Icons.close),
                        ),
                    ],
                  ),
                  const SizedBox(height: Tm.s3),
                  TextField(
                    controller: _minutes,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Estimate (minutes)',
                    ),
                  ),
                  const SizedBox(height: Tm.s4),
                  Text('Your priority', style: TextStyle(color: tm.textMuted)),
                  const SizedBox(height: Tm.s1),
                  SegmentedButton<int?>(
                    showSelectedIcon: false,
                    segments: const [
                      ButtonSegment(value: null, label: Text('—')),
                      ButtonSegment(value: 1, label: Text('1')),
                      ButtonSegment(value: 2, label: Text('2')),
                      ButtonSegment(value: 3, label: Text('3')),
                      ButtonSegment(value: 4, label: Text('4')),
                      ButtonSegment(value: 5, label: Text('5')),
                    ],
                    selected: {_priority},
                    onSelectionChanged: (s) =>
                        setState(() => _priority = s.first),
                  ),
                  const SizedBox(height: Tm.s4),
                  Text(
                    'Energy it needs',
                    style: TextStyle(color: tm.textMuted),
                  ),
                  const SizedBox(height: Tm.s1),
                  SegmentedButton<String?>(
                    showSelectedIcon: false,
                    segments: const [
                      ButtonSegment(value: null, label: Text('—')),
                      ButtonSegment(value: 'low', label: Text('Low')),
                      ButtonSegment(value: 'medium', label: Text('Medium')),
                      ButtonSegment(value: 'high', label: Text('High')),
                    ],
                    selected: {_energy},
                    onSelectionChanged: (s) =>
                        setState(() => _energy = s.first),
                  ),
                  const SizedBox(height: Tm.s4),
                  _NameField(
                    controller: _project,
                    label: 'Project',
                    options: widget.detail.projectNames,
                  ),
                  const SizedBox(height: Tm.s3),
                  _NameField(
                    controller: _goal,
                    label: 'Goal',
                    options: widget.detail.goalTitles,
                  ),
                ],
              ),
            ),
            // Pinned below the fields, so it's always in reach.
            Padding(
              padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, Tm.s4),
              child: FilledButton(
                onPressed: _busy ? null : _save,
                child: Text(_busy ? 'Saving…' : 'Save changes'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A free-text name with suggestions from existing ones; a new name
/// creates the project or goal on save.
class _NameField extends StatelessWidget {
  const _NameField({
    required this.controller,
    required this.label,
    required this.options,
  });
  final TextEditingController controller;
  final String label;
  final List<String> options;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          controller: controller,
          decoration: InputDecoration(
            labelText: label,
            helperText: 'Pick one below or type a new name',
          ),
        ),
        if (options.isNotEmpty)
          Wrap(
            spacing: Tm.s2,
            children: [
              for (final name in options.take(8))
                ActionChip(
                  label: Text(name),
                  onPressed: () => controller.text = name,
                ),
            ],
          ),
      ],
    );
  }
}

/// Waiting On: who owns the next step, and when to chase.
class _WaitingBanner extends StatelessWidget {
  const _WaitingBanner({required this.task, required this.changed});
  final Task task;
  final VoidCallback changed;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final api = SessionScope.read(context).api;
    final followUp = task.followUpAt;
    final due = followUp != null && !followUp.isAfter(DateTime.now());
    return Container(
      padding: const EdgeInsets.all(Tm.s3),
      decoration: BoxDecoration(
        color: tm.aiBg,
        borderRadius: BorderRadius.circular(Tm.radiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.hourglass_empty, size: 18, color: tm.aiText),
              const SizedBox(width: Tm.s2),
              Expanded(
                child: Text(
                  'Waiting on ${task.waitingOn}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          if (followUp != null)
            Text(
              due
                  ? 'Time to follow up.'
                  : 'Out of your plan until ${DateFormat('EEE d MMM').format(followUp)}.',
              style: TextStyle(color: tm.textMuted),
            ),
          Wrap(
            spacing: Tm.s1,
            children: [
              TextButton(
                onPressed: () async {
                  final ok = await runAction(
                    context,
                    () => api.updateTask(task.id, {'waitingOn': null}),
                  );
                  if (ok) changed();
                },
                child: const Text('It’s arrived'),
              ),
              TextButton(
                onPressed: () async {
                  if (await showWaitingSheet(context, task)) changed();
                },
                child: const Text('Change'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Mark a task as waiting on someone; true when saved.
Future<bool> showWaitingSheet(BuildContext context, Task task) async {
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _WaitingSheet(task: task),
  );
  return saved == true;
}

class _WaitingSheet extends StatefulWidget {
  const _WaitingSheet({required this.task});
  final Task task;

  @override
  State<_WaitingSheet> createState() => _WaitingSheetState();
}

class _WaitingSheetState extends State<_WaitingSheet> {
  late final _who = TextEditingController(text: widget.task.waitingOn ?? '');
  int _days = 3;
  bool _busy = false;

  @override
  void dispose() {
    _who.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final who = _who.text.trim();
    if (who.isEmpty) return;
    setState(() => _busy = true);
    final api = SessionScope.read(context).api;
    final followUp = DateTime.now().add(Duration(days: _days));
    final ok = await runAction(
      context,
      () => api.updateTask(widget.task.id, {
        'waitingOn': who,
        'followUpAt': DateTime(
          followUp.year,
          followUp.month,
          followUp.day,
          9,
        ).toUtc().toIso8601String(),
      }),
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
          Text(
            'Waiting on someone',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: Tm.s1),
          Text(
            'It leaves your plan until it’s time to follow up.',
            style: TextStyle(color: context.tm.textMuted),
          ),
          const SizedBox(height: Tm.s3),
          TextField(
            controller: _who,
            autofocus: true,
            decoration: const InputDecoration(
              labelText: 'Who or what',
              hintText: 'Sam’s sign-off',
            ),
          ),
          const SizedBox(height: Tm.s3),
          const Text('Follow up in'),
          const SizedBox(height: Tm.s1),
          SegmentedButton<int>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: 1, label: Text('1 day')),
              ButtonSegment(value: 3, label: Text('3 days')),
              ButtonSegment(value: 7, label: Text('A week')),
            ],
            selected: {_days},
            onSelectionChanged: (s) => setState(() => _days = s.first),
          ),
          const SizedBox(height: Tm.s4),
          FilledButton(
            onPressed: _busy ? null : _save,
            child: Text(_busy ? 'Saving…' : 'Mark as waiting'),
          ),
        ],
      ),
    );
  }
}
