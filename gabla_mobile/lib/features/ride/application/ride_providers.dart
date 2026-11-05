import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/network_providers.dart';
import '../data/device_location_service.dart';
import '../data/ride_repository.dart';

final rideRepositoryProvider =
    Provider<RideRepository>((ref) => RideRepository(ref.watch(apiClientProvider)));

final deviceLocationServiceProvider = Provider<DeviceLocationService>((ref) => DeviceLocationService());
