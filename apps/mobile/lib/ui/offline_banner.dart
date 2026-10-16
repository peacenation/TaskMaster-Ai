import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../state/session.dart';
import '../theme/tokens.dart';

/// Shown while TaskMasterAi can't be reached: what's on screen is the last
/// copy this phone saw, and any offline captures are waiting to sync.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final connection = SessionScope.of(context).api.connection;
    return ListenableBuilder(
      listenable: connection,
      builder: (context, _) {
        final pending = connection.pending;
        if (!connection.offline && pending == 0) return const SizedBox.shrink();
        final tm = context.tm;
        final from = connection.showingDataFrom;
        final parts = [
          if (connection.offline)
            from == null
                ? 'You’re offline.'
                : 'You’re offline — showing what you had at '
                      '${DateFormat.Hm().format(from)}.',
          if (pending > 0)
            '$pending capture${pending == 1 ? '' : 's'} waiting to sync.',
        ];
        return Semantics(
          liveRegion: true,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: Tm.s4,
              vertical: Tm.s2,
            ),
            color: tm.sunken,
            child: Row(
              children: [
                Icon(
                  connection.offline ? Icons.cloud_off : Icons.cloud_upload,
                  size: 18,
                  color: tm.textMuted,
                ),
                const SizedBox(width: Tm.s2),
                Expanded(
                  child: Text(
                    parts.join(' '),
                    style: TextStyle(color: tm.textMuted, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
