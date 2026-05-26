import 'package:dio/dio.dart';
import '../core/constants/api_config.dart';

class ApiClient {
  ApiClient._();
  static final Dio instance = Dio(BaseOptions(baseUrl: ApiConfig.baseUrl));
}
