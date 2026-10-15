import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'task_screen.dart';
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
              final organise = _view == TaskView.inbox;
              return ListView.separated(
                padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s4),
                itemCount: tasks.length + (organise ? 1 : 0),
                separatorBuilder: (_, _) => const SizedBox(height: Tm.s2),
                itemBuilder: (context, i) {
                  if (organise && i == 0) {
                    return FilledButton.tonalIcon(
                      onPressed: () async {
                        if (await showOrganiseInbox(context, all)) {
                          await reload();
                        }
                      },
                      icon: const Icon(Icons.drive_file_move_outline),
                      label: const Text('Organise Inbox'),
                    );
                  }
                  final task = tasks[i - (organise ? 1 : 0)];
                  return _TaskCard(
                    task: task,
                    onOpen: () async {
                      if (await openTask(context, task.id)) await reload();
                    },
                    onDone: () => act(task, TaskStatus.completed),
                    onAction: (status) => act(task, status),
                  );
                },
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
    required this.onOpen,
    required this.onDone,
    required this.onAction,
  });
  final Task task;
  final VoidCallback onOpen;
  final VoidCallback onDone;
  final void Function(TaskStatus status) onAction;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final due = task.dueAt;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
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

/// Inbox triage: choose captured items and move them onto your list,
/// optionally into a project. True when something moved.
Future<bool> showOrganiseInbox(BuildContext context, List<Task> inbox) async {
  final moved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _OrganiseSheet(inbox: inbox),
  );
  return moved == true;
}

class _OrganiseSheet extends StatefulWidget {
  const _OrganiseSheet({required this.inbox});
  final List<Task> inbox;

  @override
  State<_OrganiseSheet> createState() => _OrganiseSheetState();
}

class _OrganiseSheetState extends State<_OrganiseSheet> {
  late final Set<String> _selected = {for (final t in widget.inbox) t.id};
  final _project = TextEditingController();
  late final Future<List<ProjectProgress>> _projects = SessionScope.read(
    context,
  ).api.projects();
  bool _busy = false;

  @override
  void dispose() {
    _project.dispose();
    super.dispose();
  }

  Future<void> _move() async {
    final project = _project.text.trim();
    setState(() => _busy = true);
    final api = SessionScope.read(context).api;
    final messenger = ScaffoldMessenger.of(context);
    var moved = 0;
    final ok = await runAction(context, () async {
      moved = await api.organiseInbox(
        _selected.toList(),
        project: project.isEmpty ? null : project,
      );
    });
    if (!mounted) return;
    setState(() => _busy = false);
    if (!ok) return;
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          '$moved item${moved == 1 ? '' : 's'} moved'
          '${project.isEmpty ? ' to your list' : ' to $project'}',
        ),
      ),
    );
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final count = _selected.length;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s4),
          children: [
            Text(
              'Organise Inbox',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: Tm.s2),
            for (final task in widget.inbox)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: _selected.contains(task.id),
                title: Text(task.title),
                onChanged: (on) => setState(
                  () => on == true
                      ? _selected.add(task.id)
                      : _selected.remove(task.id),
                ),
              ),
            const SizedBox(height: Tm.s2),
            TextField(
              controller: _project,
              decoration: const InputDecoration(
                labelText: 'Project (optional)',
                helperText: 'Pick one below or type a new name',
              ),
            ),
            FutureBuilder<List<ProjectProgress>>(
              future: _projects,
              builder: (context, snapshot) => Wrap(
                spacing: Tm.s2,
                children: [
                  for (final p in (snapshot.data ?? const []).take(8))
                    ActionChip(
                      label: Text(p.name),
                      onPressed: () => _project.text = p.name,
                    ),
                ],
              ),
            ),
            const SizedBox(height: Tm.s4),
            FilledButton(
              onPressed: _busy || count == 0 ? null : _move,
              child: Text(
                _busy
                    ? 'Moving…'
                    : 'Move $count item${count == 1 ? '' : 's'} to my list',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
