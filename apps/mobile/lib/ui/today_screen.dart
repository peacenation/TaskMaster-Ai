import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'brain_dump_screen.dart';
import 'focus_screen.dart';
import 'home_shell.dart';
import 'task_screen.dart';
import 'today_decisions.dart';
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
          if (!today.onboarded)
            _PlanYourDay(onSaved: reload)
          else ...[
            if (today.recovery.isNotEmpty) ...[
              RecoveryCard(items: today.recovery, saved: reload),
              const SizedBox(height: Tm.s3),
            ],
            if (today.realityCheck case final check?) ...[
              RealityCheckCard(check: check, decided: reload),
              const SizedBox(height: Tm.s3),
            ],
            _NextBestAction(today: today, reload: reload),
            const SizedBox(height: Tm.s3),
            if (today.procrastination.isNotEmpty) ...[
              ProcrastinationCard(
                tasks: today.procrastination,
                changed: reload,
              ),
              const SizedBox(height: Tm.s3),
            ],
            _Stats(today: today),
            const SizedBox(height: Tm.s3),
            if (today.events.isNotEmpty) ...[
              _Calendar(events: today.events, now: (now ?? DateTime.now)()),
              const SizedBox(height: Tm.s3),
            ],
            CapacityCard(today: today, rebuilt: reload),
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

/// First run: the concept's "Let's plan your day" hero. Plan my day opens
/// Brain Dump on the phone; saving it builds Today.
class _PlanYourDay extends StatelessWidget {
  const _PlanYourDay({required this.onSaved});
  final Future<void> Function() onSaved;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: tm.heroGradient),
            borderRadius: BorderRadius.circular(Tm.radiusLg),
            border: Border.all(color: tm.aiBadge),
          ),
          child: Stack(
            children: [
              const Positioned(right: 0, top: 0, child: HillsArt()),
              Padding(
                padding: const EdgeInsets.all(Tm.s5),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 24,
                      backgroundColor: tm.card,
                      child: Icon(Icons.auto_awesome, color: tm.aiText),
                    ),
                    const SizedBox(height: Tm.s4),
                    Semantics(
                      header: true,
                      child: Text(
                        'Let’s plan your day',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ),
                    const SizedBox(height: Tm.s2),
                    const Text(
                      'Write down everything on your mind. TaskMasterAi turns '
                      'it into tasks you review, then a realistic plan for today.',
                    ),
                    const SizedBox(height: Tm.s5),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        iconAlignment: IconAlignment.end,
                        onPressed: () async {
                          if (await openBrainDump(context)) await onSaved();
                        },
                        icon: const Icon(Icons.arrow_forward),
                        label: const Text('Plan my day'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: Tm.s3),
        TextButton(
          onPressed: () => showQuickAdd(context),
          child: const Text('Or add a single task to your Inbox'),
        ),
      ],
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
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          if (!confirmed) const Positioned(right: 0, top: 0, child: HillsArt()),
          Padding(
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
                InkWell(
                  onTap: rec == null
                      ? null
                      : () async {
                          if (await openTask(context, rec.task.id)) {
                            await reload();
                          }
                        },
                  child: Text(
                    rec?.task.title ?? 'Nothing active yet',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                const SizedBox(height: Tm.s1),
                Text(
                  rec?.message ??
                      'Capture new work or organise your Inbox to get started.',
                ),
                if (rec != null && rec.reasons.isNotEmpty)
                  _WhyThis(reasons: rec.reasons),
                if (rec != null) ...[
                  const SizedBox(height: Tm.s3),
                  FilledButton.icon(
                    onPressed: () async {
                      if (await openFocus(context, rec.task)) await reload();
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
                    ],
                  ),
                  Center(
                    child: TextButton(
                      onPressed: () async {
                        final changed = confirmed
                            ? await runAction(
                                context,
                                () => api.chooseNext(null),
                              )
                            : await chooseNextTask(context, today);
                        if (changed) await reload();
                      },
                      child: Text(
                        confirmed
                            ? 'Use the recommendation instead'
                            : 'Choose a different task',
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
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
  const _Stats({required this.today});
  final Today today;

  @override
  Widget build(BuildContext context) {
    final stats = today.stats!;
    Widget tile(String label, Object value, IconData icon, TileTone tone) =>
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
              'Daily progress',
              '${(today.dailyProgress * 100).round()}%',
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
      trailing: TextButton.icon(
        onPressed: () => ShellTabs.go(context, AppTab.tasks),
        iconAlignment: IconAlignment.end,
        icon: const Icon(Icons.arrow_forward, size: 16),
        label: const Text('View all'),
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
                    onOpen: () async {
                      if (await openTask(context, item.task.id)) await reload();
                    },
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
    required this.onOpen,
  });
  final Task task;
  final String trailing;
  final VoidCallback onDone;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return InkWell(
      onTap: onOpen,
      borderRadius: BorderRadius.circular(Tm.radiusSm),
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

/// "Why this?": the reasons behind the recommendation, folded by default.
class _WhyThis extends StatelessWidget {
  const _WhyThis({required this.reasons});
  final List<String> reasons;

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: Tm.s2),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        title: Text(
          'Why this?',
          style: TextStyle(
            color: context.tm.aiText,
            fontWeight: FontWeight.w600,
          ),
        ),
        children: [for (final reason in reasons) Text('• $reason')],
      ),
    );
  }
}

/// Today's meetings from connected calendars: all-day ones as chips, timed
/// ones still ahead as a list.
class _Calendar extends StatelessWidget {
  const _Calendar({required this.events, required this.now});
  final List<CalendarEvent> events;
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final allDay = events.where((e) => e.allDay).toList();
    final ahead = events
        .where((e) => !e.allDay && e.endsAt.isAfter(now))
        .toList();
    final time = DateFormat.Hm();
    return SectionCard(
      title: 'Today’s calendar',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (allDay.isNotEmpty)
            Wrap(
              spacing: Tm.s2,
              runSpacing: Tm.s1,
              children: [
                for (final e in allDay)
                  Chip(
                    label: Text(e.title),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
          if (ahead.isEmpty)
            Text(
              'No more meetings today.',
              style: TextStyle(color: tm.textMuted),
            ),
          for (final e in ahead)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: Tm.s1),
              child: Row(
                children: [
                  SizedBox(
                    width: 52,
                    child: Text(
                      time.format(e.startsAt),
                      style: TextStyle(color: tm.textMuted),
                    ),
                  ),
                  Icon(Icons.event_outlined, size: 18, color: tm.textMuted),
                  const SizedBox(width: Tm.s2),
                  Expanded(child: Text(e.title)),
                  Text(
                    formatMinutes(e.minutes),
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
