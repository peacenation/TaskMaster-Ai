import 'package:flutter/material.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'widgets.dart';

/// "03. Projects — track progress": GET /api/v1/projects.
class ProjectsScreen extends StatelessWidget {
  const ProjectsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Loader<List<ProjectProgress>>(
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
            const SectionCard(
              title: 'No projects yet',
              child: Text(
                'Projects appear when you group tasks — from a Brain Dump or '
                'when you edit a task on the website.',
              ),
            ),
          for (final (i, project) in projects.indexed) ...[
            _ProjectCard(project: project, sage: i.isOdd),
            const SizedBox(height: Tm.s3),
          ],
        ],
      ),
    );
  }
}

class _ProjectCard extends StatelessWidget {
  const _ProjectCard({required this.project, required this.sage});
  final ProjectProgress project;
  final bool sage;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final percent = (project.fraction * 100).round();
    return Card(
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
    );
  }
}
