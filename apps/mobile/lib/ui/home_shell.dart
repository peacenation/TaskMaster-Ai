import 'package:flutter/material.dart';

import 'planner_screen.dart';
import 'projects_screen.dart';
import 'tasks_screen.dart';
import 'today_screen.dart';

enum AppTab { today, tasks, projects, ai }

/// Lets a screen switch tabs (e.g. Today's "View all" → Tasks).
class ShellTabs extends InheritedWidget {
  const ShellTabs({super.key, required this.select, required super.child});
  final void Function(AppTab tab) select;

  static void go(BuildContext context, AppTab tab) =>
      context.getInheritedWidgetOfExactType<ShellTabs>()?.select(tab);

  @override
  bool updateShouldNotify(ShellTabs oldWidget) => false;
}

/// Bottom navigation from the mobile concept: Today, Tasks, Projects, AI.
/// Tabs are built lazily and kept alive, so switching back doesn't refetch;
/// Today reloads when shown again, since other tabs change what it shows.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  final _visited = <int>{0};
  int _todayGeneration = 0;

  void _select(int i) => setState(() {
    if (i == 0 && _index != 0) _todayGeneration++;
    _index = i;
    _visited.add(i);
  });

  @override
  Widget build(BuildContext context) {
    final tabs = [
      TodayScreen(key: ValueKey(_todayGeneration)),
      const TasksScreen(),
      const ProjectsScreen(),
      const PlannerScreen(),
    ];
    return ShellTabs(
      select: (tab) => _select(tab.index),
      child: Scaffold(
        body: SafeArea(
          bottom: false,
          child: IndexedStack(
            index: _index,
            children: [
              for (var i = 0; i < tabs.length; i++)
                _visited.contains(i) ? tabs[i] : const SizedBox.shrink(),
            ],
          ),
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: _select,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home_rounded),
              label: 'Today',
            ),
            NavigationDestination(
              icon: Icon(Icons.check_box_outlined),
              selectedIcon: Icon(Icons.check_box_rounded),
              label: 'Tasks',
            ),
            NavigationDestination(
              icon: Icon(Icons.folder_outlined),
              selectedIcon: Icon(Icons.folder_rounded),
              label: 'Projects',
            ),
            NavigationDestination(
              icon: Icon(Icons.auto_awesome_outlined),
              selectedIcon: Icon(Icons.auto_awesome),
              label: 'AI',
            ),
          ],
        ),
      ),
    );
  }
}
