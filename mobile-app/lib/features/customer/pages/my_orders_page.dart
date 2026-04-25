import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/api/api_client.dart';
import '../../shared/widgets/async_view.dart';
import '../../shared/widgets/status_chip.dart';
import '../../worker/pages/order_detail_page.dart';
import '../customer_providers.dart';

class CustomerOrdersPage extends ConsumerWidget {
  const CustomerOrdersPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(customerOrdersProvider);
    return AsyncView(
      value: orders,
      onRefresh: () async {
        ref.invalidate(customerOrdersProvider);
        await ref.read(customerOrdersProvider.future);
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
                    'No orders yet.\nPlace your first order from the Products tab.',
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
            final createdAt = DateTime.parse(o['createdAt'] as String).toLocal();
            final canCancel = o['status'] == 'PENDING';
            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade300),
              ),
              child: Column(
                children: [
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    title: Text(
                      o['orderNumber'] as String,
                      style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.w600),
                    ),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        '${(o['items'] as List).length} items · \$${o['total']} · '
                        '${DateFormat('MMM d, HH:mm').format(createdAt)}',
                        style: const TextStyle(fontSize: 12),
                      ),
                    ),
                    trailing: StatusChip(o['status'] as String),
                    onTap: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => OrderDetailPage(orderId: o['id'] as String),
                        ),
                      );
                    },
                  ),
                  if (canCancel)
                    Align(
                      alignment: Alignment.centerRight,
                      child: Padding(
                        padding: const EdgeInsets.only(right: 8, bottom: 4),
                        child: TextButton(
                          onPressed: () => _cancel(context, ref, o['id'] as String),
                          child: const Text('Cancel', style: TextStyle(color: Colors.red)),
                        ),
                      ),
                    ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _cancel(BuildContext ctx, WidgetRef ref, String id) async {
    final messenger = ScaffoldMessenger.of(ctx);
    final confirmed = await showDialog<bool>(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Cancel order?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx, false), child: const Text('Keep')),
          FilledButton.tonal(
            onPressed: () => Navigator.pop(dialogCtx, true),
            child: const Text('Cancel order'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final dio = ref.read(dioProvider);
    try {
      await dio.patch('/orders/$id', data: {'status': 'CANCELLED'});
      ref.invalidate(customerOrdersProvider);
      messenger.showSnackBar(const SnackBar(content: Text('Order cancelled')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Failed: $e')));
    }
  }
}
