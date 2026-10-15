import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'task_screen.dart';
import 'widgets.dart';

/// "03. Project — track progress together": one project's progress and its
/// tasks grouped by status (GET /api/v1/projects/{id}), with Add task.
class ProjectScreen extends StatefulWidget {
  const ProjectScreen({super.key, required this.id, required this.name});
  final String id;
  final String name;

  @override
  State<ProjectScreen> createState() => _ProjectScreenState();
}

class _ProjectScreenState extends State<ProjectScreen> {
  int _generation = 0;

  Future<void> _add() async {
    final added = await showQuickAdd(
      context,
      projectId: widget.id,
      projectName: widget.name,
    );
    if (added && mounted) setState(() => _generation++);
  }

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: Loader<ProjectDetail>(
          key: ValueKey(_generation),
          load: () => api.project(widget.id),
          builder: (context, detail, reload) {
            Future<void> complete(Task task) async {
              final ok = await runAction(
                context,
                () => api.setStatus(task.id, TaskStatus.completed),
              );
              if (ok) await reload();
            }

            final open =
                detail.inProgress.length +
                detail.todo.length +
                detail.postponed.length;
            return ListView(
              padding: const EdgeInsets.fromLTRB(Tm.s4, 0, Tm.s4, Tm.s8),
              children: [
                _Header(project: detail.project),
                const SizedBox(height: Tm.s5),
                if (open == 0)
                  EmptyState(
                    icon: Icons.task_alt,
                    title: detail.project.total == 0
                        ? 'No tasks yet'
                        : 'All done here',
                    message: detail.project.total == 0
                        ? 'Add the first task for ${detail.project.name}.'
                        : 'Every task in ${detail.project.name} is complete.',
                  ),
                for (final (title, tasks) in [
                  ('In progress', detail.inProgress),
                  ('To do', detail.todo),
                  ('Postponed', detail.postponed),
                ])
                  _Group(
                    title: title,
                    tasks: tasks,
                    onDone: complete,
                    onOpen: (task) async {
                      if (await openTask(context, task.id)) await reload();
                    },
                  ),
                const SizedBox(height: Tm.s3),
                FilledButton.icon(
                  onPressed: _add,
                  icon: const Icon(Icons.add),
                  label: const Text('Add task'),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.project});
  final ProjectProgress project;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final percent = (project.fraction * 100).round();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            const IconTile(Icons.folder_outlined),
            const SizedBox(width: Tm.s4),
            Expanded(
              child: Semantics(
                header: true,
                child: Text(
                  project.name,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
              ),
            ),
            Text(
              '$percent%',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        const SizedBox(height: Tm.s3),
        Semantics(
          label: '$percent percent complete',
          excludeSemantics: true,
          child: ProgressBar(project.fraction),
        ),
        const SizedBox(height: Tm.s2),
        Text(
          '${project.done} of ${project.total} tasks complete',
          style: TextStyle(color: tm.textMuted),
        ),
      ],
    );
  }
}

class _Group extends StatelessWidget {
  const _Group({
    required this.title,
    required this.tasks,
    required this.onDone,
    required this.onOpen,
  });
  final String title;
  final List<Task> tasks;
  final Future<void> Function(Task task) onDone;
  final Future<void> Function(Task task) onOpen;

  @override
  Widget build(BuildContext context) {
    if (tasks.isEmpty) return const SizedBox.shrink();
    final tm = context.tm;
    return Padding(
      padding: const EdgeInsets.only(bottom: Tm.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Semantics(
                header: true,
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              const SizedBox(width: Tm.s2),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: Tm.s2,
                  vertical: 1,
                ),
                decoration: BoxDecoration(
                  color: tm.sunken,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${tasks.length}',
                  style: TextStyle(color: tm.textMuted, fontSize: 12),
                ),
              ),
            ],
          ),
          const SizedBox(height: Tm.s2),
          for (final task in tasks)
            Padding(
              padding: const EdgeInsets.only(bottom: Tm.s2),
              child: Card(
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => onOpen(task),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      Tm.s1,
                      Tm.s2,
                      Tm.s4,
                      Tm.s2,
                    ),
                    child: Row(
                      children: [
                        CompleteCircle(
                          title: task.title,
                          onDone: () => onDone(task),
                        ),
                        Expanded(
                          child: Text(
                            task.title,
                            style: const TextStyle(fontWeight: FontWeight.w500),
                          ),
                        ),
                        if (task.priority != null) ...[
                          PriorityBadge(task.priority!),
                          const SizedBox(width: Tm.s2),
                        ],
                        if (task.dueAt != null)
                          Text(
                            DateFormat('d MMM').format(task.dueAt!),
                            style: TextStyle(color: tm.textMuted, fontSize: 13),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
