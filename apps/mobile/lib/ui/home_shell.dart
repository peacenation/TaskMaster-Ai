import 'package:flutter/material.dart';

import 'offline_banner.dart';
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
  final _pages = PageController();
  int _index = 0;
  int _todayGeneration = 0;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  /// Tapping a tab slides to it, like swiping does.
  void _select(int i) {
    if (i == _index) return;
    _pages.animateToPage(
      i,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  void _settled(int i) => setState(() {
    // Today reloads when you come back to it: other tabs change what it shows.
    if (i == 0 && _index != 0) _todayGeneration++;
    _index = i;
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
          // Swipe left/right between tabs; each page stays alive, so its
          // scroll position and loaded data survive the swipe.
          child: Column(
            children: [
              const OfflineBanner(),
              Expanded(
                child: PageView(
                  controller: _pages,
                  onPageChanged: _settled,
                  children: [for (final tab in tabs) _KeepAlive(child: tab)],
                ),
              ),
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

class _KeepAlive extends StatefulWidget {
  const _KeepAlive({required this.child});
  final Widget child;

  @override
  State<_KeepAlive> createState() => _KeepAliveState();
}

class _KeepAliveState extends State<_KeepAlive>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return widget.child;
  }
}
