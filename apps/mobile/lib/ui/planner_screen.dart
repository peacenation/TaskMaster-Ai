import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'brain_dump_screen.dart';
import 'home_shell.dart';
import 'widgets.dart';

/// "04. AI Planner — turn your day into a clear plan": ask in plain words
/// ("plan my day around my 2pm meeting"), get a proposed timeline
/// (POST /api/v1/planner), then Apply it as today's plan or Adjust it.
/// Nothing changes until Apply.
class PlannerScreen extends StatefulWidget {
  const PlannerScreen({super.key});

  @override
  State<PlannerScreen> createState() => _PlannerScreenState();
}

class _PlannerScreenState extends State<PlannerScreen> {
  final _input = TextEditingController();
  final _focus = FocusNode();
  final _scroll = ScrollController();
  final _turns = <PlannerTurn>[];
  bool _thinking = false;
  bool _applying = false;
  PlannerProposal? _applied;
  int _generation = 0;

  static const _suggestions = [
    'Plan my day',
    'Plan my day around a 2pm meeting',
    'Protect a focus block this morning',
  ];

  @override
  void dispose() {
    _input.dispose();
    _focus.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _ask(String text) async {
    final message = text.trim();
    if (message.isEmpty || _thinking) return;
    final session = SessionScope.read(context);
    final history = List<PlannerTurn>.of(_turns);
    setState(() {
      _turns.add(PlannerTurn.user(message));
      _thinking = true;
      _input.clear();
    });
    _scrollToEnd();
    try {
      final proposal = await session.api.proposePlan(message, history);
      setState(() => _turns.add(PlannerTurn.assistant(proposal)));
    } on ApiException catch (e) {
      await session.handle(e);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
        setState(() => _turns.removeLast());
        _input.text = message;
      }
    } finally {
      if (mounted) setState(() => _thinking = false);
      _scrollToEnd();
    }
  }

  Future<void> _apply(PlannerProposal proposal) async {
    final api = SessionScope.read(context).api;
    setState(() => _applying = true);
    final ok = await runAction(
      context,
      () => api.applyPlan(proposal.taskBlocks),
    );
    if (!mounted) return;
    setState(() {
      _applying = false;
      if (ok) _applied = proposal;
    });
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Plan applied to Today'),
          action: SnackBarAction(
            label: 'View',
            onPressed: () => ShellTabs.go(context, AppTab.today),
          ),
        ),
      );
    }
  }

  void _adjust() {
    _focus.requestFocus();
    _input.text = '';
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Loader<Today>(
      key: ValueKey(_generation),
      load: api.today,
      builder: (context, today, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, 0),
            child: _Header(),
          ),
          Expanded(
            child: !today.onboarded
                ? ListView(
                    children: [
                      EmptyState(
                        icon: Icons.auto_awesome,
                        title: 'Nothing to plan yet',
                        message:
                            'Start with a Brain Dump. Once your tasks are in, '
                            'ask the planner to shape your day.',
                        action: FilledButton.icon(
                          onPressed: () async {
                            if (await openBrainDump(context)) {
                              setState(() => _generation++);
                            }
                          },
                          icon: const Icon(Icons.auto_awesome),
                          label: const Text('Start a Brain Dump'),
                        ),
                      ),
                    ],
                  )
                : ListView(
                    controller: _scroll,
                    padding: const EdgeInsets.fromLTRB(
                      Tm.s4,
                      Tm.s4,
                      Tm.s4,
                      Tm.s4,
                    ),
                    children: [
                      if (_turns.isEmpty) ...[
                        _CurrentPlan(today: today),
                        const SizedBox(height: Tm.s4),
                        Text(
                          'Try asking',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(height: Tm.s2),
                        Wrap(
                          spacing: Tm.s2,
                          runSpacing: Tm.s2,
                          children: [
                            for (final s in _suggestions)
                              ActionChip(
                                label: Text(s),
                                onPressed: () => _ask(s),
                              ),
                          ],
                        ),
                      ],
                      for (final (i, turn) in _turns.indexed)
                        turn.fromUser
                            ? _UserBubble(text: turn.text)
                            : _AssistantTurn(
                                proposal: turn.proposal!,
                                latest: i == _turns.length - 1,
                                applied: identical(turn.proposal, _applied),
                                applying: _applying,
                                onApply: () => _apply(turn.proposal!),
                                onAdjust: _adjust,
                              ),
                      if (_thinking) const _Thinking(),
                    ],
                  ),
          ),
          if (today.onboarded)
            _Composer(
              controller: _input,
              focusNode: _focus,
              enabled: !_thinking,
              onSend: () => _ask(_input.text),
            ),
        ],
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
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
      ],
    );
  }
}

class _CurrentPlan extends StatelessWidget {
  const _CurrentPlan({required this.today});
  final Today today;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: 'Today’s timeline',
      child: today.plan.isEmpty
          ? const Text(
              'Nothing scheduled yet. Ask the planner to build your day.',
            )
          : Column(
              children: [
                for (final (i, item) in today.plan.indexed)
                  TimelineRow(
                    time: item.scheduledStart == null
                        ? '—'
                        : DateFormat.Hm().format(item.scheduledStart!),
                    title: item.task.title,
                    subtitle: item.isProtected
                        ? 'Protected time'
                        : item.task.project?.name ?? 'No project',
                    minutes: item.minutes,
                    tone: i % 3,
                  ),
              ],
            ),
    );
  }
}

class _UserBubble extends StatelessWidget {
  const _UserBubble({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        margin: const EdgeInsets.only(bottom: Tm.s3, left: Tm.s8),
        padding: const EdgeInsets.symmetric(horizontal: Tm.s4, vertical: Tm.s3),
        decoration: BoxDecoration(
          color: tm.calmSubtle,
          borderRadius: BorderRadius.circular(Tm.radiusLg),
        ),
        child: Text(text),
      ),
    );
  }
}

class _AssistantTurn extends StatelessWidget {
  const _AssistantTurn({
    required this.proposal,
    required this.latest,
    required this.applied,
    required this.applying,
    required this.onApply,
    required this.onAdjust,
  });

  final PlannerProposal proposal;
  final bool latest;
  final bool applied;
  final bool applying;
  final VoidCallback onApply;
  final VoidCallback onAdjust;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final canApply = latest && proposal.taskBlocks.isNotEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: Tm.s4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: tm.accentSubtle,
                child: Icon(Icons.auto_awesome, color: tm.aiText, size: 18),
              ),
              const SizedBox(width: Tm.s3),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(Tm.s3),
                  decoration: BoxDecoration(
                    color: tm.card,
                    border: Border.all(color: tm.border),
                    borderRadius: BorderRadius.circular(Tm.radiusMd),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(proposal.reply),
                      if (!proposal.byAi) ...[
                        const SizedBox(height: Tm.s1),
                        Text(
                          'Planned by TaskMasterAi’s built-in rules',
                          style: TextStyle(color: tm.textSubtle, fontSize: 12),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (proposal.blocks.isNotEmpty) ...[
            const SizedBox(height: Tm.s3),
            SectionCard(
              title: 'Your planned timeline',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final (i, block) in proposal.blocks.indexed)
                    TimelineRow(
                      time: block.start,
                      title: block.title,
                      subtitle: switch (block.kind) {
                        BlockKind.breakTime => 'Break',
                        BlockKind.event => 'Event',
                        BlockKind.task => block.project ?? 'Task',
                      },
                      minutes: block.minutes,
                      tone: block.kind == BlockKind.task ? i % 3 : 3,
                    ),
                  if (canApply) ...[
                    const SizedBox(height: Tm.s3),
                    if (applied)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle, color: tm.success),
                          const SizedBox(width: Tm.s2),
                          const Text('Applied to Today'),
                        ],
                      )
                    else ...[
                      FilledButton.icon(
                        iconAlignment: IconAlignment.end,
                        onPressed: applying ? null : onApply,
                        icon: const Icon(Icons.arrow_forward),
                        label: Text(applying ? 'Applying…' : 'Apply plan'),
                      ),
                      TextButton(
                        onPressed: onAdjust,
                        child: const Text('Adjust plan'),
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Thinking extends StatelessWidget {
  const _Thinking();

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    return Padding(
      padding: const EdgeInsets.only(bottom: Tm.s4),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: tm.accentSubtle,
            child: Icon(Icons.auto_awesome, color: tm.aiText, size: 18),
          ),
          const SizedBox(width: Tm.s3),
          const SizedBox.square(
            dimension: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
          const SizedBox(width: Tm.s2),
          Text('Planning your day…', style: TextStyle(color: tm.textMuted)),
        ],
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.onSend,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, Tm.s3),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              enabled: enabled,
              minLines: 1,
              maxLines: 4,
              maxLength: 1000,
              textCapitalization: TextCapitalization.sentences,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              decoration: const InputDecoration(
                hintText: 'Ask your planner…',
                counterText: '',
              ),
            ),
          ),
          const SizedBox(width: Tm.s2),
          IconButton.filled(
            tooltip: 'Send',
            onPressed: enabled ? onSend : null,
            icon: const Icon(Icons.send_rounded),
          ),
        ],
      ),
    );
  }
}

/// One row of a timeline: time, a tinted block with title, detail, duration.
class TimelineRow extends StatelessWidget {
  const TimelineRow({
    super.key,
    required this.time,
    required this.title,
    required this.subtitle,
    required this.minutes,
    required this.tone,
  });

  final String time;
  final String title;
  final String subtitle;
  final int minutes;

  /// 0 sage, 1 caramel, 2 walnut, 3 neutral (breaks/events).
  final int tone;

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final (bg, edge) = switch (tone) {
      0 => (tm.calmSubtle, TmColors.sage),
      1 => (tm.accentSubtle, TmColors.caramel),
      2 => (tm.sunken, tm.action),
      _ => (tm.sunken, tm.borderStrong),
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
                time,
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
                          title,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          subtitle,
                          style: TextStyle(color: tm.textMuted, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    formatMinutes(minutes),
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
