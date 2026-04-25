import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth/auth_controller.dart';
import '../../shared/widgets/async_view.dart';
import '../worker_providers.dart';

class WorkerProfilePage extends ConsumerWidget {
  const WorkerProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final summary = ref.watch(attendanceSummaryProvider);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SizedBox(height: 8),
        Center(
          child: CircleAvatar(
            radius: 40,
            backgroundColor: Theme.of(context).colorScheme.primaryContainer,
            child: Text(
              (user?.name.isNotEmpty ?? false) ? user!.name[0].toUpperCase() : '?',
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: Text(user?.name ?? '—',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        ),
        Center(child: Text(user?.email ?? '', style: const TextStyle(color: Colors.black54))),
        const SizedBox(height: 24),
        AsyncView(
          value: summary,
          builder: (data) {
            final w = data['worker'] as Map<String, dynamic>;
            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade300),
              ),
              child: Column(
                children: [
                  _row('Role', 'Worker'),
                  _row('Department', (w['department'] as String?) ?? '—'),
                  _row('Salary type',
                      w['salaryType'] == 'HOURLY' ? 'Hourly' : 'Daily'),
                  _row('Rate',
                      '\$${w['salaryRate']} / ${w['salaryType'] == 'HOURLY' ? 'hour' : 'day'}'),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 24),
        SizedBox(
          height: 52,
          child: FilledButton.tonalIcon(
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ),
      ],
    );
  }

  Widget _row(String k, String v) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          SizedBox(width: 120, child: Text(k, style: const TextStyle(color: Colors.black54))),
          Expanded(child: Text(v, style: const TextStyle(fontWeight: FontWeight.w500))),
        ],
      ),
    );
  }
}
