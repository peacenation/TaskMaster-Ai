import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'task_screen.dart';
import 'widgets.dart';

/// Daily and weekly reviews (GET /api/v1/reviews/*): close the day in a
/// minute, and choose what deserves next week.
class ReviewsScreen extends StatelessWidget {
  const ReviewsScreen({super.key, this.weekly = false});
  final bool weekly;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      initialIndex: weekly ? 1 : 0,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Review'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Today'),
              Tab(text: 'This week'),
            ],
          ),
        ),
        body: const SafeArea(
          child: TabBarView(children: [_Daily(), _Weekly()]),
        ),
      ),
    );
  }
}

class _Daily extends StatelessWidget {
  const _Daily();

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Loader<DailyReview>(
      load: api.dailyReview,
      builder: (context, review, reload) {
        if (review.empty) {
          return ListView(
            children: const [
              EmptyState(
                icon: Icons.wb_twilight,
                title: 'A clear day',
                message: 'There’s nothing to review yet.',
              ),
            ],
          );
        }
        return ListView(
          padding: const EdgeInsets.all(Tm.s4),
          children: [
            Text(
              '${review.completed.length} completed · '
              '${review.changed.length} changed · '
              '${review.carried.length} carried forward',
              style: TextStyle(color: context.tm.textMuted, fontSize: 16),
            ),
            const SizedBox(height: Tm.s4),
            _RefList(
              title: 'Completed',
              empty: 'Nothing marked complete today.',
              refs: review.completed,
              done: true,
              changed: reload,
            ),
            _RefList(
              title: 'Missed plan blocks',
              empty: 'No missed blocks need a decision.',
              refs: review.missed,
              changed: reload,
            ),
            _RefList(
              title: 'Still active',
              empty: 'No active work carried over.',
              refs: review.carried,
              changed: reload,
            ),
          ],
        );
      },
    );
  }
}

class _Weekly extends StatelessWidget {
  const _Weekly();

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    final tm = context.tm;
    final day = DateFormat('d MMM');
    return Loader<WeeklyReview>(
      load: api.weeklyReview,
      builder: (context, review, reload) => ListView(
        padding: const EdgeInsets.all(Tm.s4),
        children: [
          Text(
            '${day.format(review.startDate)} – ${day.format(review.endDate)}',
            style: TextStyle(color: tm.textMuted, fontSize: 16),
          ),
          const SizedBox(height: Tm.s4),
          if (review.insights.isNotEmpty) ...[
            SectionCard(
              title: 'Worth a look',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final insight in review.insights)
                    Padding(
                      padding: const EdgeInsets.only(bottom: Tm.s2),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.auto_awesome, size: 18, color: tm.aiText),
                          const SizedBox(width: Tm.s2),
                          Expanded(child: Text(insight)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: Tm.s3),
          ],
          SectionCard(
            title: 'Goal progress',
            child: review.goals.isEmpty
                ? const Text('No goals yet.')
                : Column(
                    children: [
                      for (final goal in review.goals)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.flag_outlined),
                          title: Text(goal.title),
                          trailing: Text(
                            '${goal.completed} done',
                            style: TextStyle(color: tm.textMuted),
                          ),
                        ),
                    ],
                  ),
          ),
          const SizedBox(height: Tm.s3),
          SectionCard(
            title: 'Deadlines this week',
            child: review.deadlines.isEmpty
                ? const Text('No deadlines this week.')
                : Column(
                    children: [
                      for (final d in review.deadlines)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(d.ref.title),
                          trailing: d.dueAt == null
                              ? null
                              : Text(DateFormat('EEE d').format(d.dueAt!)),
                          onTap: () async {
                            if (await openTask(context, d.ref.id)) {
                              await reload();
                            }
                          },
                        ),
                    ],
                  ),
          ),
          const SizedBox(height: Tm.s3),
          SectionCard(
            title: 'Postponed this week',
            child: review.postponed.isEmpty
                ? const Text('No postponements recorded.')
                : Column(
                    children: [
                      for (final p in review.postponed)
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(p.ref.title),
                          subtitle: p.times > 1
                              ? Text('Moved ${p.times} times')
                              : null,
                          onTap: () async {
                            if (await openTask(context, p.ref.id)) {
                              await reload();
                            }
                          },
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _RefList extends StatelessWidget {
  const _RefList({
    required this.title,
    required this.empty,
    required this.refs,
    required this.changed,
    this.done = false,
  });
  final String title;
  final String empty;
  final List<TaskRef> refs;
  final Future<void> Function() changed;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: Tm.s3),
      child: SectionCard(
        title: title,
        child: refs.isEmpty
            ? Text(empty, style: TextStyle(color: context.tm.textMuted))
            : Column(
                children: [
                  for (final ref in refs)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(
                        done ? Icons.check_circle : Icons.circle_outlined,
                        color: done ? context.tm.success : null,
                      ),
                      title: Text(ref.title),
                      onTap: () async {
                        if (await openTask(context, ref.id)) await changed();
                      },
                    ),
                ],
              ),
      ),
    );
  }
}
