import 'package:taskmaster/api/client.dart';
import 'package:taskmaster/api/models.dart';
import 'package:taskmaster/api/offline.dart';
import 'package:taskmaster/auth/auth_gateway.dart';
import 'package:taskmaster/state/dictation.dart';
import 'package:taskmaster/state/reminders.dart';

/// A /api/v1/today body exactly as the server sends it (keep in step with
/// packages/api-contract/openapi.yaml and apps/web/app/api/v1/today).
Map<String, dynamic> todayJson({
  bool overridden = false,
  bool decisions = false,
  bool recovered = false,
}) => {
  'onboarded': true,
  'date': '2026-10-12',
  'greeting': 'Good morning',
  'firstName': 'Jerry',
  'stats': {'active': 12, 'dueToday': 4, 'completedToday': 2, 'inbox': 1},
  'recommendation': {
    'task': task('t1', 'Finalise project proposal', priority: 5),
    'message': 'Finalise project proposal next — it\'s due today.',
    'reasons': ['it\'s due today'],
    'overridden': overridden,
  },
  'plan': [
    {
      'task': task('t1', 'Finalise project proposal', priority: 5),
      'position': 0,
      'minutes': 60,
      'estimateIsDefault': false,
      'protected': false,
      'scheduledStart': '2026-10-12T09:00:00.000Z',
      'scheduledEnd': '2026-10-12T10:00:00.000Z',
    },
    {
      'task': task('t2', 'Review website designs', priority: 3),
      'position': 1,
      'minutes': 30,
      'estimateIsDefault': true,
      'protected': false,
      'scheduledStart': '2099-10-12T11:00:00.000Z',
      'scheduledEnd': '2099-10-12T11:30:00.000Z',
    },
  ],
  'capacity': {
    'plannedMinutes': 90,
    'availableMinutes': 240,
    'usableMinutes': 192,
    'overloaded': false,
  },
  'projects': [
    {'id': 'p1', 'name': 'Website redesign', 'done': 8, 'total': 12},
  ],
  'settings': {'dayMinutes': 240, 'availableMinutes': null, 'energy': null},
  'recovery': [
    if (decisions && !recovered)
      {
        'id': 'r1',
        'taskId': 't9',
        'title': 'Reply to the landlord',
        'scheduledEnd': '2026-10-12T08:00:00.000Z',
      },
  ],
  'realityCheck': decisions
      ? {
          'workMinutes': 300,
          'usableMinutes': 192,
          'excessMinutes': 108,
          'tasks': [
            {'id': 't1', 'title': 'Finalise project proposal', 'minutes': 60},
          ],
        }
      : null,
  'procrastination': [
    if (decisions) {'taskId': 't3', 'title': 'Update launch checklist'},
  ],
  'meetingMinutes': 60,
  'learned': {
    'factor': 1.4,
    'typicalMinutes': 35,
    'samples': 8,
    'summary': 'Your tasks usually take about 1.4× your estimate, so the plan allows for that.',
  },
  'followUps': [
    if (decisions)
      {
        ...task('w2', 'Contract from the landlord'),
        'waitingOn': 'Letting agent',
        'followUpAt': '2026-10-11T09:00:00.000Z',
      },
  ],
  'events': [
    {
      'title': 'Company holiday',
      'startsAt': '2026-10-12T00:00:00.000Z',
      'endsAt': '2026-10-13T00:00:00.000Z',
      'allDay': true,
    },
    {
      'title': 'Design review',
      'startsAt': '2099-10-12T13:00:00.000Z',
      'endsAt': '2099-10-12T14:00:00.000Z',
      'allDay': false,
    },
  ],
  'attention': {
    'recovery': decisions && !recovered ? 1 : 0,
    'realityCheck': decisions,
  },
};

Map<String, dynamic> task(String id, String title, {int? priority}) => {
  'id': id,
  'title': title,
  'status': 'todo',
  'priority': priority,
  'dueAt': '2026-10-12T10:00:00.000Z',
  'estimatedMinutes': 60,
  'project': {'id': 'p1', 'name': 'Website redesign'},
};

class FakeApi implements TaskMasterApi {
  FakeApi({this.onboarded = true, this.decisions = false});

  @override
  final connection = Connection();

  int offlineCleared = 0;

  @override
  Future<void> clearOfflineData() async => offlineCleared++;

  /// Flips to true when a Brain Dump is committed, like the server.
  bool onboarded;

  /// Today asks for recovery, a Reality Check and a procrastination nudge.
  bool decisions;
  final calls = <String>[];
  final recovered = <Map<String, RecoveryChoice>>[];
  final updates = <Map<String, Object?>>[];
  final brokenDown = <List<String>>[];
  final organised = <(List<String>, String?)>[];
  final goalsCreated = <String>[];
  String? deletedWith;
  final connectedCalendars = <String>[];
  bool hasPassword = true;
  final statusCalls = <(String, TaskStatus)>[];
  final added = <(String, String?)>[];
  final committed = <List<String>>[];
  final planRequests = <String>[];
  final applied = <List<String>>[];
  bool expired = false;

  @override
  Future<Me> me() async => Me(
    id: 'u1',
    name: 'Jerry Mbawa',
    email: 'jerry@example.com',
    timeZone: 'Europe/London',
    onboarded: onboarded,
    hasPassword: hasPassword,
  );

  @override
  Future<Today> today() async {
    if (expired) throw ApiException(401, 'Unauthorized');
    if (!onboarded) {
      return Today.fromJson({
        'onboarded': false,
        'greeting': 'Good morning',
        'firstName': 'Jerry',
      });
    }
    return Today.fromJson(
      todayJson(decisions: decisions, recovered: recovered.isNotEmpty),
    );
  }

  @override
  Future<List<Task>> tasks(TaskView view) async => [
    if (view == TaskView.waiting)
      Task.fromJson({
        ...task('w1', 'Get sign-off on the budget'),
        'waitingOn': 'Sam',
        'followUpAt': '2099-01-01T09:00:00.000Z',
      })
    else if (view == TaskView.inbox) ...[
      Task.fromJson(task('i1', 'Buy stamps')),
      Task.fromJson(task('i2', 'Water plants')),
    ] else ...[
      Task.fromJson(task('t1', 'Finalise project proposal', priority: 5)),
      if (view != TaskView.today)
        Task.fromJson(task('t3', 'Update launch checklist', priority: 1)),
    ],
  ];

  @override
  Future<Task> quickAdd(
    String title, {
    String? projectId,
    String? goalId,
  }) async {
    added.add((title, projectId ?? goalId));
    return Task.fromJson(task('new', title));
  }

  @override
  Future<void> setStatus(String taskId, TaskStatus status) async =>
      statusCalls.add((taskId, status));

  @override
  Future<List<ProjectProgress>> projects() async => [
    ProjectProgress(id: 'p1', name: 'Website redesign', done: 8, total: 12),
  ];

  @override
  Future<ProjectDetail> project(String id) async => ProjectDetail.fromJson({
    'project': {'id': id, 'name': 'Website redesign', 'done': 8, 'total': 12},
    'inProgress': [task('t2', 'Review website designs', priority: 3)],
    'todo': [
      {
        ...task('t1', 'Finalise project proposal', priority: 5),
        'assigneeId': 'u2',
      },
    ],
    'postponed': <Object>[],
    'role': 'owner',
    'people': [
      {
        'id': 'u1',
        'name': 'Jerry Mbawa',
        'email': 'jerry@example.com',
        'role': 'owner',
        'isMe': true,
      },
      if (!removed.contains('u2'))
        {
          'id': 'u2',
          'name': 'Ada Lovelace',
          'email': 'ada@example.com',
          'role': 'member',
          'isMe': false,
        },
    ],
    'invites': [
      for (final email in invitedEmails)
        {
          'id': 'inv-$email',
          'email': email,
          'expiresAt': '2099-01-01T00:00:00Z',
        },
    ],
  });

  final invitedEmails = <String>[];
  final removed = <String>[];
  final answers = <(String, bool)>[];
  bool hasInvite = false;

  @override
  Future<List<Invitation>> invites() async => [
    if (hasInvite && answers.isEmpty)
      Invitation(id: 'inv1', projectName: 'Launch', inviterName: 'Olu Owner'),
  ];

  @override
  Future<String?> answerInvite(String id, {required bool accept}) async {
    answers.add((id, accept));
    return accept ? 'p-launch' : null;
  }

  @override
  Future<String> inviteToProject(String projectId, String email) async {
    if (email == 'jerry@example.com') throw ApiException(409, "That's you.");
    invitedEmails.add(email);
    return 'https://tasksmaster-ai.netlify.app/invites/abc123';
  }

  @override
  Future<void> withdrawInvite(String projectId, String inviteId) async =>
      invitedEmails.remove(inviteId.substring(4));

  @override
  Future<void> removeMember(String projectId, String memberId) async =>
      removed.add(memberId);

  @override
  Future<DumpProposal> createDump(String text) async => DumpProposal.fromJson({
    'dumpId': 'd1',
    'engine': 'heuristic',
    'notice': "Organised by TaskMaster's built-in rules — AI organising isn't set up.",
    'items': [
      for (final title in ['Finish the report', 'Book the dentist', 'Call Mum'])
        {
          'kind': 'task',
          'title': title,
          'deadline': null,
          'recurrence': null,
          'estimatedMinutes': null,
          'project': null,
        },
    ],
  });

  @override
  Future<void> commitDump(String dumpId, List<ProposedItem> items) async {
    committed.add([for (final item in items) item.title]);
    onboarded = true;
  }

  @override
  Future<PlannerProposal> proposePlan(
    String message,
    List<PlannerTurn> history,
  ) async {
    planRequests.add(message);
    return PlannerProposal.fromJson({
      'engine': 'ai',
      'reply':
          'Focused work this morning, your meeting at 14:00, then a buffer.',
      'blocks': [
        {
          'kind': 'task',
          'taskId': 't1',
          'title': 'Finalise project proposal',
          'project': 'Website redesign',
          'start': '09:00',
          'minutes': 60,
        },
        {
          'kind': 'event',
          'taskId': null,
          'title': 'Team meeting',
          'project': null,
          'start': '14:00',
          'minutes': 60,
        },
      ],
    });
  }

  @override
  Future<void> applyPlan(List<PlannerBlock> blocks) async =>
      applied.add([for (final b in blocks) b.taskId!]);

  @override
  Future<Me> updatePreferences(Map<String, Object?> changes) async {
    updates.add(changes);
    return Me.fromJson({
      'id': 'u1',
      'name': 'Jerry Mbawa',
      'email': 'jerry@example.com',
      'timeZone': 'Europe/London',
      'onboarded': true,
      'hasPassword': hasPassword,
      'preferences': {
        'timeZone': null,
        'dayMinutes': 240,
        'planMode': 'flexible',
        'notifications': 'important',
        ...changes,
      },
    });
  }

  @override
  Future<void> deleteAccount({String? password}) async {
    if (hasPassword && password != 'correct horse') {
      throw ApiException(
        400,
        'Could not delete the account. Check your password and try again.',
      );
    }
    deletedWith = password ?? 'google';
  }

  @override
  Future<void> rebuildToday(TodaySettings settings) async => calls.add(
    'rebuild ${settings.dayMinutes} ${settings.availableMinutes} '
    '${settings.energy}',
  );

  @override
  Future<void> chooseNext(String? taskId) async => calls.add('next $taskId');

  @override
  Future<void> recover(Map<String, RecoveryChoice> decisions) async {
    recovered.add(decisions);
  }

  @override
  Future<TaskDetail> taskDetail(String id) async => TaskDetail.fromJson({
    'task': {
      ...task(id, 'Finalise project proposal', priority: 5),
      'description': 'Send to Sam for sign-off',
      'importance': 4,
      'urgency': null,
      'energy': 'high',
      'goal': {'id': 'g1', 'title': 'Get promoted'},
      'parentTaskId': null,
    },
    'steps': [
      if (brokenDown.isNotEmpty)
        for (final (i, title) in brokenDown.last.indexed)
          {'id': 's$i', 'title': title, 'status': 'todo'},
    ],
    'suggestedSteps': brokenDown.isEmpty
        ? ['Gather what you need for the proposal', 'Draft the proposal']
        : <String>[],
    'canBreakDown': brokenDown.isEmpty,
    'history': [
      {'type': 'created', 'toStatus': 'todo', 'at': '2026-10-10T09:00:00Z'},
    ],
    'projects': [
      {'id': 'p1', 'name': 'Website redesign'},
    ],
    'goals': [
      {'id': 'g1', 'title': 'Get promoted'},
    ],
  });

  @override
  Future<void> updateTask(String id, Map<String, Object?> changes) async =>
      updates.add({'id': id, ...changes});

  @override
  Future<void> deleteTask(String id) async => calls.add('delete $id');

  @override
  Future<void> breakDown(String id, List<String> steps) async =>
      brokenDown.add(steps);

  @override
  Future<int> organiseInbox(List<String> ids, {String? project}) async {
    organised.add((ids, project));
    return ids.length;
  }

  @override
  Future<List<Goal>> goals() async => [
    Goal.fromJson({
      'id': 'g1',
      'title': 'Get promoted',
      'targetDate': '2027-03-31',
      'linked': 2,
      'active': 1,
      'completed': 1,
      'nudge': null,
      'tasks': [task('t1', 'Finalise project proposal')],
    }),
    for (final title in ['Learn Spanish', ...goalsCreated])
      Goal.fromJson({
        'id': 'g-$title',
        'title': title,
        'targetDate': null,
        'linked': 0,
        'active': 0,
        'completed': 0,
        'nudge': 'unlinked',
        'tasks': <Object>[],
      }),
  ];

  @override
  Future<void> createGoal(String title, {DateTime? targetDate}) async =>
      goalsCreated.add(title);

  final savedSteps = <List<String>>[];

  @override
  Future<StepSuggestion> suggestGoalSteps(String goalId) async =>
      StepSuggestion.fromJson({
        'engine': 'ai',
        'reply': 'Start small and build the habit.',
        'steps': [
          {'title': 'Choose a course', 'estimatedMinutes': 30},
          {'title': 'Book a first lesson', 'estimatedMinutes': 15},
          {'title': 'Practise for 20 minutes', 'estimatedMinutes': 20},
        ],
      });

  @override
  Future<void> saveGoalSteps(
    String goalId,
    List<({String title, int? estimatedMinutes})> steps,
  ) async => savedSteps.add([for (final s in steps) s.title]);

  @override
  Future<List<Responsibility>> responsibilities() async => [
    Responsibility.fromJson({
      'id': 'rr1',
      'title': 'Go to the gym',
      'frequency': 'weekly',
      'intervalCount': 1,
      'timesPerPeriod': 3,
      'endDate': null,
      'stopped': calls.contains('stop rr1'),
      'upcoming': [
        {
          'id': 'o1',
          'title': 'Go to the gym',
          'status': 'todo',
          'date': '2026-10-13',
        },
      ],
    }),
  ];

  @override
  Future<void> stopResponsibility(String id) async => calls.add('stop $id');

  @override
  Future<DailyReview> dailyReview() async => DailyReview.fromJson({
    'date': '2026-10-12',
    'completed': [
      {'id': 't2', 'title': 'Review website designs'},
    ],
    'missed': <Object>[],
    'carried': [
      {'id': 't3', 'title': 'Update launch checklist', 'status': 'todo'},
    ],
    'changed': <Object>[],
  });

  @override
  Future<WeeklyReview> weeklyReview() async => WeeklyReview.fromJson({
    'startDate': '2026-10-12',
    'endDate': '2026-10-18',
    'goals': [
      {'id': 'g1', 'title': 'Get promoted', 'completed': 1},
    ],
    'deadlines': [
      {
        'id': 't1',
        'title': 'Finalise project proposal',
        'dueAt': '2026-10-14T16:00:00Z',
      },
    ],
    'postponed': [
      {'id': 't3', 'title': 'Update launch checklist', 'times': 3},
    ],
    'insights': [
      {
        'kind': 'repeated_postponement',
        'message': 'Update launch checklist moved 3 times.',
      },
    ],
  });

  @override
  Future<List<ConnectedCalendar>> calendars() async => [
    for (final (i, label) in connectedCalendars.indexed)
      ConnectedCalendar(id: 'c$i', label: label),
  ];

  @override
  Future<int> connectCalendar(String url) async {
    if (!url.startsWith('https://') && !url.startsWith('webcal://')) {
      throw ApiException(
        422,
        "Use the calendar's https:// or webcal:// address.",
      );
    }
    connectedCalendars.add('Google Calendar');
    return 12;
  }

  @override
  Future<void> disconnectCalendar(String id) async =>
      connectedCalendars.removeAt(int.parse(id.substring(1)));
}

/// Supabase Auth stand-in: signs in unless told the password is wrong.
class FakeAuth implements AuthGateway {
  FakeAuth({this.signedIn = false});
  bool signedIn;
  bool rejectPassword = false;
  bool google = false;
  bool cancelGoogle = false;
  int googleCalls = 0;

  @override
  bool get googleAvailable => google;

  @override
  Future<void> signInWithGoogle() async {
    googleCalls++;
    if (cancelGoogle) throw SignInCancelled();
    signedIn = true;
  }

  @override
  bool get hasSession => signedIn;

  @override
  String? get accessToken => signedIn ? 'token-123' : null;

  @override
  Future<void> signIn(String email, String password) async {
    if (rejectPassword) {
      throw SignInException('That email and password don’t match an account.');
    }
    signedIn = true;
  }

  @override
  Future<void> signOut() async => signedIn = false;
}

/// Records what the app asked of reminders.
class RecordingReminders implements Reminders {
  final synced = <bool>[];
  int cleared = 0;

  @override
  Future<void> sync(Today today, {required bool enabled}) async =>
      synced.add(enabled);

  @override
  Future<void> clear() async => cleared++;
}

/// Speaks the given phrases, one per call to [say].
class FakeDictation implements Dictation {
  void Function(String words)? _onWords;
  void Function()? _onDone;
  bool listening = false;

  void say(String words) => _onWords?.call(words);

  @override
  Future<bool> start({
    required void Function(String words) onWords,
    required void Function() onDone,
    required void Function(String message) onError,
  }) async {
    _onWords = onWords;
    _onDone = onDone;
    listening = true;
    return true;
  }

  @override
  Future<void> stop() async {
    listening = false;
    _onDone?.call();
  }
}
