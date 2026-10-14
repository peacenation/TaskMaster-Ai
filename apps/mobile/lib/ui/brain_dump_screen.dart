import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../api/client.dart';
import '../api/models.dart';
import '../state/session.dart';
import '../theme/tokens.dart';
import 'widgets.dart';

/// Opens Brain Dump; true when the person saved it.
Future<bool> openBrainDump(BuildContext context) async {
  final saved = await Navigator.of(context)
      .push<bool>(MaterialPageRoute(builder: (_) => const BrainDumpScreen()));
  return saved == true;
}

/// Brain Dump on the phone: write everything down, let TaskMasterAi
/// organise it (POST /api/v1/dumps), review, then save (commit). Nothing
/// becomes a task until the person saves. Pops `true` once saved.
class BrainDumpScreen extends StatefulWidget {
  const BrainDumpScreen({super.key});

  @override
  State<BrainDumpScreen> createState() => _BrainDumpScreenState();
}

class _BrainDumpScreenState extends State<BrainDumpScreen> {
  final _text = TextEditingController();
  DumpProposal? _proposal;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _organise() async {
    final text = _text.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = SessionScope.read(context);
    try {
      final proposal = await session.api.createDump(text);
      setState(() => _proposal = proposal);
    } on ApiException catch (e) {
      await session.handle(e);
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    final proposal = _proposal!;
    final items = proposal.items
        .where((i) => i.title.trim().isNotEmpty)
        .toList();
    if (items.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = SessionScope.read(context);
    try {
      await session.api.commitDump(proposal.dumpId, items);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      await session.handle(e);
      setState(
        () => _error = "${e.message} Your Brain Dump is saved — try again.",
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final proposal = _proposal;
    return Scaffold(
      appBar: AppBar(
        title: Text(proposal == null ? 'Brain Dump' : 'Review before you save'),
      ),
      body: SafeArea(
        child: proposal == null
            ? _compose(context)
            : _review(context, proposal),
      ),
    );
  }

  Widget _compose(BuildContext context) {
    final tm = context.tm;
    return ListView(
      padding: const EdgeInsets.all(Tm.s4),
      children: [
        Text(
          'Empty your head. Write everything on your mind — deadlines, chores, '
          'ideas — and TaskMasterAi will turn it into tasks you can review.',
          style: TextStyle(color: tm.textMuted),
        ),
        const SizedBox(height: Tm.s4),
        TextField(
          controller: _text,
          minLines: 8,
          maxLines: 16,
          maxLength: 20000,
          enabled: !_busy,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(
            labelText: 'Brain Dump',
            alignLabelWithHint: true,
            hintText:
                'Finish the report by Thursday, book the dentist, '
                'call Mum, start sorting the garage…',
          ),
          onChanged: (_) => setState(() {}),
        ),
        if (_error != null) _ErrorText(_error!),
        const SizedBox(height: Tm.s2),
        FilledButton.icon(
          onPressed: _busy || _text.text.trim().isEmpty ? null : _organise,
          icon: _busy
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.auto_awesome),
          label: Text(_busy ? 'Organising…' : 'Organise it'),
        ),
      ],
    );
  }

  Widget _review(BuildContext context, DumpProposal proposal) {
    final tm = context.tm;
    final count = proposal.items.where((i) => i.title.trim().isNotEmpty).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(Tm.s4),
            children: [
              Container(
                padding: const EdgeInsets.all(Tm.s3),
                decoration: BoxDecoration(
                  color: proposal.aiOrganised ? tm.aiBg : tm.sunken,
                  borderRadius: BorderRadius.circular(Tm.radiusMd),
                ),
                child: Row(
                  children: [
                    Icon(
                      proposal.aiOrganised ? Icons.auto_awesome : Icons.rule,
                      color: proposal.aiOrganised ? tm.aiText : tm.textMuted,
                      size: 20,
                    ),
                    const SizedBox(width: Tm.s2),
                    Expanded(
                      child: Text(
                        proposal.notice ?? 'Organised by AI. Check each item — nothing is saved until you do.',
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: Tm.s3),
              if (proposal.items.isEmpty)
                const EmptyState(
                  icon: Icons.inbox_outlined,
                  title: 'Nothing to add',
                  message: 'Go back and write a little more about what’s on your mind.',
                ),
              for (final (i, item) in proposal.items.indexed)
                _ReviewCard(
                  key: ObjectKey(item),
                  item: item,
                  onChanged: () => setState(() {}),
                  onRemove: () => setState(() => proposal.items.removeAt(i)),
                ),
              if (_error != null) _ErrorText(_error!),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s4, Tm.s4),
          child: FilledButton(
            onPressed: _busy || count == 0 ? null : _save,
            child: Text(
              _busy ? 'Saving…' : 'Save $count item${count == 1 ? '' : 's'}',
            ),
          ),
        ),
      ],
    );
  }
}

class _ErrorText extends StatelessWidget {
  const _ErrorText(this.message);
  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: Tm.s3),
    child: Semantics(
      liveRegion: true,
      child: Text(message, style: TextStyle(color: context.tm.danger)),
    ),
  );
}

class _ReviewCard extends StatefulWidget {
  const _ReviewCard({
    super.key,
    required this.item,
    required this.onChanged,
    required this.onRemove,
  });

  final ProposedItem item;
  final VoidCallback onChanged;
  final VoidCallback onRemove;

  @override
  State<_ReviewCard> createState() => _ReviewCardState();
}

class _ReviewCardState extends State<_ReviewCard> {
  late final _title = TextEditingController(text: widget.item.title);

  @override
  void dispose() {
    _title.dispose();
    super.dispose();
  }

  static String _kindLabel(String kind) => switch (kind) {
    'project' => 'Project',
    'goal' => 'Goal',
    'note' => 'Note',
    'recurring' => 'Habit',
    _ => 'Task',
  };

  @override
  Widget build(BuildContext context) {
    final tm = context.tm;
    final item = widget.item;
    final details = [
      if (item.dueAt != null)
        'Due ${DateFormat('EEE d MMM, HH:mm').format(item.dueAt!.toLocal())}',
      if (item.estimatedMinutes != null) formatMinutes(item.estimatedMinutes!),
      if (item.project != null) item.project!,
    ];
    return Padding(
      padding: const EdgeInsets.only(bottom: Tm.s2),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(Tm.s4, Tm.s2, Tm.s1, Tm.s3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: Tm.s2,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: tm.accentSubtle,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      _kindLabel(item.kind),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: tm.aiText,
                      ),
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    tooltip: 'Remove ${item.title}',
                    onPressed: widget.onRemove,
                    icon: Icon(Icons.close, color: tm.textMuted),
                  ),
                ],
              ),
              TextField(
                controller: _title,
                decoration: const InputDecoration(
                  hintText: 'Title',
                  isDense: true,
                ),
                onChanged: (value) {
                  item.title = value;
                  widget.onChanged();
                },
              ),
              if (details.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: Tm.s2, right: Tm.s3),
                  child: Text(
                    details.join(' · '),
                    style: TextStyle(color: tm.textMuted, fontSize: 13),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
