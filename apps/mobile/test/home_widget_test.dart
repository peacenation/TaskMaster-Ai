import 'package:flutter_test/flutter_test.dart';
import 'package:taskmaster/api/models.dart';
import 'package:taskmaster/state/home_widget.dart';

import 'fakes.dart';

void main() {
  test('the widget shows the Next Best Action and progress', () {
    final data = widgetData(Today.fromJson(todayJson()));
    expect(data, {
      'kicker': 'NEXT BEST ACTION',
      'next_title': 'Finalise project proposal',
      'next_detail': 'Website redesign',
      'progress': '2 of 4 done today',
    });
  });

  test('the widget marks your own choice, and invites a first Brain Dump', () {
    expect(
      widgetData(Today.fromJson(todayJson(overridden: true)))['kicker'],
      'YOUR CHOICE',
    );
    final fresh = widgetData(
      Today.fromJson({'onboarded': false, 'greeting': 'Hi', 'firstName': 'Jo'}),
    );
    expect(fresh['next_title'], 'Plan your day with a Brain Dump');
    expect(fresh['progress'], isNull);
  });
}
