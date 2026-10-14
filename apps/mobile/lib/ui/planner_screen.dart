import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'widgets.dart';

/// "04. AI Planner". For now it shows the timeline the planner already
/// builds (the scheduled view of today's plan). The conversational planner
/// — "plan my day around my 2pm meeting" → proposed timeline → Apply —
/// is Phase M3 in docs/MOBILE_AND_PLATFORM_PLAN.md.
class PlannerScreen extends StatelessWidget {
  const PlannerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    final tm = context.tm;
    return Loader<Today>(
      load: api.today,
      builder: (context, today, _) => ListView(
        padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, Tm.s8),
        children: [
          Row(
            children: [
              Icon(Icons.auto_awesome, color: tm.aiText, size: 30),
              const SizedBox(width: Tm.s2),
              Expanded(
                child: Semantics(
                  header: true,
                  child: Text(
                    'AI Planner',
                    style: Theme.of(context).textTheme.headlineLarge,
                  ),
                ),
              ),
              const AccountAvatar(),
            ],
          ),
          Text(
            'A clear plan for your day.',
            style: TextStyle(color: tm.textMuted, fontSize: 16),
          ),
          const SizedBox(height: Tm.s4),
          SectionCard(
            title: 'Your planned timeline',
            child: today.plan.isEmpty
                ? const Text('Nothing scheduled yet today.')
                : Column(
                    children: [
                      for (final (i, item) in today.plan.indexed)
                        _TimelineRow(item: item, tone: i % 3),
                    ],
                  ),
          ),
          const SizedBox(height: Tm.s3),
          Container(
            padding: const EdgeInsets.all(Tm.s4),
            decoration: BoxDecoration(
              color: tm.aiBg,
              borderRadius: BorderRadius.circular(Tm.radiusLg),
            ),
            child: const Text(
              'Chatting with your planner is coming soon — ask it to plan '
              'around a meeting and apply the timeline it suggests.',
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.item, required this.tone});
  final PlanItem item;
  final int tone;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final (bg, edge) = switch (tone) {
      0 => (tm.calmSubtle, TmColors.sage),
      1 => (tm.accentSubtle, TmColors.caramel),
      _ => (tm.sunken, tm.action),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Tm.s1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 52,
            child: Padding(
              padding: const EdgeInsets.only(top: Tm.s3),
              child: Text(
                item.scheduledStart == null
                    ? '—'
                    : DateFormat.Hm().format(item.scheduledStart!),
                style: TextStyle(color: tm.textMuted, fontSize: 13),
              ),
            ),
          ),
          Expanded(
            child: Container(
              padding: const EdgeInsets.all(Tm.s3),
              decoration: BoxDecoration(
                color: bg,
                borderRadius: BorderRadius.circular(Tm.radiusMd),
                border: Border(left: BorderSide(color: edge, width: 4)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.task.title,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          item.isProtected
                              ? 'Protected time'
                              : item.task.project?.name ?? 'No project',
                          style: TextStyle(color: tm.textMuted, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    formatMinutes(item.minutes),
                    style: TextStyle(color: tm.textMuted, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
