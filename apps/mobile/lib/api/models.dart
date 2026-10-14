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
    if (json['onboarded'] != true) return Today(onboarded: false);
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
}

enum TaskView { today, upcoming, all, inbox }
