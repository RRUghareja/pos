import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../../core/auth/auth_controller.dart';
import '../../shared/widgets/async_view.dart';
import '../customer_providers.dart';

class CustomerProfilePage extends ConsumerWidget {
  const CustomerProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final me = ref.watch(customerMeProvider);

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
          value: me,
          builder: (data) {
            final u = data['user'] as Map<String, dynamic>;
            return Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade300),
              ),
              child: Column(
                children: [
                  _row('Role', 'Customer'),
                  _row('Phone', (u['phone'] as String?) ?? '—'),
                  _row('Address', (data['address'] as String?) ?? '—'),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: () => _showEdit(context, ref, me.value),
          icon: const Icon(Icons.edit),
          label: const Text('Edit profile'),
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

  void _showEdit(BuildContext context, WidgetRef ref, Map<String, dynamic>? me) {
    if (me == null) return;
    final user = me['user'] as Map<String, dynamic>;
    final name = TextEditingController(text: (user['name'] as String?) ?? '');
    final phone = TextEditingController(text: (user['phone'] as String?) ?? '');
    final address = TextEditingController(text: (me['address'] as String?) ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Edit profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
              const SizedBox(height: 16),
              TextField(controller: name, decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              TextField(controller: phone, decoration: const InputDecoration(labelText: 'Phone', border: OutlineInputBorder())),
              const SizedBox(height: 12),
              TextField(controller: address, decoration: const InputDecoration(labelText: 'Address', border: OutlineInputBorder())),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: FilledButton(
                  onPressed: () async {
                    final dio = ref.read(dioProvider);
                    final messenger = ScaffoldMessenger.of(ctx);
                    final nav = Navigator.of(ctx);
                    try {
                      await dio.patch('/customers/me', data: {
                        'name': name.text,
                        'phone': phone.text,
                        'address': address.text,
                      });
                      ref.invalidate(customerMeProvider);
                      nav.pop();
                      messenger.showSnackBar(const SnackBar(content: Text('Saved')));
                    } catch (e) {
                      messenger.showSnackBar(SnackBar(content: Text('Failed: $e')));
                    }
                  },
                  child: const Text('Save'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
