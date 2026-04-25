import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/api/api_client.dart';

final attendanceSummaryProvider = FutureProvider.autoDispose((ref) async {
  final dio = ref.watch(dioProvider);
  final r = await dio.get('/attendance/summary');
  return r.data as Map<String, dynamic>;
});

final attendanceHistoryProvider = FutureProvider.autoDispose((ref) async {
  final dio = ref.watch(dioProvider);
  final r = await dio.get('/attendance/me');
  return r.data as Map<String, dynamic>;
});

final workerOrdersProvider = FutureProvider.autoDispose((ref) async {
  final dio = ref.watch(dioProvider);
  final r = await dio.get('/orders');
  return (r.data['orders'] as List).cast<Map<String, dynamic>>();
});
