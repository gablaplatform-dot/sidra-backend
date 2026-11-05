/// Contact details for a prospective provider, editable unless the field
/// came pre-filled by the admin who sent the invite.
class ProviderContactInfo {
  const ProviderContactInfo({
    this.email,
    this.phone,
    this.whatsapp,
    this.website,
  });

  factory ProviderContactInfo.fromJson(Map<String, dynamic>? json) =>
      ProviderContactInfo(
        email: json?['email'] as String?,
        phone: json?['phone'] as String?,
        whatsapp: json?['whatsapp'] as String?,
        website: json?['website'] as String?,
      );

  final String? email;
  final String? phone;
  final String? whatsapp;
  final String? website;

  Map<String, dynamic> toJson() => {
    if (email != null) 'email': email,
    if (phone != null) 'phone': phone,
    if (whatsapp != null) 'whatsapp': whatsapp,
    if (website != null) 'website': website,
  };
}

class ProviderLocationInfo {
  const ProviderLocationInfo({
    this.address,
    this.city,
    this.region,
    this.country,
    this.geo,
  });

  factory ProviderLocationInfo.fromJson(Map<String, dynamic>? json) =>
      ProviderLocationInfo(
        address: json?['address'] as String?,
        city: json?['city'] as String?,
        region: json?['region'] as String?,
        country: json?['country'] as String?,
        geo: json?['geo'] is Map
            ? Map<String, dynamic>.from(json!['geo'])
            : null,
      );

  final String? address;
  final String? city;
  final String? region;
  final String? country;
  final Map<String, dynamic>? geo;

  Map<String, dynamic> toJson() => {
    if (address != null) 'address': address,
    if (city != null) 'city': city,
    if (region != null) 'region': region,
    if (country != null) 'country': country,
    if (geo != null) 'geo': geo,
  };
}

/// `GET /providers/onboarding/:token` - a pending provider invite created by
/// a Gabla admin. Mirrors `public_app/src/pages/ProviderOnboarding.jsx`,
/// which is a token-gated invite flow, not self-serve signup: there is no
/// endpoint a signed-in customer can call on their own to become a
/// provider, so this screen only renders anything useful when opened from
/// an admin-sent invite link (`gabla://onboarding?token=...`).
class ProviderInvite {
  const ProviderInvite({
    required this.email,
    this.phone,
    required this.businessName,
    this.description,
    required this.contact,
    required this.location,
    this.categoryId,
    required this.onboardingStatus,
    this.lockedFields = const {},
  });

  factory ProviderInvite.fromJson(Map<String, dynamic> json) {
    final user = json['user'] as Map<String, dynamic>? ?? const {};
    final provider = json['provider'] as Map<String, dynamic>? ?? const {};
    return ProviderInvite(
      email: user['email'] as String? ?? '',
      phone: user['phone'] as String?,
      businessName: provider['businessName'] as String? ?? '',
      description: provider['description'] as String?,
      contact: ProviderContactInfo.fromJson(
        provider['contact'] as Map<String, dynamic>?,
      ),
      location: ProviderLocationInfo.fromJson(
        provider['location'] as Map<String, dynamic>?,
      ),
      categoryId: provider['categoryId'] as String?,
      onboardingStatus: provider['onboardingStatus'] as String? ?? 'pending',
      lockedFields:
          (provider['adminLocked'] as List?)?.cast<String>().toSet() ??
          const {},
    );
  }

  final String email;
  final String? phone;
  final String businessName;
  final String? description;
  final ProviderContactInfo contact;
  final ProviderLocationInfo location;
  final String? categoryId;
  final String onboardingStatus;

  /// Field names the admin already filled in, shown read-only - the exact
  /// set of names isn't pinned down by the web source, so this degrades
  /// gracefully to "everything editable" when the API omits it.
  final Set<String> lockedFields;

  bool get alreadyRegistered => onboardingStatus == 'registered';
  bool isLocked(String field) => lockedFields.contains(field);
}
