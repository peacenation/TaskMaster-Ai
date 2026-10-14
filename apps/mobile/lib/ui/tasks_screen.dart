import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'widgets.dart';

/// "02. Tasks — stay on top of work": filtered lists from GET /api/v1/tasks,
/// complete with one tap, Quick Add into the Inbox.
class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  TaskView _view = TaskView.today;
  // Bumped after Quick Add so the list reloads even if the view is unchanged.
  int _generation = 0;

  Future<void> _add() async {
    final title = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _QuickAddSheet(),
    );
    if (title == null || !mounted) return;
    final api = SessionScope.read(context).api;
    final ok = await runAction(context, () => api.quickAdd(title));
    if (ok && mounted) {
      setState(() {
        _view = TaskView.inbox;
        _generation++;
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Added to your Inbox')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, 0),
          child: Row(
            children: [
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(
                    'My Tasks',
                    style: Theme.of(context).textTheme.headlineLarge,
                  ),
                ),
              ),
              IconButton.filled(
                tooltip: 'Add task',
                onPressed: _add,
                icon: const Icon(Icons.add),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(Tm.s4),
          child: SegmentedButton<TaskView>(
            showSelectedIcon: false,
            segments: const [
              ButtonSegment(value: TaskView.today, label: Text('Today')),
              ButtonSegment(value: TaskView.upcoming, label: Text('Upcoming')),
              ButtonSegment(value: TaskView.all, label: Text('All')),
              ButtonSegment(value: TaskView.inbox, label: Text('Inbox')),
            ],
            selected: {_view},
            onSelectionChanged: (s) => setState(() => _view = s.first),
          ),
        ),
        Expanded(
          child: Loader<List<Task>>(
            key: ValueKey((_view, _generation)),
            load: () => api.tasks(_view),
            builder: (context, tasks, reload) => tasks.isEmpty
                ? ListView(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(Tm.s8),
                        child: Text(
                          _emptyText(_view),
                          textAlign: TextAlign.center,
                          style: TextStyle(color: context.tm.textMuted),
                        ),
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s8),
                    itemCount: tasks.length,
                    separatorBuilder: (_, _) => const SizedBox(height: Tm.s2),
                    itemBuilder: (context, i) => _TaskCard(
                      task: tasks[i],
                      onDone: () async {
                        final ok = await runAction(
                          context,
                          () =>
                              api.setStatus(tasks[i].id, TaskStatus.completed),
                        );
                        if (ok) await reload();
                      },
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  static String _emptyText(TaskView view) => switch (view) {
    TaskView.today => 'Nothing due today. Enjoy the room to breathe.',
    TaskView.upcoming => 'No upcoming deadlines.',
    TaskView.all => 'No open tasks yet. Add one with +.',
    TaskView.inbox => 'Your Inbox is empty.',
  };
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({required this.task, required this.onDone});
  final Task task;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final due = task.dueAt;
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Tm.s1, Tm.s3, Tm.s4, Tm.s3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CompleteCircle(title: task.title, onDone: onDone),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: Tm.s2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    if (task.project != null)
                      Text(
                        task.project!.name,
                        style: TextStyle(color: tm.textMuted),
                      ),
                    const SizedBox(height: Tm.s2),
                    Row(
                      children: [
                        if (task.priority != null)
                          PriorityBadge(task.priority!),
                        const SizedBox(width: Tm.s2),
                        // Long labels ("Mon 12 Oct, 11:00") shrink rather
                        // than overflow next to the badge on narrow phones.
                        if (due != null)
                          Expanded(
                            child: Text(
                              _dueLabel(due),
                              textAlign: TextAlign.end,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: tm.textMuted,
                                fontSize: 13,
                              ),
                            ),
                          )
                        else
                          const Spacer(),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _dueLabel(DateTime due) {
    final now = DateTime.now();
    final sameDay =
        due.year == now.year && due.month == now.month && due.day == now.day;
    return sameDay
        ? DateFormat.Hm().format(due)
        : DateFormat('EEE d MMM, HH:mm').format(due);
  }
}

class _QuickAddSheet extends StatefulWidget {
  const _QuickAddSheet();

  @override
  State<_QuickAddSheet> createState() => _QuickAddSheetState();
}

class _QuickAddSheetState extends State<_QuickAddSheet> {
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _submit() {
    final title = _text.text.trim();
    if (title.isNotEmpty) Navigator.of(context).pop(title);
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
          Text('Quick Add', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: Tm.s3),
          TextField(
            controller: _text,
            autofocus: true,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => _submit(),
            decoration: const InputDecoration(
              labelText: 'Task',
              hintText: 'Send Sarah the figures',
            ),
          ),
          const SizedBox(height: Tm.s2),
          Text(
            'Lands in your Inbox to organise later.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: Tm.s4),
          FilledButton.icon(
            onPressed: _submit,
            icon: const Icon(Icons.add),
            label: const Text('Add task'),
          ),
        ],
      ),
    );
  }
}
