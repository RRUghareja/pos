import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/api/api_client.dart';
import '../../shared/widgets/async_view.dart';
import '../worker_providers.dart';

class WorkerHomePage extends ConsumerWidget {
  const WorkerHomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(attendanceSummaryProvider);
    final history = ref.watch(attendanceHistoryProvider);

    return AsyncView(
      value: summary,
      onRefresh: () async {
        ref.invalidate(attendanceSummaryProvider);
        ref.invalidate(attendanceHistoryProvider);
        await ref.read(attendanceSummaryProvider.future);
      },
      builder: (data) {
        final worker = data['worker'] as Map<String, dynamic>;
        final open = data['openAttendance'] as Map<String, dynamic>?;
        final today = data['today'] as Map<String, dynamic>;
        final week = data['week'] as Map<String, dynamic>;
        final month = data['month'] as Map<String, dynamic>;
        final isOpen = open != null;

        final historyList = history.maybeWhen(
          data: (d) => (d['attendances'] as List).cast<Map<String, dynamic>>(),
          orElse: () => <Map<String, dynamic>>[],
        );

        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _ClockCard(
              isOpen: isOpen,
              openSince: isOpen ? DateTime.parse(open['checkIn'] as String).toLocal() : null,
              onCheckIn: () => _doCheck(context, ref, '/attendance/check-in', 'Checked in'),
              onCheckOut: () => _doCheck(context, ref, '/attendance/check-out', 'Checked out'),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _StatTile(
                    label: 'Today',
                    value: '${today['hours']} h',
                    sub: '\$${today['earnings']}',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _StatTile(
                    label: 'This week',
                    value: '${week['hours']} h',
                    sub: '\$${week['earnings']}',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _StatTile(
              label: 'This month',
              value: '${month['hours']} h · ${month['days']} days',
              sub: 'Earnings so far: \$${month['earnings']}',
              wide: true,
            ),
            const SizedBox(height: 20),
            Text(
              'Salary rate: \$${worker['salaryRate']} / ${worker['salaryType'] == 'HOURLY' ? 'hour' : 'day'}',
              style: const TextStyle(fontSize: 13, color: Colors.black54),
            ),
            const SizedBox(height: 24),
            const Text('Recent attendance',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            if (historyList.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Text('No attendance records yet.', style: TextStyle(color: Colors.black54)),
              ),
            ...historyList.take(10).map((a) => _AttendanceTile(a)),
          ],
        );
      },
    );
  }

  Future<void> _doCheck(BuildContext context, WidgetRef ref, String path, String ok) async {
    final dio = ref.read(dioProvider);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await dio.post(path);
      ref.invalidate(attendanceSummaryProvider);
      ref.invalidate(attendanceHistoryProvider);
      messenger.showSnackBar(SnackBar(content: Text(ok)));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }
}

class _ClockCard extends StatelessWidget {
  final bool isOpen;
  final DateTime? openSince;
  final VoidCallback onCheckIn;
  final VoidCallback onCheckOut;
  const _ClockCard({
    required this.isOpen,
    required this.openSince,
    required this.onCheckIn,
    required this.onCheckOut,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: isOpen ? Colors.green.shade50 : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: isOpen ? Colors.green.shade200 : Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Icon(
                  isOpen ? Icons.timer : Icons.access_time,
                  color: isOpen ? Colors.green.shade700 : Colors.black54,
                ),
                const SizedBox(width: 8),
                Text(
                  isOpen ? 'Currently checked in' : 'Not checked in',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            if (openSince != null) ...[
              const SizedBox(height: 6),
              Text('Since ${DateFormat('MMM d, HH:mm').format(openSince!)}',
                  style: const TextStyle(color: Colors.black54)),
            ],
            const SizedBox(height: 16),
            SizedBox(
              height: 52,
              child: isOpen
                  ? FilledButton.tonalIcon(
                      onPressed: onCheckOut,
                      icon: const Icon(Icons.logout),
                      label: const Text('Check out'),
                    )
                  : FilledButton.icon(
                      onPressed: onCheckIn,
                      icon: const Icon(Icons.login),
                      label: const Text('Check in'),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label;
  final String value;
  final String sub;
  final bool wide;
  const _StatTile({required this.label, required this.value, required this.sub, this.wide = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(sub, style: const TextStyle(fontSize: 13, color: Colors.black87)),
        ],
      ),
    );
  }
}

class _AttendanceTile extends StatelessWidget {
  final Map<String, dynamic> a;
  const _AttendanceTile(this.a);

  @override
  Widget build(BuildContext context) {
    final checkIn = DateTime.parse(a['checkIn'] as String).toLocal();
    final checkOut = a['checkOut'] != null ? DateTime.parse(a['checkOut'] as String).toLocal() : null;
    final df = DateFormat('MMM d, HH:mm');
    String hours = '—';
    if (checkOut != null) {
      final h = checkOut.difference(checkIn).inMinutes / 60.0 - ((a['breakMins'] ?? 0) as int) / 60.0;
      hours = h.toStringAsFixed(2);
    }
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: ListTile(
        leading: Icon(checkOut == null ? Icons.timer : Icons.check_circle_outline),
        title: Text(df.format(checkIn)),
        subtitle: Text(checkOut != null ? 'Out: ${df.format(checkOut)}' : 'Still checked in'),
        trailing: Text('$hours h'),
      ),
    );
  }
}
