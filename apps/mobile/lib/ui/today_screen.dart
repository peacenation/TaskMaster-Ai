import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'widgets.dart';

/// "01. Today — your day at a glance": the same plan as the web's Today
/// (GET /api/v1/today), sized for a phone.
class TodayScreen extends StatelessWidget {
  const TodayScreen({super.key, this.now});

  /// Injected in tests; defaults to the device clock.
  final DateTime Function()? now;

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Loader<Today>(
      load: api.today,
      builder: (context, today, reload) => ListView(
        padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, Tm.s8),
        children: [
          const _Header(),
          const SizedBox(height: Tm.s4),
          if (!today.onboarded)
            const _NotOnboarded()
          else ...[
            Text(
              today.firstName.isEmpty
                  ? today.greeting
                  : '${today.greeting}, ${today.firstName}',
              style: Theme.of(context).textTheme.headlineLarge,
            ),
            const SizedBox(height: Tm.s1),
            Text(
              DateFormat('EEEE, d MMMM').format((now ?? DateTime.now)()),
              style: TextStyle(color: context.tm.textMuted, fontSize: 16),
            ),
            const SizedBox(height: Tm.s4),
            if (today.attentionCount > 0) ...[
              _AttentionBanner(count: today.attentionCount),
              const SizedBox(height: Tm.s3),
            ],
            _NextBestAction(today: today, reload: reload),
            const SizedBox(height: Tm.s3),
            _Stats(stats: today.stats!),
            const SizedBox(height: Tm.s3),
            _Priorities(today: today, reload: reload),
            if (_nextBlock(today, (now ?? DateTime.now)())
                case final block?) ...[
              const SizedBox(height: Tm.s3),
              _NextBlock(item: block),
            ],
          ],
        ],
      ),
    );
  }

  static PlanItem? _nextBlock(Today today, DateTime now) {
    for (final item in today.plan) {
      final start = item.scheduledStart;
      if (start != null && start.isAfter(now)) return item;
    }
    return null;
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) =>
      const Row(children: [BrandWordmark(), Spacer(), AccountAvatar()]);
}

class _NotOnboarded extends StatelessWidget {
  const _NotOnboarded();

  @override
  Widget build(BuildContext context) => const SectionCard(
    title: 'Start with a Brain Dump',
    child: Text(
      'Your plan builds from everything on your mind. Do your first Brain '
      'Dump on the TaskMasterAi website, then pull down here to refresh. '
      'Brain Dump on your phone is coming next.',
    ),
  );
}

class _AttentionBanner extends StatelessWidget {
  const _AttentionBanner({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Container(
      padding: const EdgeInsets.all(Tm.s3),
      decoration: BoxDecoration(
        color: tm.dangerSubtle,
        borderRadius: BorderRadius.circular(Tm.radiusMd),
        border: Border(left: BorderSide(color: tm.danger, width: 4)),
      ),
      child: Text(
        count == 1
            ? 'Your day changed — 1 decision is waiting on the website.'
            : 'Your day changed — $count decisions are waiting on the website.',
      ),
    );
  }
}

/// The AI suggestion stays visually distinct from a confirmed choice
/// (PRD §2.8): caramel gradient while suggested, sage once it's yours.
class _NextBestAction extends StatelessWidget {
  const _NextBestAction({required this.today, required this.reload});
  final Today today;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final rec = today.recommendation;
    final confirmed = rec?.overridden ?? false;
    final api = SessionScope.read(context).api;

    Future<void> act(TaskStatus status) async {
      if (rec == null) return;
      if (await runAction(context, () => api.setStatus(rec.task.id, status))) {
        await reload();
      }
    }

    return Container(
      decoration: BoxDecoration(
        gradient: confirmed ? null : LinearGradient(colors: tm.heroGradient),
        color: confirmed ? tm.calmSubtle : null,
        borderRadius: BorderRadius.circular(Tm.radiusLg),
        border: Border.all(color: confirmed ? tm.success : tm.aiBadge),
      ),
      padding: const EdgeInsets.all(Tm.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: tm.card,
                child: Icon(
                  Icons.auto_awesome,
                  color: confirmed ? tm.success : tm.aiText,
                ),
              ),
              const SizedBox(width: Tm.s3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Semantics(
                      header: true,
                      child: Text(
                        'What to do next',
                        style: TextStyle(
                          color: tm.textMuted,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 2),
                    _Kicker(confirmed: confirmed),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: Tm.s3),
          Text(
            rec?.task.title ?? 'Nothing active yet',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: Tm.s1),
          Text(
            rec?.message ??
                'Capture new work or organise your Inbox to get started.',
          ),
          if (rec != null) ...[
            const SizedBox(height: Tm.s4),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
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
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Kicker extends StatelessWidget {
  const _Kicker({required this.confirmed});
  final bool confirmed;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Tm.s2, vertical: 2),
      decoration: BoxDecoration(
        color: confirmed ? tm.card : tm.aiBadge,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        confirmed ? 'YOUR CHOICE' : 'NEXT BEST ACTION',
        style: TextStyle(
          fontSize: 11,
          letterSpacing: 0.5,
          fontWeight: FontWeight.w700,
          color: confirmed ? tm.success : tm.aiText,
        ),
      ),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.stats});
  final TodayStats stats;

  @override
  Widget build(BuildContext context) {
    Widget tile(String label, int value, IconData icon, TileTone tone) =>
        Expanded(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(Tm.s3),
              child: Row(
                children: [
                  IconTile(icon, tone: tone),
                  const SizedBox(width: Tm.s3),
                  Flexible(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$value',
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          label,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: context.tm.textMuted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
    return Column(
      children: [
        Row(
          children: [
            tile(
              'Due today',
              stats.dueToday,
              Icons.event_outlined,
              TileTone.caramel,
            ),
            const SizedBox(width: Tm.s3),
            tile(
              'Done today',
              stats.completedToday,
              Icons.bar_chart_rounded,
              TileTone.sage,
            ),
          ],
        ),
        const SizedBox(height: Tm.s3),
        Row(
          children: [
            tile(
              'Active',
              stats.active,
              Icons.check_box_outlined,
              TileTone.sage,
            ),
            const SizedBox(width: Tm.s3),
            tile(
              'In Inbox',
              stats.inbox,
              Icons.inbox_outlined,
              TileTone.walnut,
            ),
          ],
        ),
      ],
    );
  }
}

class _Priorities extends StatelessWidget {
  const _Priorities({required this.today, required this.reload});
  final Today today;
  final Future<void> Function() reload;

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.read(context).api;
    final time = DateFormat.Hm();
    return SectionCard(
      title: 'Today’s priorities',
      trailing: Text(
        '${today.plannedMinutes} of ${today.availableMinutes ?? 0} min',
        style: TextStyle(color: context.tm.textMuted, fontSize: 13),
      ),
      child: today.plan.isEmpty
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: Tm.s3),
              child: Text('No estimated block fits today’s usable time.'),
            )
          : Column(
              children: [
                for (final item in today.plan)
                  _TaskLine(
                    task: item.task,
                    trailing: item.scheduledStart == null
                        ? formatMinutes(item.minutes)
                        : time.format(item.scheduledStart!),
                    onDone: () async {
                      final ok = await runAction(
                        context,
                        () => api.setStatus(item.task.id, TaskStatus.completed),
                      );
                      if (ok) await reload();
                    },
                  ),
              ],
            ),
    );
  }
}

class _TaskLine extends StatelessWidget {
  const _TaskLine({
    required this.task,
    required this.trailing,
    required this.onDone,
  });
  final Task task;
  final String trailing;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          CompleteCircle(title: task.title, onDone: onDone),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.title,
                  style: const TextStyle(fontWeight: FontWeight.w500),
                ),
                if (task.project != null)
                  Text(
                    task.project!.name,
                    style: TextStyle(color: tm.textMuted, fontSize: 13),
                  ),
              ],
            ),
          ),
          if (task.priority != null) ...[
            PriorityBadge(task.priority!),
            const SizedBox(width: Tm.s2),
          ],
          Text(trailing, style: TextStyle(color: tm.textMuted, fontSize: 13)),
        ],
      ),
    );
  }
}

class _NextBlock extends StatelessWidget {
  const _NextBlock({required this.item});
  final PlanItem item;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Container(
      padding: const EdgeInsets.all(Tm.s4),
      decoration: BoxDecoration(
        color: tm.calmSubtle,
        borderRadius: BorderRadius.circular(Tm.radiusLg),
      ),
      child: Row(
        children: [
          const IconTile(Icons.event_outlined, tone: TileTone.sage),
          const SizedBox(width: Tm.s3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Next block', style: TextStyle(color: tm.textMuted)),
                Text(
                  '${DateFormat.Hm().format(item.scheduledStart!)}  ${item.task.title}',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                Text(
                  [
                    if (item.task.project != null) item.task.project!.name,
                    formatMinutes(item.minutes),
                  ].join(' · '),
                  style: TextStyle(color: tm.textMuted, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
