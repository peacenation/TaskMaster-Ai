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
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _add() async {
    if (await showQuickAdd(context) && mounted) {
      setState(() {
        _view = TaskView.inbox;
        _generation++;
      });
    }
  }

  bool _matches(Task task) {
    final query = _search.text.trim().toLowerCase();
    if (query.isEmpty) return true;
    return task.title.toLowerCase().contains(query) ||
        (task.project?.name.toLowerCase().contains(query) ?? false);
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
          padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s3, Tm.s4, 0),
          child: TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Search tasks and projects',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      tooltip: 'Clear search',
                      icon: const Icon(Icons.close),
                      onPressed: () => setState(_search.clear),
                    ),
            ),
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
            builder: (context, all, reload) {
              final tasks = all.where(_matches).toList();
              Future<void> act(Task task, TaskStatus status) async {
                final ok = await runAction(
                  context,
                  () => api.setStatus(task.id, status),
                );
                if (ok) await reload();
              }

              if (tasks.isEmpty) {
                return ListView(
                  children: [
                    _search.text.trim().isNotEmpty
                        ? EmptyState(
                            icon: Icons.search_off,
                            title: 'No matches',
                            message:
                                'Nothing in this view matches “${_search.text.trim()}”.',
                          )
                        : EmptyState(
                            icon: Icons.check_circle_outline,
                            title: _emptyTitle(_view),
                            message: _emptyText(_view),
                          ),
                  ],
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s4),
                itemCount: tasks.length,
                separatorBuilder: (_, _) => const SizedBox(height: Tm.s2),
                itemBuilder: (context, i) => _TaskCard(
                  task: tasks[i],
                  onDone: () => act(tasks[i], TaskStatus.completed),
                  onAction: (status) => act(tasks[i], status),
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, Tm.s4),
          child: FilledButton.icon(
            onPressed: _add,
            icon: const Icon(Icons.add),
            label: const Text('Add task'),
          ),
        ),
      ],
    );
  }

  static String _emptyTitle(TaskView view) => switch (view) {
    TaskView.today => 'Nothing due today',
    TaskView.upcoming => 'No upcoming deadlines',
    TaskView.all => 'No open tasks yet',
    TaskView.inbox => 'Inbox zero',
  };

  static String _emptyText(TaskView view) => switch (view) {
    TaskView.today => 'Enjoy the room to breathe.',
    TaskView.upcoming => 'Nothing has a deadline coming up.',
    TaskView.all => 'Add one below, or start a Brain Dump from Today.',
    TaskView.inbox => 'Everything you captured has been organised.',
  };
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({
    required this.task,
    required this.onDone,
    required this.onAction,
  });
  final Task task;
  final VoidCallback onDone;
  final void Function(TaskStatus status) onAction;

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
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            task.title,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                        _TaskMenu(task: task, onAction: onAction),
                      ],
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

/// The "…" menu: start, postpone or drop a task (same transitions as web).
class _TaskMenu extends StatelessWidget {
  const _TaskMenu({required this.task, required this.onAction});
  final Task task;
  final void Function(TaskStatus status) onAction;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 28,
      width: 36,
      child: PopupMenuButton<TaskStatus>(
        tooltip: 'More for ${task.title}',
        padding: EdgeInsets.zero,
        icon: Icon(Icons.more_horiz, color: context.tm.textMuted),
        onSelected: onAction,
        itemBuilder: (_) => [
          if (task.status != TaskStatus.inProgress)
            const PopupMenuItem(
              value: TaskStatus.inProgress,
              child: Text('Start'),
            ),
          const PopupMenuItem(
            value: TaskStatus.postponed,
            child: Text('Postpone'),
          ),
          const PopupMenuItem(value: TaskStatus.dropped, child: Text('Drop')),
        ],
      ),
    );
  }
}
