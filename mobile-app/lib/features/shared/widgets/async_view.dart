import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class AsyncView<T> extends StatelessWidget {
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final Future<void> Function()? onRefresh;

  const AsyncView({super.key, required this.value, required this.builder, this.onRefresh});

  @override
  Widget build(BuildContext context) {
    final child = value.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text('Something went wrong:\n$e', textAlign: TextAlign.center),
        ),
      ),
      data: builder,
    );
    if (onRefresh != null) {
      return RefreshIndicator(onRefresh: onRefresh!, child: child);
    }
    return child;
  }
}
