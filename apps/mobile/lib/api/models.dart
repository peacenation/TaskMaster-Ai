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
    this.preferences = const Preferences(),
    this.hasPassword = true,
    this.plan = const PlanInfo(),
  });

  factory Me.fromJson(Map<String, dynamic> json) {
    final prefs = json['preferences'] as Map<String, dynamic>?;
    return Me(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      timeZone: json['timeZone'] as String,
      onboarded: json['onboarded'] as bool,
      preferences: prefs == null
          ? const Preferences()
          : Preferences.fromJson(prefs),
      hasPassword: json['hasPassword'] as bool? ?? true,
      plan: json['plan'] == null
          ? const PlanInfo()
          : PlanInfo.fromJson(json['plan'] as Map<String, dynamic>),
    );
  }

  final String id;
  final String name;
  final String email;

  /// The zone plans use: the saved one, else this device's.
  final String timeZone;
  final bool onboarded;
  final Preferences preferences;

  /// Deleting the account asks for the password when there is one.
  final bool hasPassword;
  final PlanInfo plan;

  String get initials {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }
}

/// Free or Pro, and what that allows. Read-only on the phone: plans are
/// bought and managed on the web.
class PlanInfo {
  const PlanInfo({
    this.pro = false,
    this.status,
    this.renewsAt,
    this.calendars = 1,
  });

  factory PlanInfo.fromJson(Map<String, dynamic> json) => PlanInfo(
    pro: json['id'] == 'pro',
    status: json['status'] as String?,
    renewsAt: _date(json['renewsAt']),
    calendars: json['calendars'] as int? ?? 1,
  );

  final bool pro;
  final String? status;
  final DateTime? renewsAt;
  final int calendars;
}

/// Settings shared with the web's Settings page.
class Preferences {
  const Preferences({
    this.timeZone,
    this.dayMinutes = 240,
    this.planMode = 'flexible',
    this.notifications = 'important',
  });

  factory Preferences.fromJson(Map<String, dynamic> json) => Preferences(
    timeZone: json['timeZone'] as String?,
    dayMinutes: json['dayMinutes'] as int? ?? 240,
    planMode: json['planMode'] as String? ?? 'flexible',
    notifications: json['notifications'] as String? ?? 'important',
  );

  /// Null while the device's time zone is used.
  final String? timeZone;
  final int dayMinutes;

  /// flexible | scheduled
  final String planMode;

  /// off | important
  final String notifications;
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
    this.waitingOn,
    this.followUpAt,
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
      waitingOn: json['waitingOn'] as String?,
      followUpAt: _date(json['followUpAt']),
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

  /// Waiting On: who owns the next step; null when it's the user's.
  final String? waitingOn;

  /// When to chase; out of the plan until then.
  final DateTime? followUpAt;
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
    this.settings = const TodaySettings(),
    this.recovery = const [],
    this.realityCheck,
    this.procrastination = const [],
    this.events = const [],
    this.meetingMinutes = 0,
    this.followUps = const [],
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
    final rec = json['recommendation'] as Map<String, dynamic>?;
    final settings = json['settings'] as Map<String, dynamic>?;
    final reality = json['realityCheck'] as Map<String, dynamic>?;
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
      settings: settings == null
          ? const TodaySettings()
          : TodaySettings.fromJson(settings),
      recovery: [
        for (final e in json['recovery'] as List? ?? const [])
          RecoveryItem.fromJson(e as Map<String, dynamic>),
      ],
      realityCheck: reality == null ? null : RealityCheck.fromJson(reality),
      procrastination: [
        for (final e in json['procrastination'] as List? ?? const [])
          TaskRef(
            (e as Map<String, dynamic>)['taskId'] as String,
            e['title'] as String,
          ),
      ],
      events: [
        for (final e in json['events'] as List? ?? const [])
          CalendarEvent.fromJson(e as Map<String, dynamic>),
      ],
      meetingMinutes: json['meetingMinutes'] as int? ?? 0,
      followUps: [
        for (final t in json['followUps'] as List? ?? const [])
          Task.fromJson(t as Map<String, dynamic>),
      ],
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
  final TodaySettings settings;

  /// Missed plan blocks waiting for keep / postpone / drop.
  final List<RecoveryItem> recovery;

  /// Present when deadline-critical work is more than the day can hold.
  final RealityCheck? realityCheck;

  /// Tasks postponed three times in a row.
  final List<TaskRef> procrastination;

  /// Today's events from connected calendars.
  final List<CalendarEvent> events;

  /// Meeting time still ahead today, already taken out of capacity.
  final int meetingMinutes;

  /// Waiting On tasks whose follow-up date has come.
  final List<Task> followUps;

  /// Share of today's work done: completed ÷ (completed + still planned).
  double get dailyProgress {
    final done = stats?.completedToday ?? 0;
    final total = done + plan.length;
    return total == 0 ? 0 : done / total;
  }
}

enum TaskView { today, upcoming, all, inbox, waiting }

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

/// How today's plan is sized: day length, time actually available, energy.
class TodaySettings {
  const TodaySettings({
    this.dayMinutes = 240,
    this.availableMinutes,
    this.energy,
  });

  factory TodaySettings.fromJson(Map<String, dynamic> json) => TodaySettings(
    dayMinutes: json['dayMinutes'] as int? ?? 240,
    availableMinutes: json['availableMinutes'] as int?,
    energy: json['energy'] as String?,
  );

  final int dayMinutes;
  final int? availableMinutes;

  /// low | medium | high
  final String? energy;

  Map<String, dynamic> toJson() => {
    'dayMinutes': dayMinutes,
    'availableMinutes': availableMinutes,
    'energy': energy,
  };
}

class TaskRef {
  const TaskRef(this.id, this.title);
  final String id;
  final String title;
}

enum RecoveryChoice { keep, postpone, drop }

class RecoveryItem {
  RecoveryItem({required this.id, required this.taskId, required this.title});

  factory RecoveryItem.fromJson(Map<String, dynamic> json) => RecoveryItem(
    id: json['id'] as String,
    taskId: json['taskId'] as String,
    title: json['title'] as String,
  );

  /// The plan block's id — what a recovery decision names.
  final String id;
  final String taskId;
  final String title;
}

class RealityCheck {
  RealityCheck({
    required this.workMinutes,
    required this.usableMinutes,
    required this.excessMinutes,
    required this.tasks,
  });

  factory RealityCheck.fromJson(Map<String, dynamic> json) => RealityCheck(
    workMinutes: json['workMinutes'] as int,
    usableMinutes: json['usableMinutes'] as int,
    excessMinutes: json['excessMinutes'] as int,
    tasks: [
      for (final e in json['tasks'] as List)
        (
          id: (e as Map<String, dynamic>)['id'] as String,
          title: e['title'] as String,
          minutes: e['minutes'] as int,
        ),
    ],
  );

  final int workMinutes;
  final int usableMinutes;
  final int excessMinutes;
  final List<({String id, String title, int minutes})> tasks;
}

/// One task with everything its screen shows (GET /api/v1/tasks/{id}).
class TaskDetail {
  TaskDetail({
    required this.task,
    required this.description,
    required this.importance,
    required this.urgency,
    required this.energy,
    required this.goal,
    required this.steps,
    required this.suggestedSteps,
    required this.canBreakDown,
    required this.history,
    required this.projectNames,
    required this.goalTitles,
  });

  factory TaskDetail.fromJson(Map<String, dynamic> json) {
    final t = json['task'] as Map<String, dynamic>;
    final goal = t['goal'] as Map<String, dynamic>?;
    return TaskDetail(
      task: Task.fromJson(t),
      description: t['description'] as String?,
      importance: t['importance'] as int?,
      urgency: t['urgency'] as int?,
      energy: t['energy'] as String?,
      goal: goal == null
          ? null
          : TaskRef(goal['id'] as String, goal['title'] as String),
      steps: [
        for (final e in json['steps'] as List)
          (
            id: (e as Map<String, dynamic>)['id'] as String,
            title: e['title'] as String,
            status: _status(e['status'] as String),
          ),
      ],
      suggestedSteps: (json['suggestedSteps'] as List).cast<String>(),
      canBreakDown: json['canBreakDown'] as bool,
      history: [
        for (final e in json['history'] as List)
          (
            type: (e as Map<String, dynamic>)['type'] as String,
            at: DateTime.parse(e['at'] as String).toLocal(),
          ),
      ],
      projectNames: [
        for (final p in json['projects'] as List)
          (p as Map<String, dynamic>)['name'] as String,
      ],
      goalTitles: [
        for (final g in json['goals'] as List)
          (g as Map<String, dynamic>)['title'] as String,
      ],
    );
  }

  final Task task;
  final String? description;
  final int? importance;
  final int? urgency;
  final String? energy;
  final TaskRef? goal;
  final List<({String id, String title, TaskStatus status})> steps;
  final List<String> suggestedSteps;
  final bool canBreakDown;
  final List<({String type, DateTime at})> history;
  final List<String> projectNames;
  final List<String> goalTitles;
}

enum GoalNudge { unlinked, stalled }

class Goal {
  Goal({
    required this.id,
    required this.title,
    required this.targetDate,
    required this.linked,
    required this.active,
    required this.completed,
    required this.nudge,
    required this.tasks,
  });

  factory Goal.fromJson(Map<String, dynamic> json) => Goal(
    id: json['id'] as String,
    title: json['title'] as String,
    targetDate: json['targetDate'] == null
        ? null
        : DateTime.parse(json['targetDate'] as String),
    linked: json['linked'] as int,
    active: json['active'] as int,
    completed: json['completed'] as int,
    nudge: switch (json['nudge']) {
      'unlinked' => GoalNudge.unlinked,
      'stalled' => GoalNudge.stalled,
      _ => null,
    },
    tasks: [
      for (final t in json['tasks'] as List)
        Task.fromJson(t as Map<String, dynamic>),
    ],
  );

  final String id;
  final String title;
  final DateTime? targetDate;
  final int linked;
  final int active;
  final int completed;
  final GoalNudge? nudge;
  final List<Task> tasks;

  double get fraction => linked == 0 ? 0 : completed / linked;
}

class Responsibility {
  Responsibility({
    required this.id,
    required this.title,
    required this.frequency,
    required this.intervalCount,
    required this.timesPerPeriod,
    required this.stopped,
    required this.upcoming,
  });

  factory Responsibility.fromJson(Map<String, dynamic> json) => Responsibility(
    id: json['id'] as String,
    title: json['title'] as String,
    frequency: json['frequency'] as String,
    intervalCount: json['intervalCount'] as int,
    timesPerPeriod: json['timesPerPeriod'] as int,
    stopped: json['stopped'] as bool,
    upcoming: [
      for (final e in json['upcoming'] as List)
        (
          id: (e as Map<String, dynamic>)['id'] as String,
          title: e['title'] as String,
          status: _status(e['status'] as String),
          date: DateTime.parse(e['date'] as String),
        ),
    ],
  );

  final String id;
  final String title;

  /// daily | weekly | monthly
  final String frequency;
  final int intervalCount;
  final int timesPerPeriod;
  final bool stopped;
  final List<({String id, String title, TaskStatus status, DateTime date})>
  upcoming;

  /// "3 times weekly", "monthly, every 2 periods".
  String get cadence => [
    if (timesPerPeriod > 1) '$timesPerPeriod times $frequency' else frequency,
    if (intervalCount > 1) 'every $intervalCount periods',
  ].join(', ');
}

List<TaskRef> _refs(Object? list) => [
  for (final e in list as List)
    TaskRef((e as Map<String, dynamic>)['id'] as String, e['title'] as String),
];

class DailyReview {
  DailyReview({
    required this.completed,
    required this.missed,
    required this.carried,
    required this.changed,
  });

  factory DailyReview.fromJson(Map<String, dynamic> json) => DailyReview(
    completed: _refs(json['completed']),
    missed: _refs(json['missed']),
    carried: _refs(json['carried']),
    changed: _refs(json['changed']),
  );

  final List<TaskRef> completed;
  final List<TaskRef> missed;
  final List<TaskRef> carried;
  final List<TaskRef> changed;

  bool get empty =>
      completed.isEmpty && missed.isEmpty && carried.isEmpty && changed.isEmpty;
}

class WeeklyReview {
  WeeklyReview({
    required this.startDate,
    required this.endDate,
    required this.goals,
    required this.deadlines,
    required this.postponed,
    required this.insights,
  });

  factory WeeklyReview.fromJson(Map<String, dynamic> json) => WeeklyReview(
    startDate: DateTime.parse(json['startDate'] as String),
    endDate: DateTime.parse(json['endDate'] as String),
    goals: [
      for (final g in json['goals'] as List)
        (
          title: (g as Map<String, dynamic>)['title'] as String,
          completed: g['completed'] as int,
        ),
    ],
    deadlines: [
      for (final d in json['deadlines'] as List)
        (
          ref: TaskRef(
            (d as Map<String, dynamic>)['id'] as String,
            d['title'] as String,
          ),
          dueAt: _date(d['dueAt']),
        ),
    ],
    postponed: [
      for (final p in json['postponed'] as List)
        (
          ref: TaskRef(
            (p as Map<String, dynamic>)['id'] as String,
            p['title'] as String,
          ),
          times: p['times'] as int,
        ),
    ],
    insights: [
      for (final i in json['insights'] as List)
        (i as Map<String, dynamic>)['message'] as String,
    ],
  );

  final DateTime startDate;
  final DateTime endDate;
  final List<({String title, int completed})> goals;
  final List<({TaskRef ref, DateTime? dueAt})> deadlines;
  final List<({TaskRef ref, int times})> postponed;
  final List<String> insights;
}

class CalendarEvent {
  CalendarEvent({
    required this.title,
    required this.startsAt,
    required this.endsAt,
    required this.allDay,
  });

  factory CalendarEvent.fromJson(Map<String, dynamic> json) => CalendarEvent(
    title: json['title'] as String,
    startsAt: DateTime.parse(json['startsAt'] as String).toLocal(),
    endsAt: DateTime.parse(json['endsAt'] as String).toLocal(),
    allDay: json['allDay'] as bool,
  );

  final String title;
  final DateTime startsAt;
  final DateTime endsAt;
  final bool allDay;

  int get minutes => endsAt.difference(startsAt).inMinutes;
}

/// A connected calendar; its private address never leaves the server.
class ConnectedCalendar {
  ConnectedCalendar({required this.id, required this.label, this.error});

  factory ConnectedCalendar.fromJson(Map<String, dynamic> json) =>
      ConnectedCalendar(
        id: json['id'] as String,
        label: json['label'] as String,
        error: json['error'] as String?,
      );

  final String id;
  final String label;

  /// Why the last refresh failed, if it did.
  final String? error;
}
