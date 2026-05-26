# 📱 IE402 Frontend Flutter - Phân Tích Cấu Trúc & Đề Xuất Cải Thiện

**Ngày phân tích**: 2026-05-25  
**Tính chất**: Hướng dẫn cấu trúc Frontend Flutter cho dự án IE402  
**Trạng thái hiện tại**: Prototype sơ khai  

---

## 📋 Mục lục

1. [Tình trạng hiện tại](#tình-trạng-hiện-tại)
2. [Cấu trúc frontend hiện có](#cấu-trúc-frontend-hiện-có)
3. [Best practices theo industry standard](#best-practices-theo-industry-standard)
4. [So sánh: Hiện tại vs Production-grade](#so-sánh-hiện-tại-vs-production-grade)
5. [Đề xuất cấu trúc mới](#đề-xuất-cấu-trúc-mới)
6. [Roadmap triển khai](#roadmap-triển-khai)

---

## 🔍 Tình trạng hiện tại

### 1.1. Cấu trúc thư mục thực tế

```
frontend/
├── pubspec.yaml                 ✅ Tồn tại
├── lib/
│   ├── main.dart               ✅ Tồn tại
│   └── screens/
│       └── map_screen.dart      ✅ Tồn tại (chủ yếu là API calls)
├── test/
│   └── widget_test.dart         ✅ Placeholder
├── android/, ios/, web/         ✅ Native project templates
└── build/                       ✅ Build artifacts

```

### 1.2. Dependencies hiện có

```yaml
dependencies:
  flutter: sdk
  cupertino_icons: ^1.0.2
  flutter_map: any              # Map display
  latlong2: any                  # Geolocation
  geolocator: ^14.0.2            # GPS/Location
  dio: any                       # HTTP client
  lucide_icons: any              # Icons
  socket_io_client: ^3.1.4       # Real-time updates

dev_dependencies:
  flutter_test: sdk
  flutter_lints: ^6.0.0
```

### 1.3. Các vấn đề hiện tại

| Vấn đề | Mức độ | Chi tiết |
|--------|-------|---------|
| **Không có state management** | 🔴 Critical | `map_screen.dart` dùng `setState()` - không scalable |
| **Không có layer separation** | 🔴 Critical | UI logic, API calls, models trộn lẫn trong 1 file |
| **Không có routing framework** | 🟡 High | Chỉ hard-coded `home: ShelterMapScreen()` |
| **Không có API client abstraction** | 🟡 High | API calls trực tiếp trong widget `initState()` |
| **Không có models/DTOs** | 🟡 High | Dữ liệu dùng `List<dynamic>` |
| **Không có error handling** | 🟡 High | Không xử lý exception, loading state |
| **Không có test** | 🟠 Medium | Chỉ có placeholder `widget_test.dart` |
| **Không có shared code** | 🟠 Medium | Không có utils, constants, theme |
| **Không có secure storage** | 🔴 Critical | JWT token không được lưu an toàn |
| **Không có form validation** | 🟡 High | Register/Login form chưa implement |

---

## 🏗️ Cấu trúc frontend hiện có

### 2.1. File `lib/main.dart` (20 dòng code)

```dart
import 'package:flutter/material.dart';
import 'screens/map_screen.dart';

void main() {
  runApp(const ShelterApp());
}

class ShelterApp extends StatelessWidget {
  const ShelterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Shelter',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.system,
      theme: ThemeData.light(),
      darkTheme: ThemeData.dark(),
      home: const ShelterMapScreen(),  // ❌ Hard-coded routing
    );
  }
}
```

**⚠️ Vấn đề:**
- Không có routing framework (Go Router, auto_route)
- Theme chưa được customize
- Không có dependency injection setup
- Không có error boundary

### 2.2. File `lib/screens/map_screen.dart` (150+ dòng code)

**Cấu trúc hiện tại:**

```dart
class ShelterMapScreen extends StatefulWidget { ... }

class _ShelterMapScreenState extends State<ShelterMapScreen> {
  // ❌ Tất cả logic trong 1 class:
  final MapController mapController = MapController();
  static const String baseUrl = 'http://10.0.2.2:3000/api/v1';
  final Dio dio = Dio(BaseOptions(baseUrl: baseUrl));
  
  List<dynamic> shelters = [];      // ❌ Dynamic, không type-safe
  List<dynamic> dangerZones = [];   // ❌ Dynamic, không type-safe
  bool isLoading = true;
  bool isEmergency = false;
  late IO.Socket socket;
  
  @override
  void initState() {
    super.initState();
    initLocationAndData();           // ❌ API call trong initState
    initSocket();
  }
  
  Future<void> initLocationAndData() { ... }
  Future<void> determinePosition() { ... }
  Future<void> fetchShelters() { ... }
  Future<void> fetchDangerZones() { ... }
  Future<void> initSocket() { ... }
  
  @override
  Widget build(BuildContext context) {
    // ❌ 200+ dòng UI code + business logic trộn lẫn
  }
}
```

**❌ Anti-patterns phát hiện:**

1. **Tất cả logic trong 1 file** - Không scalable
2. **setState() để quản lý state** - Không tự động rebuild các widget liên quan
3. **API call trong initState** - Khó test, reusable
4. **List<dynamic>** - Không type-safe, dễ bug
5. **Socket.io + Dio** - Không error handling
6. **GPS + Map + Socket** - Coupling quá chặt

---

## 📚 Best practices theo industry standard

### 3.1. Clean Architecture + Feature-first

**Nguyên tắc:**

```
lib/src/
├── features/                  # Mỗi feature là một "business domain"
│   ├── authentication/        # Login, Register, Auth management
│   ├── map/                   # Map display, shelter visualization
│   ├── shelter/               # Shelter management
│   ├── danger_zones/          # Danger zone management
│   ├── incident/              # Incident reporting
│   └── user/                  # User profile
├── common/                    # Shared code (widgets, utils, constants)
├── config/                    # App config, theme, routing
└── services/                  # Global services (API client, storage, logging)
```

Mỗi feature có cấu trúc **4 layers:**

```
features/map/
├── presentation/             # UI widgets, state management
│   ├── controllers/          # Riverpod providers, state logic
│   ├── widgets/              # Reusable widgets
│   └── pages/                # Full pages/screens
├── application/              # Business logic services (optional)
├── domain/                   # Models, entities, business rules
└── data/                     # API clients, repositories, DTOs
```

### 3.2. State Management Solutions

| Solution | Phức tạp | Scalability | Learning Curve | Production-ready |
|----------|---------|-------------|-----------------|------------------|
| **setState()** | 🟢 Thấp | 🔴 Poor | 🟢 Rất dễ | 🔴 No |
| **Riverpod** | 🟡 Medium | 🟢 Excellent | 🟡 Trung bình | 🟢 Yes |
| **BLoC** | 🟠 Cao | 🟢 Excellent | 🔴 Khó | 🟢 Yes |
| **GetX** | 🟡 Medium | 🟠 Good | 🟢 Dễ | 🟠 Caution |

**Khuyến nghị cho IE402:** **Riverpod** - lightweight, reactive, dễ học, scalable

### 3.3. Project Structure - Feature-first

```
lib/src/
├── features/
│   ├── authentication/
│   │   ├── data/
│   │   │   ├── datasources/
│   │   │   │   └── auth_remote_datasource.dart
│   │   │   ├── repositories/
│   │   │   │   └── auth_repository.dart
│   │   │   └── models/
│   │   │       └── auth_models.dart
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── user.dart
│   │   │   └── repositories/
│   │   │       └── auth_repository.dart
│   │   └── presentation/
│   │       ├── controllers/
│   │       │   └── auth_controller.dart
│   │       ├── pages/
│   │       │   ├── login_page.dart
│   │       │   └── register_page.dart
│   │       └── widgets/
│   │           └── login_form.dart
│   │
│   ├── map/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   │
│   └── ... (other features)
│
├── config/
│   ├── router/
│   │   └── app_router.dart
│   ├── theme/
│   │   ├── app_theme.dart
│   │   └── colors.dart
│   └── constants/
│       └── app_constants.dart
│
├── services/
│   ├── api/
│   │   ├── api_client.dart
│   │   └── interceptors.dart
│   ├── storage/
│   │   └── secure_storage_service.dart
│   └── location/
│       └── location_service.dart
│
├── common/
│   ├── widgets/
│   │   ├── loading_widget.dart
│   │   └── error_widget.dart
│   ├── extensions/
│   │   └── string_extensions.dart
│   └── utils/
│       └── logger.dart
│
└── main.dart
```

### 3.4. Key Dependencies cho Production

```yaml
dependencies:
  # State Management
  flutter_riverpod: ^2.4.0          # Reactive state management
  riverpod_annotation: ^2.1.0       # Annotations for generators
  
  # Networking
  dio: ^5.3.0                       # HTTP client
  dio_http_cache: ^7.0.0           # Caching
  
  # Routing
  go_router: ^10.0.0                # App routing
  
  # Storage
  flutter_secure_storage: ^9.0.0    # Secure token storage
  hive: ^2.2.0                      # Local database (optional)
  
  # Model serialization
  freezed_annotation: ^2.4.0        # Immutable models
  json_serializable: ^6.7.0         # JSON parsing
  
  # Location/Geolocation
  geolocator: ^14.0.2
  location: ^5.0.0
  
  # Maps
  flutter_map: ^6.0.0
  latlong2: ^0.9.0
  
  # UI Components
  cached_network_image: ^3.3.0      # Image caching
  shimmer: ^3.0.0                   # Loading skeleton
  
  # Logging & Error Handling
  logger: ^2.0.0                    # Structured logging
  sentry_flutter: ^7.10.0           # Error tracking (optional)

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^6.0.0
  
  # Code generation
  build_runner: ^2.4.0
  freezed: ^2.4.0
  json_serializable: ^6.7.0
  riverpod_generator: ^2.3.0
  
  # Testing
  mockito: ^3.0.0
  mocktail: ^1.0.0
```

---

## 📊 So sánh: Hiện tại vs Production-grade

### 4.1. Bảng so sánh chi tiết

| Tiêu chí | Hiện tại | Production-grade | Status |
|----------|---------|------------------|--------|
| **State Management** | `setState()` | Riverpod | 🔴 Cần cải thiện |
| **Architecture** | Monolithic | Clean Architecture + Feature-first | 🔴 Cần cải thiện |
| **Type Safety** | `List<dynamic>` | Strongly typed models | 🔴 Cần cải thiện |
| **Error Handling** | Không có | Try-catch + UI feedback | 🔴 Cần cải thiện |
| **API Client** | Direct Dio calls | Abstracted repository pattern | 🔴 Cần cải thiện |
| **Routing** | Hard-coded | Go Router with named routes | 🔴 Cần cải thiện |
| **Secure Storage** | Không có | flutter_secure_storage | 🔴 Cần cải thiện |
| **Testing** | Không có | Unit + Widget + Integration | 🔴 Cần cải thiện |
| **Logging** | `print()` | Structured logger | 🔴 Cần cải thiện |
| **Code Organization** | 1 file | Feature-based folders | 🔴 Cần cải thiện |

### 4.2. Code Quality Metrics

```
Metric                          | Hiện tại | Production-grade
---------------------------------------------------------
Cyclomatic Complexity (map_screen)  | 🔴 25+  | 🟢 <10
Test Coverage                       | 🔴 0%   | 🟢 >80%
Dependency Injection               | 🔴 No   | 🟢 Yes
Model Immutability                 | 🔴 No   | 🟢 Yes
Error Boundaries                   | 🔴 No   | 🟢 Yes
Widget Reusability                 | 🔴 Low  | 🟢 High
```

### 4.3. Vấn đề an toàn & bảo mật

| Vấn đề | Hiện tại | Production-grade |
|--------|---------|------------------|
| **JWT Token Storage** | Không lưu | Secure Storage (encrypted) |
| **Token Refresh** | N/A | Automatic refresh logic |
| **API Error Leakage** | Có (raw errors) | Sanitized errors |
| **Sensitive Data in Logs** | Có | Redacted logs |
| **SSL Pinning** | Không | Yes (Dio interceptor) |

---

## ✨ Đề xuất cấu trúc mới

### 5.1. Cấu trúc thư mục được khuyến nghị

```
frontend/lib/src/
│
├── config/
│   ├── router/
│   │   ├── app_router.dart         # Go Router setup
│   │   ├── route_names.dart        # Named routes
│   │   └── route_paths.dart        # Route paths
│   ├── theme/
│   │   ├── app_theme.dart
│   │   ├── app_colors.dart
│   │   └── app_text_styles.dart
│   └── constants/
│       ├── api_constants.dart
│       ├── app_constants.dart
│       └── strings.dart
│
├── services/
│   ├── api/
│   │   ├── api_client.dart         # Dio setup with interceptors
│   │   ├── api_interceptors.dart   # Auth, error, logging interceptors
│   │   └── dio_provider.dart       # Riverpod provider for Dio
│   ├── storage/
│   │   ├── secure_storage_service.dart
│   │   └── local_storage_service.dart
│   ├── location/
│   │   ├── location_service.dart
│   │   └── location_provider.dart
│   └── logger/
│       └── app_logger.dart
│
├── common/
│   ├── widgets/
│   │   ├── app_loading.dart
│   │   ├── app_error_widget.dart
│   │   ├── custom_app_bar.dart
│   │   └── custom_button.dart
│   ├── extensions/
│   │   ├── string_extensions.dart
│   │   └── context_extensions.dart
│   └── utils/
│       ├── validators.dart
│       ├── formatters.dart
│       └── helpers.dart
│
├── features/
│   │
│   ├── authentication/
│   │   ├── data/
│   │   │   ├── datasources/
│   │   │   │   ├── auth_remote_datasource.dart
│   │   │   │   └── auth_local_datasource.dart
│   │   │   ├── models/
│   │   │   │   ├── user_model.dart
│   │   │   │   └── auth_response_model.dart
│   │   │   └── repositories/
│   │   │       └── auth_repository_impl.dart
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── user_entity.dart
│   │   │   ├── failures/
│   │   │   │   └── auth_failures.dart
│   │   │   └── repositories/
│   │   │       └── auth_repository.dart (abstract)
│   │   └── presentation/
│   │       ├── controllers/
│   │       │   └── auth_controller.dart
│   │       ├── pages/
│   │       │   ├── login_page.dart
│   │       │   ├── register_page.dart
│   │       │   └── splash_page.dart
│   │       └── widgets/
│   │           ├── login_form.dart
│   │           └── register_form.dart
│   │
│   ├── map/
│   │   ├── data/
│   │   │   ├── datasources/
│   │   │   │   └── map_remote_datasource.dart
│   │   │   ├── models/
│   │   │   │   ├── shelter_model.dart
│   │   │   │   ├── danger_zone_model.dart
│   │   │   │   └── incident_model.dart
│   │   │   └── repositories/
│   │   │       └── map_repository_impl.dart
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── shelter.dart
│   │   │   │   ├── danger_zone.dart
│   │   │   │   └── incident.dart
│   │   │   └── repositories/
│   │   │       └── map_repository.dart (abstract)
│   │   └── presentation/
│   │       ├── controllers/
│   │       │   ├── map_controller.dart
│   │       │   ├── shelter_controller.dart
│   │       │   └── location_controller.dart
│   │       ├── pages/
│   │       │   └── map_page.dart
│   │       └── widgets/
│   │           ├── map_widget.dart
│   │           ├── shelter_marker.dart
│   │           └── danger_zone_layer.dart
│   │
│   ├── shelter/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   │
│   ├── danger_zones/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   │
│   ├── incident/
│   │   ├── data/
│   │   ├── domain/
│   │   └── presentation/
│   │
│   └── user/
│       ├── data/
│       ├── domain/
│       └── presentation/
│
└── main.dart
```

### 5.2. Example implementation - Authentication Flow

#### a) Domain Layer (Business Logic)

```dart
// lib/src/features/authentication/domain/entities/user_entity.dart
class User {
  final String id;
  final String name;
  final String email;
  final String role;
  
  User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });
}

// lib/src/features/authentication/domain/repositories/auth_repository.dart
abstract class AuthRepository {
  Future<User> login({required String email, required String password});
  Future<User> register({required String name, required String email, required String password});
  Future<void> logout();
  Future<User?> getCurrentUser();
}
```

#### b) Data Layer (API & Storage)

```dart
// lib/src/features/authentication/data/models/user_model.dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'user_model.freezed.dart';
part 'user_model.g.dart';

@freezed
class UserModel with _$UserModel {
  const factory UserModel({
    required String id,
    required String name,
    required String email,
    required String role,
  }) = _UserModel;

  factory UserModel.fromJson(Map<String, dynamic> json) =>
      _$UserModelFromJson(json);

  // Convert to domain entity
  factory UserModel.fromEntity(User entity) => UserModel(
    id: entity.id,
    name: entity.name,
    email: entity.email,
    role: entity.role,
  );
}

// lib/src/features/authentication/data/repositories/auth_repository_impl.dart
class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDatasource remoteDatasource;
  final AuthLocalDatasource localDatasource;

  AuthRepositoryImpl({
    required this.remoteDatasource,
    required this.localDatasource,
  });

  @override
  Future<User> login({
    required String email,
    required String password,
  }) async {
    try {
      // 1. Call API
      final userModel = await remoteDatasource.login(
        email: email,
        password: password,
      );
      
      // 2. Save token to secure storage
      await localDatasource.saveToken(userModel.token);
      
      // 3. Convert model to entity
      return userModel.toEntity();
    } on ServerException catch (e) {
      throw AuthFailure(message: e.message);
    }
  }

  @override
  Future<void> logout() async {
    await localDatasource.clearToken();
  }
}
```

#### c) Presentation Layer (UI & State Management)

```dart
// lib/src/features/authentication/presentation/controllers/auth_controller.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';

// Define the provider
final authControllerProvider = StateNotifierProvider<AuthController, AsyncValue<User?>>((ref) {
  final repository = ref.watch(authRepositoryProvider);
  return AuthController(repository);
});

class AuthController extends StateNotifier<AsyncValue<User?>> {
  final AuthRepository _authRepository;

  AuthController(this._authRepository) : super(const AsyncValue.data(null));

  Future<void> login({required String email, required String password}) async {
    state = const AsyncValue.loading();
    
    state = await AsyncValue.guard(() async {
      final user = await _authRepository.login(
        email: email,
        password: password,
      );
      return user;
    });
  }

  Future<void> logout() async {
    state = const AsyncValue.loading();
    await _authRepository.logout();
    state = const AsyncValue.data(null);
  }
}

// lib/src/features/authentication/presentation/pages/login_page.dart
class LoginPage extends ConsumerWidget {
  const LoginPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final authController = ref.read(authControllerProvider.notifier);

    ref.listen(authControllerProvider, (previous, next) {
      next.whenData((user) {
        if (user != null) {
          // Navigate to home
          context.go('/map');
        }
      }).whenError((error, stack) {
        // Show error snackbar
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      });
    });

    return Scaffold(
      body: authState.when(
        data: (_) => LoginForm(
          onSubmit: (email, password) {
            authController.login(email: email, password: password);
          },
        ),
        loading: () => const LoadingWidget(),
        error: (error, _) => ErrorWidget(message: error.toString()),
      ),
    );
  }
}
```

### 5.3. Main.dart - Setup app với Riverpod & Go Router

```dart
// lib/src/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'config/router/app_router.dart';
import 'config/theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize services
  // await setupServiceLocator(); // if using GetIt
  
  runApp(
    const ProviderScope(
      child: ShelterApp(),
    ),
  );
}

class ShelterApp extends ConsumerWidget {
  const ShelterApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(goRouterProvider);

    return MaterialApp.router(
      title: 'Shelter - Evacuation Navigation',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
    );
  }
}

// lib/src/config/router/app_router.dart
final goRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);

  return GoRouter(
    redirect: (context, state) {
      final isLoggedIn = authState.whenData((user) => user != null).value ?? false;
      
      if (!isLoggedIn && state.matchedLocation != '/login' && state.matchedLocation != '/register') {
        return '/login';
      }
      
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        name: 'splash',
        builder: (context, state) => const SplashPage(),
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/register',
        name: 'register',
        builder: (context, state) => const RegisterPage(),
      ),
      GoRoute(
        path: '/map',
        name: 'map',
        builder: (context, state) => const MapPage(),
      ),
      GoRoute(
        path: '/shelter/:id',
        name: 'shelterDetail',
        builder: (context, state) => ShelterDetailPage(
          shelterId: state.pathParameters['id']!,
        ),
      ),
    ],
  );
});
```

---

## 🚀 Roadmap triển khai

### Phase 1: Foundation (Tuần 1-2)

```markdown
✅ Cài đặt dependencies
  - flutter_riverpod, riverpod_generator
  - go_router
  - freezed, json_serializable
  - flutter_secure_storage
  - dio + interceptors

✅ Setup project structure
  - Tạo folder structure theo feature-first
  - Setup code generation (build_runner)

✅ Implement core services
  - API client với Dio
  - Secure storage service
  - Logger service
```

**Dependencies cần thêm:**

```yaml
dependencies:
  flutter_riverpod: ^2.4.0
  riverpod_annotation: ^2.1.0
  go_router: ^10.0.0
  freezed_annotation: ^2.4.0
  json_serializable: ^6.7.0
  flutter_secure_storage: ^9.0.0
  logger: ^2.0.0

dev_dependencies:
  build_runner: ^2.4.0
  freezed: ^2.4.0
  json_serializable: ^6.7.0
  riverpod_generator: ^2.3.0
```

### Phase 2: Authentication (Tuần 3)

```markdown
✅ Implement auth feature
  - Auth domain (entities, repositories)
  - Auth data (datasources, models, repositories impl)
  - Auth presentation (controllers, pages, widgets)
  - Form validation
  - Secure token storage & refresh

✅ Setup routing
  - Auth guard
  - Named routes
  - Deep linking support
```

### Phase 3: Map & Features (Tuần 4-5)

```markdown
✅ Refactor map_screen.dart
  - Map domain layer
  - Map data layer with proper API abstraction
  - Map presentation layer with Riverpod
  - Location service

✅ Implement other features
  - Shelter management
  - Danger zones
  - Incident reporting
  - User profile
```

### Phase 4: Testing & Polish (Tuần 6)

```markdown
✅ Unit tests (>80% coverage)
  - Data layer
  - Domain logic
  - Controllers

✅ Widget tests
  - UI components
  - Form validation
  - Error states

✅ Integration tests
  - Auth flow
  - Map navigation
```

---

## ✅ Checklist Triển khai

### Pre-implementation

- [ ] Team review & approve architecture
- [ ] Setup linter rules (flutter_lints configuration)
- [ ] Create git branches strategy
- [ ] Document API contract with backend team

### Phase 1: Foundation

- [ ] Setup pubspec.yaml với all dependencies
- [ ] Create folder structure
- [ ] Implement API client service
- [ ] Implement secure storage service
- [ ] Implement logger service
- [ ] Setup code generation pipeline

### Phase 2: Authentication

- [ ] Create auth domain layer
- [ ] Create auth data layer
- [ ] Create auth presentation layer
- [ ] Implement login/register pages
- [ ] Add form validation
- [ ] Setup secure token storage
- [ ] Implement token refresh mechanism
- [ ] Create auth guard for routing

### Phase 3: Map Feature

- [ ] Create map domain layer
- [ ] Create map data layer
- [ ] Refactor map_screen.dart → map_page.dart
- [ ] Implement map controllers (Riverpod)
- [ ] Implement location tracking
- [ ] Add real-time updates (Socket.io)
- [ ] Create shelter/danger zone markers

### Phase 4: Testing & Docs

- [ ] Write unit tests
- [ ] Write widget tests
- [ ] Write integration tests
- [ ] Update README with architecture guide
- [ ] Create API documentation
- [ ] Code review & optimization

---

## 📖 Tài liệu tham khảo & Best Practices

### Production-grade Flutter projects

1. **Code with Andrea** (Recommended)
   - Flutter Project Structure: Feature-first vs Layer-first
   - Flutter App Architecture with Riverpod
   - Repository Pattern
   - Clean Architecture

2. **Official Flutter Documentation**
   - https://docs.flutter.dev/testing/best-practices
   - https://pub.dev/

3. **State Management Choices**
   - **Riverpod** - Recommended for IE402 (lightweight, reactive, type-safe)
   - Go Router - For navigation
   - Freezed - For immutable models

### Security Best Practices

- ✅ Use `flutter_secure_storage` for JWT tokens (encrypted on device)
- ✅ Implement SSL pinning for API calls
- ✅ Never log sensitive data (passwords, tokens)
- ✅ Validate user input on both client & server
- ✅ Implement proper error handling (don't leak server errors to UI)
- ✅ Use environment-specific API endpoints

### Performance Best Practices

- ✅ Lazy-load images with caching
- ✅ Use `const` constructor for widgets
- ✅ Implement pagination for lists
- ✅ Use `AutomaticKeepAliveClientMixin` for tab views
- ✅ Profile with DevTools before optimization

---

## 🎯 Kết luận

### Hiện tại vs Đề xuất

| Aspek | Hiện tại | Đề xuất | Lợi ích |
|-------|---------|--------|---------|
| State Management | setState() | Riverpod | Reactive, scalable, easy testing |
| Architecture | Monolithic | Clean + Feature-first | Clear separation, team scalability |
| Type Safety | Dynamic | Strongly typed | Fewer bugs, better IDE support |
| Testing | 0% | >80% coverage | Production-ready, regression prevention |
| Maintainability | Low | High | Easier feature additions, faster debugging |

### Cấp độ Production-readiness

```
Hiện tại:      ░░░░░░░░░░  10% (Prototype)
Đề xuất:       ██████████ 100% (Production-grade)
```

### Thời gian ước tính

- **Refactoring hiện tại**: 2-3 tuần
- **Implement new architecture**: 3-4 tuần
- **Testing & polish**: 1-2 tuần
- **Total**: 6-9 tuần (1.5-2 tháng)

---

## 📞 Hỗ trợ & Q&A

### Tại sao Riverpod thay vì BLoC?

- Riverpod nhẹ hơn, không cần boilerplate EventState
- Có built-in caching & data binding
- Dễ học hơn với đội ngũ
- Vẫn scalable cho medium/large apps

### Tại sao Feature-first thay vì Layer-first?

- Feature-first dễ maintain: tất cả code cho 1 feature ở 1 chỗ
- Layer-first phân tán files theo layer → khó tìm code related
- Feature-first scales tốt hơn khi team phát triển

### Bao lâu mới refactor xong?

- **Nhanh** (aggressive): 4-5 tuần (skip testing/polish)
- **Bình thường** (recommended): 6-9 tuần
- **Chậm** (thorough): 12+ tuần (extensive testing, documentation)

### Có thể implement incremental được không?

✅ **Có**, suggest approach:
1. Setup folder structure + dependencies (tuần 1)
2. Implement auth feature first (tuần 2-3)
3. Refactor map feature (tuần 4)
4. Add tests later (tuần 5-6)

---

**Document version**: 1.0  
**Last updated**: 2026-05-25  
**Status**: Ready for team review
