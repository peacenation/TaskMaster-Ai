// Dart mirror of packages/api-contract/openapi.yaml. Change the spec, the
// server route (apps/web/app/api/v1) and these models together.

DateTime? _date(Object? value) =>
    value is String ? DateTime.parse(value).toLocal() : null;

class Me {
  Me({
    required this.id,
    required this.name,
    required this.email,
    required this.timeZone,
    required this.onboarded,
  });

  factory Me.fromJson(Map<String, dynamic> json) => Me(
    id: json['id'] as String,
    name: json['name'] as String,
    email: json['email'] as String,
    timeZone: json['timeZone'] as String,
    onboarded: json['onboarded'] as bool,
  );

  final String id;
  final String name;
  final String email;
  final String timeZone;
  final bool onboarded;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}

enum TaskStatus { inbox, todo, inProgress, completed, postponed, dropped }

TaskStatus _status(String value) => switch (value) {
  'inbox' => TaskStatus.inbox,
  'in_progress' => TaskStatus.inProgress,
  'completed' => TaskStatus.completed,
  'postponed' => TaskStatus.postponed,
  'dropped' => TaskStatus.dropped,
  _ => TaskStatus.todo,
};

String statusToWire(TaskStatus status) => switch (status) {
  TaskStatus.inProgress => 'in_progress',
  _ => status.name,
};

class ProjectRef {
  ProjectRef(this.id, this.name);
  final String id;
  final String name;
}

class Task {
  Task({
    required this.id,
    required this.title,
    required this.status,
    this.priority,
    this.dueAt,
    this.estimatedMinutes,
    this.project,
  });

  factory Task.fromJson(Map<String, dynamic> json) {
    final project = json['project'] as Map<String, dynamic>?;
    return Task(
      id: json['id'] as String,
      title: json['title'] as String,
      status: _status(json['status'] as String),
      priority: json['priority'] as int?,
      dueAt: _date(json['dueAt']),
      estimatedMinutes: json['estimatedMinutes'] as int?,
      project: project == null
          ? null
          : ProjectRef(project['id'] as String, project['name'] as String),
    );
  }

  final String id;
  final String title;
  final TaskStatus status;

  /// The user's own priority, 1 (low) to 5 (high).
  final int? priority;
  final DateTime? dueAt;
  final int? estimatedMinutes;
  final ProjectRef? project;
}

class PlanItem {
  PlanItem({
    required this.task,
    required this.position,
    required this.minutes,
    required this.isProtected,
    this.scheduledStart,
  });

  factory PlanItem.fromJson(Map<String, dynamic> json) => PlanItem(
    task: Task.fromJson(json['task'] as Map<String, dynamic>),
    position: json['position'] as int,
    minutes: json['minutes'] as int,
    isProtected: json['protected'] as bool,
    scheduledStart: _date(json['scheduledStart']),
  );

  final Task task;
  final int position;
  final int minutes;
  final bool isProtected;
  final DateTime? scheduledStart;
}

class Recommendation {
  Recommendation({
    required this.task,
    required this.message,
    required this.reasons,
    required this.overridden,
  });

  factory Recommendation.fromJson(Map<String, dynamic> json) => Recommendation(
    task: Task.fromJson(json['task'] as Map<String, dynamic>),
    message: json['message'] as String,
    reasons: (json['reasons'] as List).cast<String>(),
    overridden: json['overridden'] as bool,
  );

  final Task task;
  final String message;
  final List<String> reasons;

  /// True when this is the user's own choice, not the AI suggestion.
  final bool overridden;
}

class ProjectProgress {
  ProjectProgress({
    required this.id,
    required this.name,
    required this.done,
    required this.total,
    this.open,
  });

  factory ProjectProgress.fromJson(Map<String, dynamic> json) =>
      ProjectProgress(
        id: json['id'] as String,
        name: json['name'] as String,
        done: json['done'] as int,
        total: json['total'] as int,
        open: json['open'] as int?,
      );

  final String id;
  final String name;
  final int done;
  final int total;
  final int? open;

  double get fraction => total == 0 ? 0 : done / total;
}

class TodayStats {
  TodayStats(this.active, this.dueToday, this.completedToday, this.inbox);
  final int active;
  final int dueToday;
  final int completedToday;
  final int inbox;
}

class Today {
  Today({
    required this.onboarded,
    this.greeting = '',
    this.firstName = '',
    this.stats,
    this.recommendation,
    this.plan = const [],
    this.projects = const [],
    this.plannedMinutes = 0,
    this.availableMinutes,
    this.overloaded = false,
    this.attentionCount = 0,
  });

  factory Today.fromJson(Map<String, dynamic> json) {
    if (json['onboarded'] != true) {
      // Not onboarded yet: still greeted, so the app can offer a Brain Dump.
      return Today(
        onboarded: false,
        greeting: json['greeting'] as String? ?? 'Hello',
        firstName: json['firstName'] as String? ?? '',
      );
    }
    final stats = json['stats'] as Map<String, dynamic>;
    final capacity = json['capacity'] as Map<String, dynamic>;
    final attention = json['attention'] as Map<String, dynamic>;
    final rec = json['recommendation'] as Map<String, dynamic>?;
    return Today(
      onboarded: true,
      greeting: json['greeting'] as String,
      firstName: json['firstName'] as String,
      stats: TodayStats(
        stats['active'] as int,
        stats['dueToday'] as int,
        stats['completedToday'] as int,
        stats['inbox'] as int,
      ),
      recommendation: rec == null ? null : Recommendation.fromJson(rec),
      plan: (json['plan'] as List)
          .map((e) => PlanItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      projects: (json['projects'] as List)
          .map((e) => ProjectProgress.fromJson(e as Map<String, dynamic>))
          .toList(),
      plannedMinutes: capacity['plannedMinutes'] as int,
      availableMinutes: capacity['availableMinutes'] as int?,
      overloaded: capacity['overloaded'] as bool,
      attentionCount:
          (attention['recovery'] as int) +
          ((attention['realityCheck'] as bool) ? 1 : 0),
    );
  }

  final bool onboarded;
  final String greeting;
  final String firstName;
  final TodayStats? stats;
  final Recommendation? recommendation;
  final List<PlanItem> plan;
  final List<ProjectProgress> projects;
  final int plannedMinutes;
  final int? availableMinutes;
  final bool overloaded;

  /// Decisions waiting on the web (recovery check-in, Reality Check).
  final int attentionCount;

  /// Share of today's work done: completed ÷ (completed + still planned).
  double get dailyProgress {
    final done = stats?.completedToday ?? 0;
    final total = done + plan.length;
    return total == 0 ? 0 : done / total;
  }
}

enum TaskView { today, upcoming, all, inbox }

/// One item Claude or the built-in rules proposed from a Brain Dump.
class ProposedItem {
  ProposedItem({
    required this.kind,
    required this.title,
    this.dueAt,
    this.recurrence,
    this.estimatedMinutes,
    this.project,
  });

  factory ProposedItem.fromJson(Map<String, dynamic> json) {
    final deadline = json['deadline'] as Map<String, dynamic>?;
    return ProposedItem(
      kind: json['kind'] as String,
      title: json['title'] as String,
      dueAt: deadline == null ? null : DateTime.parse(deadline['at'] as String),
      recurrence: json['recurrence'] as Map<String, dynamic>?,
      estimatedMinutes: json['estimatedMinutes'] as int?,
      project: json['project'] as String?,
    );
  }

  /// task | project | goal | note | recurring
  final String kind;
  String title;
  final DateTime? dueAt;
  final Map<String, dynamic>? recurrence;
  final int? estimatedMinutes;
  final String? project;

  /// The commit body's ReviewedItem (packages/api-contract).
  Map<String, dynamic> toReviewedJson() => {
    'kind': kind,
    'title': title.trim(),
    'dueAt': dueAt?.toUtc().toIso8601String(),
    'recurrence': recurrence,
    'estimatedMinutes': estimatedMinutes,
    'project': project,
    'importance': null,
  };
}

class DumpProposal {
  DumpProposal({
    required this.dumpId,
    required this.aiOrganised,
    required this.notice,
    required this.items,
  });

  factory DumpProposal.fromJson(Map<String, dynamic> json) => DumpProposal(
    dumpId: json['dumpId'] as String,
    aiOrganised: json['engine'] == 'ai',
    notice: json['notice'] as String?,
    items: (json['items'] as List)
        .map((e) => ProposedItem.fromJson(e as Map<String, dynamic>))
        .toList(),
  );

  final String dumpId;
  final bool aiOrganised;

  /// Why the built-in rules organised it, when they did.
  final String? notice;
  final List<ProposedItem> items;
}

class ProjectDetail {
  ProjectDetail({
    required this.project,
    required this.inProgress,
    required this.todo,
    required this.postponed,
  });

  factory ProjectDetail.fromJson(Map<String, dynamic> json) {
    List<Task> tasks(String key) => (json[key] as List)
        .map((e) => Task.fromJson(e as Map<String, dynamic>))
        .toList();
    return ProjectDetail(
      project: ProjectProgress.fromJson(
        json['project'] as Map<String, dynamic>,
      ),
      inProgress: tasks('inProgress'),
      todo: tasks('todo'),
      postponed: tasks('postponed'),
    );
  }

  final ProjectProgress project;
  final List<Task> inProgress;
  final List<Task> todo;
  final List<Task> postponed;
}

enum BlockKind { task, breakTime, event }

class PlannerBlock {
  PlannerBlock({
    required this.kind,
    required this.title,
    required this.start,
    required this.minutes,
    this.taskId,
    this.project,
  });

  factory PlannerBlock.fromJson(Map<String, dynamic> json) => PlannerBlock(
    kind: switch (json['kind']) {
      'break' => BlockKind.breakTime,
      'event' => BlockKind.event,
      _ => BlockKind.task,
    },
    taskId: json['taskId'] as String?,
    title: json['title'] as String,
    project: json['project'] as String?,
    start: json['start'] as String,
    minutes: json['minutes'] as int,
  );

  final BlockKind kind;
  final String? taskId;
  final String title;
  final String? project;

  /// Local 24-hour HH:MM.
  final String start;
  final int minutes;
}

class PlannerProposal {
  PlannerProposal({
    required this.byAi,
    required this.reply,
    required this.blocks,
  });

  factory PlannerProposal.fromJson(Map<String, dynamic> json) =>
      PlannerProposal(
        byAi: json['engine'] == 'ai',
        reply: json['reply'] as String,
        blocks: (json['blocks'] as List)
            .map((e) => PlannerBlock.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  final bool byAi;
  final String reply;
  final List<PlannerBlock> blocks;

  /// What Apply saves: task blocks only (breaks and events are suggestions).
  List<PlannerBlock> get taskBlocks => blocks
      .where((b) => b.kind == BlockKind.task && b.taskId != null)
      .toList();
}

class PlannerTurn {
  PlannerTurn.user(this.text) : fromUser = true, proposal = null;
  PlannerTurn.assistant(PlannerProposal this.proposal)
    : fromUser = false,
      text = proposal.reply;

  final bool fromUser;
  final String text;
  final PlannerProposal? proposal;

  Map<String, String> toJson() => {
    'role': fromUser ? 'user' : 'assistant',
    'text': text,
  };
}
