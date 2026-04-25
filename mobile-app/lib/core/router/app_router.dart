import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../auth/auth_controller.dart';
import '../../features/auth/login_page.dart';
import '../../features/auth/register_page.dart';
import '../../features/worker/worker_shell.dart';
import '../../features/customer/customer_shell.dart';
import '../../features/shared/blocked_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final refresh = _AuthRefresh(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, st) {
      final auth = ref.read(authControllerProvider);
      final loggedIn = auth.token != null && auth.user != null;
      final loc = st.matchedLocation;

      if (!loggedIn) {
        if (loc == '/login' || loc == '/register') return null;
        return '/login';
      }
      if (loc == '/login' || loc == '/register') {
        return _homeFor(auth.user!.role);
      }
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginPage()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterPage()),
      GoRoute(path: '/worker', builder: (_, __) => const WorkerShell()),
      GoRoute(path: '/customer', builder: (_, __) => const CustomerShell()),
      GoRoute(path: '/blocked', builder: (_, __) => const BlockedPage()),
      GoRoute(
        path: '/',
        redirect: (_, __) {
          final u = ref.read(authControllerProvider).user;
          if (u == null) return '/login';
          return _homeFor(u.role);
        },
      ),
    ],
  );
});

String _homeFor(UserRole role) {
  switch (role) {
    case UserRole.worker:
      return '/worker';
    case UserRole.customer:
      return '/customer';
    default:
      return '/blocked';
  }
}

class _AuthRefresh extends ChangeNotifier {
  late final ProviderSubscription<AuthState> _sub;
  _AuthRefresh(Ref ref) {
    _sub = ref.listen<AuthState>(authControllerProvider, (_, __) => notifyListeners());
  }

  @override
  void dispose() {
    _sub.close();
    super.dispose();
  }
}
