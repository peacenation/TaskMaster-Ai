import 'package:flutter/material.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'brain_dump_screen.dart';
import 'goals_screen.dart';
import 'project_screen.dart';
import 'widgets.dart';

/// "03. Projects — track progress": GET /api/v1/projects; tap one for its
/// detail screen.
class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});

  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  int _generation = 0;
  bool _goals = false;

  /// Title plus the Projects / Goals switch, shared by both views.
  Widget _header() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Semantics(
        header: true,
        child: Text(
          _goals ? 'Goals' : 'Projects',
          style: Theme.of(context).textTheme.headlineLarge,
        ),
      ),
      const SizedBox(height: Tm.s3),
      SegmentedButton<bool>(
        showSelectedIcon: false,
        segments: const [
          ButtonSegment(value: false, label: Text('Projects')),
          ButtonSegment(value: true, label: Text('Goals')),
        ],
        selected: {_goals},
        onSelectionChanged: (s) => setState(() => _goals = s.first),
      ),
      const SizedBox(height: Tm.s3),
    ],
  );

  void _reload() => setState(() => _generation++);

  /// After joining, open the project; after declining, just refresh.
  Future<void> _answered(String? projectId, String name) async {
    _reload();
    if (projectId != null && mounted) {
      await _open(
        ProjectProgress(id: projectId, name: name, done: 0, total: 0),
      );
    }
  }

  Future<void> _open(ProjectProgress project) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ProjectScreen(id: project.id, name: project.name),
      ),
    );
    if (mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    if (_goals) return GoalsView(header: _header());
    return Loader<(List<ProjectProgress>, List<Invitation>)>(
      key: ValueKey(_generation),
      load: () async => (await api.projects(), await api.invites()),
      builder: (context, data, _) => ListView(
        padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, Tm.s8),
        children: [
          _header(),
          Text(
            'Turn ideas into real progress.',
            style: TextStyle(color: context.tm.textMuted, fontSize: 16),
          ),
          const SizedBox(height: Tm.s4),
          for (final invite in data.$2) ...[
            _InvitationCard(invite: invite, answered: _answered),
            const SizedBox(height: Tm.s3),
          ],
          if (data.$1.isEmpty)
            EmptyState(
              icon: Icons.folder_open_outlined,
              title: 'No projects yet',
              message:
                  'Projects appear when you group tasks. A Brain Dump suggests '
                  'them for you.',
              action: FilledButton.icon(
                onPressed: () async {
                  if (await openBrainDump(context)) _reload();
                },
                icon: const Icon(Icons.auto_awesome),
                label: const Text('Start a Brain Dump'),
              ),
            ),
          for (final (i, project) in data.$1.indexed) ...[
            _ProjectCard(
              project: project,
              sage: i.isOdd,
              onTap: () => _open(project),
            ),
            const SizedBox(height: Tm.s3),
          ],
        ],
      ),
    );
  }
}

class _ProjectCard extends StatelessWidget {
  const _ProjectCard({
    required this.project,
    required this.sage,
    required this.onTap,
  });
  final ProjectProgress project;
  final bool sage;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final percent = (project.fraction * 100).round();
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(Tm.s4),
          child: Row(
            children: [
              IconTile(
                Icons.folder_outlined,
                tone: sage ? TileTone.sage : TileTone.caramel,
              ),
              const SizedBox(width: Tm.s4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            project.name,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        if (project.shared) ...[
                          Icon(
                            Icons.group_outlined,
                            size: 16,
                            color: tm.textMuted,
                          ),
                          const SizedBox(width: Tm.s2),
                        ],
                        Text(
                          '$percent%',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                    Text(
                      '${project.done} of ${project.total} tasks complete',
                      style: TextStyle(color: tm.textMuted, fontSize: 13),
                    ),
                    const SizedBox(height: Tm.s2),
                    Semantics(
                      label: '$percent percent complete',
                      excludeSemantics: true,
                      child: ProgressBar(
                        project.fraction,
                        color: sage ? TmColors.sage : TmColors.caramel,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// "Olu invited you to Launch": join or decline.
class _InvitationCard extends StatefulWidget {
  const _InvitationCard({required this.invite, required this.answered});
  final Invitation invite;
  final Future<void> Function(String? projectId, String name) answered;

  @override
  State<_InvitationCard> createState() => _InvitationCardState();
}

class _InvitationCardState extends State<_InvitationCard> {
  bool _busy = false;

  Future<void> _answer(bool accept) async {
    setState(() => _busy = true);
    final api = SessionScope.read(context).api;
    String? projectId;
    final ok = await runAction(context, () async {
      projectId = await api.answerInvite(widget.invite.id, accept: accept);
    });
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) await widget.answered(projectId, widget.invite.projectName);
  }

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final invite = widget.invite;
    return Card(
      color: tm.aiBg,
      child: Padding(
        padding: const EdgeInsets.all(Tm.s4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'SHARED WITH YOU',
              style: TextStyle(
                fontSize: 11,
                letterSpacing: 0.5,
                fontWeight: FontWeight.w700,
                color: tm.aiText,
              ),
            ),
            const SizedBox(height: Tm.s1),
            Text(
              '${invite.inviterName.isEmpty ? 'Someone' : invite.inviterName} '
              'invited you to ${invite.projectName}',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: Tm.s3),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ? null : () => _answer(true),
                    child: const Text('Join'),
                  ),
                ),
                const SizedBox(width: Tm.s2),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _answer(false),
                    child: const Text('Decline'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
