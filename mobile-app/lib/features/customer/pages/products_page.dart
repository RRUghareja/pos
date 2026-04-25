import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/api/api_client.dart';
import '../../shared/widgets/async_view.dart';
import '../customer_providers.dart';

class CustomerProductsPage extends ConsumerStatefulWidget {
  const CustomerProductsPage({super.key});

  @override
  ConsumerState<CustomerProductsPage> createState() => _CustomerProductsPageState();
}

class _CustomerProductsPageState extends ConsumerState<CustomerProductsPage> {
  String _query = '';
  String _category = 'All';

  @override
  Widget build(BuildContext context) {
    final products = ref.watch(productsProvider(_query.isEmpty ? null : _query));
    final cart = ref.watch(cartProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search products',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
            ),
            onChanged: (v) => setState(() => _query = v),
          ),
        ),
        products.maybeWhen(
          data: (items) {
            final cats = <String>{'All', ...items.map((p) => (p['category'] as String?) ?? 'Other')};
            return SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: cats
                    .map((c) => Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(c),
                            selected: _category == c,
                            onSelected: (_) => setState(() => _category = c),
                          ),
                        ))
                    .toList(),
              ),
            );
          },
          orElse: () => const SizedBox.shrink(),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: AsyncView(
            value: products,
            onRefresh: () async {
              ref.invalidate(productsProvider);
              await ref.read(productsProvider(_query.isEmpty ? null : _query).future);
            },
            builder: (items) {
              final filtered = _category == 'All'
                  ? items
                  : items.where((p) => (p['category'] as String?) == _category).toList();
              if (filtered.isEmpty) {
                return const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text('No products match your search.', style: TextStyle(color: Colors.black54)),
                  ),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final p = filtered[i];
                  final id = p['id'] as String;
                  final qty = cart[id] ?? 0;
                  return Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.grey.shade300),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      leading: CircleAvatar(
                        backgroundColor: Theme.of(context).colorScheme.secondaryContainer,
                        child: Text(
                          (p['name'] as String).isNotEmpty ? (p['name'] as String)[0] : '?',
                        ),
                      ),
                      title: Text(p['name'] as String,
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('\$${p['price']} · ${p['category'] ?? ''}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (qty > 0) ...[
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline),
                              onPressed: () => ref.read(cartProvider.notifier).remove(id),
                            ),
                            Text('$qty',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                          ],
                          IconButton(
                            icon: const Icon(Icons.add_circle),
                            color: Theme.of(context).colorScheme.primary,
                            onPressed: () => ref.read(cartProvider.notifier).add(id),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
        if (cart.isNotEmpty)
          _CheckoutBar(
            totalItems: cart.values.fold<int>(0, (a, b) => a + b),
            products: products.maybeWhen(data: (d) => d, orElse: () => []),
          ),
      ],
    );
  }
}

class _CheckoutBar extends ConsumerWidget {
  final int totalItems;
  final List<Map<String, dynamic>> products;
  const _CheckoutBar({required this.totalItems, required this.products});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    double total = 0;
    for (final p in products) {
      final qty = cart[p['id'] as String] ?? 0;
      if (qty > 0) {
        total += _num(p['price']) * qty;
      }
    }

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: SizedBox(
          height: 56,
          child: FilledButton.icon(
            onPressed: () async {
              final dio = ref.read(dioProvider);
              final messenger = ScaffoldMessenger.of(context);
              try {
                await dio.post('/orders', data: {
                  'items': cart.entries
                      .map((e) => {'productId': e.key, 'quantity': e.value})
                      .toList(),
                });
                ref.read(cartProvider.notifier).clear();
                ref.invalidate(customerOrdersProvider);
                messenger.showSnackBar(const SnackBar(content: Text('Order placed!')));
              } catch (e) {
                messenger.showSnackBar(SnackBar(content: Text('Failed: $e')));
              }
            },
            icon: const Icon(Icons.shopping_bag),
            label: Text('Place order ($totalItems items · \$${total.toStringAsFixed(2)})'),
          ),
        ),
      ),
    );
  }

  double _num(dynamic v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }
}
