import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../shared/widgets/async_view.dart';
import '../../shared/widgets/status_chip.dart';
import '../worker_providers.dart';
import 'order_detail_page.dart';

class WorkerOrdersPage extends ConsumerWidget {
  const WorkerOrdersPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(workerOrdersProvider);
    return AsyncView(
      value: orders,
      onRefresh: () async {
        ref.invalidate(workerOrdersProvider);
        await ref.read(workerOrdersProvider.future);
      },
      builder: (list) {
        if (list.isEmpty) {
          return ListView(
            children: const [
              SizedBox(height: 120),
              Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'No orders assigned to you yet.\nAn admin can assign orders from the web panel.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.black54),
                  ),
                ),
              ),
            ],
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: list.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (_, i) {
            final o = list[i];
            final cuisines = (o['cuisines'] as List?) ?? const [];
            final totalPlates = cuisines.fold<int>(
                0, (s, c) => s + ((c as Map)['plates'] as int? ?? 0));
            final scheduledFor = o['scheduledFor'] != null
                ? DateTime.parse(o['scheduledFor'] as String).toLocal()
                : null;
            final whenText = scheduledFor != null
                ? DateFormat('EEE MMM d, HH:mm').format(scheduledFor)
                : 'Not scheduled';
            final loc = (o['location'] as String?) ?? '';
            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade300),
              ),
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                title: Text(
                  o['orderNumber'] as String,
                  style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600),
                ),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${cuisines.length} cuisine${cuisines.length == 1 ? '' : 's'} · $totalPlates plates',
                        style: const TextStyle(fontSize: 12),
                      ),
                      const SizedBox(height: 2),
                      Text(whenText,
                          style: const TextStyle(fontSize: 11, color: Colors.black54)),
                      if (loc.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Row(
                            children: [
                              const Icon(Icons.location_on,
                                  size: 12, color: Colors.black54),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  loc,
                                  style: const TextStyle(fontSize: 11, color: Colors.black54),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                trailing: StatusChip(o['status'] as String),
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => OrderDetailPage(orderId: o['id'] as String, allowStatusUpdate: true),
                    ),
                  );
                },
              ),
            );
          },
        );
      },
    );
  }
}
