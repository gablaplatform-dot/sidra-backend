import 'package:flutter/material.dart';

/// Category symbols are fallbacks only. Admin-supplied photographs take priority.
IconData providerCategoryIcon(String name) {
  final value = name.toLowerCase();
  if (value.contains('job')) return Icons.work_outline;
  if (value.contains('rental') ||
      value.contains('propert') ||
      value.contains('accom'))
    return Icons.home_work_outlined;
  if (value.contains('entertain') || value.contains('music'))
    return Icons.headphones_outlined;
  if (value.contains('venue') || value.contains('event'))
    return Icons.local_activity_outlined;
  if (value.contains('media') || value.contains('photo'))
    return Icons.camera_alt_outlined;
  if (value.contains('health')) return Icons.health_and_safety_outlined;
  if (value.contains('electro') || value.contains('technolog'))
    return Icons.devices_outlined;
  if (value.contains('food') || value.contains('restaurant'))
    return Icons.restaurant_outlined;
  if (value.contains('beauty') || value.contains('salon'))
    return Icons.content_cut;
  if (value.contains('repair') || value.contains('service'))
    return Icons.handyman_outlined;
  if (value.contains('educat') ||
      value.contains('school') ||
      value.contains('institute'))
    return Icons.school_outlined;
  return Icons.category_outlined;
}
