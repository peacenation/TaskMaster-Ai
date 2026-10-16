import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../api/client.dart';
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
                const SizedBox(height: Tm.s4),
                _People(detail: detail, changed: reload),
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
                    assigneeOf: detail.nameOf,
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
    required this.assigneeOf,
  });
  final String title;
  final List<Task> tasks;
  final String? Function(String? userId) assigneeOf;
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
                        // Initials, not the name: a row has to fit a
                        // phone next to the badge and the date.
                        if (assigneeOf(task.assigneeId) case final who?) ...[
                          Semantics(
                            label: 'Assigned to $who',
                            excludeSemantics: true,
                            child: CircleAvatar(
                              radius: 11,
                              backgroundColor: TmColors.sage,
                              foregroundColor: Colors.white,
                              child: Text(
                                who
                                    .split(' ')
                                    .where((p) => p.isNotEmpty)
                                    .take(2)
                                    .map((p) => p[0].toUpperCase())
                                    .join(),
                                style: const TextStyle(fontSize: 10),
                              ),
                            ),
                          ),
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

/// Who's on the project. The owner invites (by email: they'll see it in
/// the app, or you can send the link) and removes people; members leave.
class _People extends StatelessWidget {
  const _People({required this.detail, required this.changed});
  final ProjectDetail detail;
  final Future<void> Function() changed;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final api = SessionScope.read(context).api;
    final projectId = detail.project.id;

    Future<void> remove(Person person) async {
      final leaving = person.isMe;
      final sure = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: Text(
            leaving
                ? 'Leave ${detail.project.name}?'
                : 'Remove ${person.name}?',
          ),
          content: Text(
            leaving
                ? 'You’ll stop seeing its tasks. Anything assigned to you goes back to unassigned.'
                : 'They’ll stop seeing its tasks. Anything assigned to them goes back to unassigned.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialog).pop(false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.of(dialog).pop(true),
              child: Text(leaving ? 'Leave' : 'Remove'),
            ),
          ],
        ),
      );
      if (sure != true || !context.mounted) return;
      final navigator = Navigator.of(context);
      if (await runAction(
        context,
        () => api.removeMember(projectId, person.id),
      )) {
        if (leaving) {
          navigator.pop(true);
        } else {
          await changed();
        }
      }
    }

    final shared = detail.people.length > 1 || detail.pendingInvites.isNotEmpty;
    if (!shared && !detail.isOwner) return const SizedBox.shrink();
    return SectionCard(
      title: 'People',
      trailing: detail.isOwner
          ? TextButton.icon(
              onPressed: () async {
                if (await showInviteSheet(context, projectId)) await changed();
              },
              icon: const Icon(Icons.person_add_alt),
              label: const Text('Invite'),
            )
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!shared)
            Text(
              'Just you so far. Invite someone to share this project and '
              'assign work to each other.',
              style: TextStyle(color: tm.textMuted),
            ),
          if (shared)
            for (final person in detail.people)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: CircleAvatar(
                  radius: 16,
                  backgroundColor: person.isOwner
                      ? TmColors.caramel
                      : TmColors.sage,
                  foregroundColor: Colors.white,
                  child: Text(
                    person.initials,
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
                title: Text(person.isMe ? '${person.name} (you)' : person.name),
                subtitle: Text(person.isOwner ? 'Owner' : 'Member'),
                trailing: !person.isOwner && (detail.isOwner || person.isMe)
                    ? TextButton(
                        onPressed: () => remove(person),
                        child: Text(person.isMe ? 'Leave' : 'Remove'),
                      )
                    : null,
              ),
          for (final invite in detail.pendingInvites)
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              leading: const Icon(Icons.mail_outline),
              title: Text(invite.email),
              subtitle: const Text('Invited'),
              trailing: TextButton(
                onPressed: () async {
                  final ok = await runAction(
                    context,
                    () => api.withdrawInvite(projectId, invite.id),
                  );
                  if (ok) await changed();
                },
                child: const Text('Withdraw'),
              ),
            ),
        ],
      ),
    );
  }
}

/// Invite someone by email; shows the link to send. True when invited.
Future<bool> showInviteSheet(BuildContext context, String projectId) async {
  final invited = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _InviteSheet(projectId: projectId),
  );
  return invited == true;
}

class _InviteSheet extends StatefulWidget {
  const _InviteSheet({required this.projectId});
  final String projectId;

  @override
  State<_InviteSheet> createState() => _InviteSheetState();
}

class _InviteSheetState extends State<_InviteSheet> {
  final _email = TextEditingController();
  bool _busy = false;
  String? _link;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _invite() async {
    final email = _email.text.trim();
    if (!email.contains('@')) {
      setState(() => _error = 'Enter their email address.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = SessionScope.read(context);
    try {
      final link = await session.api.inviteToProject(widget.projectId, email);
      if (mounted) setState(() => _link = link);
    } on ApiException catch (e) {
      await session.handle(e);
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final link = _link;
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
            'Invite someone',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: Tm.s1),
          Text(
            'They’ll see the invitation when they sign in to TaskMasterAi '
            'with this email.',
            style: TextStyle(color: tm.textMuted),
          ),
          const SizedBox(height: Tm.s3),
          if (link == null) ...[
            TextField(
              controller: _email,
              autofocus: true,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: const InputDecoration(labelText: 'Their email'),
            ),
            if (_error != null) ...[
              const SizedBox(height: Tm.s2),
              Semantics(
                liveRegion: true,
                child: Text(_error!, style: TextStyle(color: tm.danger)),
              ),
            ],
            const SizedBox(height: Tm.s4),
            FilledButton(
              onPressed: _busy ? null : _invite,
              child: Text(_busy ? 'Inviting…' : 'Send invitation'),
            ),
          ] else ...[
            Text(
              'Invited ${_email.text.trim()}. You can also send them this link:',
            ),
            const SizedBox(height: Tm.s2),
            SelectableText(link, style: TextStyle(color: tm.aiText)),
            const SizedBox(height: Tm.s3),
            OutlinedButton.icon(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: link));
                if (context.mounted) {
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(const SnackBar(content: Text('Link copied')));
                }
              },
              icon: const Icon(Icons.copy),
              label: const Text('Copy link'),
            ),
            const SizedBox(height: Tm.s2),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Done'),
            ),
          ],
        ],
      ),
    );
  }
}
