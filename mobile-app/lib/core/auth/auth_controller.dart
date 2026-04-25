import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config.dart';

enum UserRole { admin, worker, customer, unknown }

UserRole roleFrom(String? s) {
  switch (s) {
    case 'ADMIN':
      return UserRole.admin;
    case 'WORKER':
      return UserRole.worker;
    case 'CUSTOMER':
      return UserRole.customer;
    default:
      return UserRole.unknown;
  }
}

class AuthUser {
  final String id;
  final String email;
  final String name;
  final UserRole role;

  AuthUser({required this.id, required this.email, required this.name, required this.role});

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id'] as String,
        email: j['email'] as String,
        name: j['name'] as String,
        role: roleFrom(j['role'] as String?),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'role': role.name.toUpperCase(),
      };
}

class AuthState {
  final String? token;
  final AuthUser? user;
  final bool loading;
  final String? error;

  const AuthState({this.token, this.user, this.loading = false, this.error});

  AuthState copyWith({String? token, AuthUser? user, bool? loading, String? error, bool clearError = false}) =>
      AuthState(
        token: token ?? this.token,
        user: user ?? this.user,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );
}

class AuthController extends StateNotifier<AuthState> {
  AuthController() : super(const AuthState());

  static const _kToken = 'auth.token';
  static const _kUser = 'auth.user';

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_kToken);
    final userJson = prefs.getString(_kUser);
    if (token != null && userJson != null) {
      state = state.copyWith(token: token, user: AuthUser.fromJson(jsonDecode(userJson)));
    }
  }

  Future<bool> login(String email, String password) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final dio = Dio(BaseOptions(baseUrl: '$kApiBaseUrl/api'));
      final r = await dio.post('/auth/login', data: {'email': email, 'password': password});
      final token = r.data['token'] as String;
      final user = AuthUser.fromJson(r.data['user'] as Map<String, dynamic>);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kToken, token);
      await prefs.setString(_kUser, jsonEncode(user.toJson()));
      state = AuthState(token: token, user: user);
      return true;
    } on DioException catch (e) {
      state = state.copyWith(
        loading: false,
        error: (e.response?.data?['error'] as String?) ?? 'Login failed',
      );
      return false;
    } catch (e) {
      state = state.copyWith(loading: false, error: 'Network error');
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String name,
    String? phone,
    String role = 'CUSTOMER',
  }) async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final dio = Dio(BaseOptions(baseUrl: '$kApiBaseUrl/api'));
      final r = await dio.post('/auth/register', data: {
        'email': email,
        'password': password,
        'name': name,
        if (phone != null) 'phone': phone,
        'role': role,
      });
      final token = r.data['token'] as String;
      final user = AuthUser.fromJson(r.data['user'] as Map<String, dynamic>);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kToken, token);
      await prefs.setString(_kUser, jsonEncode(user.toJson()));
      state = AuthState(token: token, user: user);
      return true;
    } on DioException catch (e) {
      state = state.copyWith(
        loading: false,
        error: (e.response?.data?['error'] as String?) ?? 'Registration failed',
      );
      return false;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kToken);
    await prefs.remove(_kUser);
    state = const AuthState();
  }
}

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(),
);
