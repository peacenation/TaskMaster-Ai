import 'package:flutter/material.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'brain_dump_screen.dart';
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

  void _reload() => setState(() => _generation++);

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
    return Loader<List<ProjectProgress>>(
      key: ValueKey(_generation),
      load: api.projects,
      builder: (context, projects, _) => ListView(
        padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, Tm.s8),
        children: [
          Semantics(
            header: true,
            child: Text(
              'Projects',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
          ),
          Text(
            'Turn ideas into real progress.',
            style: TextStyle(color: context.tm.textMuted, fontSize: 16),
          ),
          const SizedBox(height: Tm.s4),
          if (projects.isEmpty)
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
          for (final (i, project) in projects.indexed) ...[
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
