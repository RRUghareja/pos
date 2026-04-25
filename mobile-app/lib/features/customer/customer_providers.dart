import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';

final productsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String?>((ref, q) async {
  final dio = ref.watch(dioProvider);
  final r = await dio.get('/products', queryParameters: q == null || q.isEmpty ? null : {'q': q});
  return (r.data['products'] as List).cast<Map<String, dynamic>>();
});

final customerOrdersProvider = FutureProvider.autoDispose((ref) async {
  final dio = ref.watch(dioProvider);
  final r = await dio.get('/orders');
  return (r.data['orders'] as List).cast<Map<String, dynamic>>();
});

final customerMeProvider = FutureProvider.autoDispose((ref) async {
  final dio = ref.watch(dioProvider);
  final r = await dio.get('/customers/me');
  return r.data['customer'] as Map<String, dynamic>;
});

class CartNotifier extends StateNotifier<Map<String, int>> {
  CartNotifier() : super({});
  void add(String id) => state = {...state, id: (state[id] ?? 0) + 1};
  void remove(String id) {
    final cur = (state[id] ?? 0) - 1;
    final next = {...state};
    if (cur <= 0) {
      next.remove(id);
    } else {
      next[id] = cur;
    }
    state = next;
  }

  void clear() => state = {};
}

final cartProvider = StateNotifierProvider<CartNotifier, Map<String, int>>((ref) => CartNotifier());
