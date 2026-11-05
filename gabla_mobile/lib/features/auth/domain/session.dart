/// The signed-in user, as returned by `/auth/google`.
class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    this.avatarUrl,
    this.phone,
    this.district,
    this.roles = const [],
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
    id: json['id'] as String,
    name: json['name'] as String? ?? '',
    email: json['email'] as String? ?? '',
    avatarUrl: json['avatarUrl'] as String?,
    phone:
        json['phone'] as String? ??
        (json['profile'] as Map?)?['phone'] as String?,
    district:
        (json['profile'] as Map?)?['district'] as String? ??
        json['district'] as String?,
    roles:
        (json['roles'] as List?)?.cast<String>() ??
        [if (json['role'] != null) '${json['role']}'],
  );

  final String id;
  final String name;
  final String email;
  final String? avatarUrl;
  final String? phone;
  final String? district;
  final List<String> roles;

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'email': email,
    if (avatarUrl != null) 'avatarUrl': avatarUrl,
    if (phone != null) 'phone': phone,
    'roles': roles,
    if (district != null) 'district': district,
  };
}

/// A signed-in session: the bearer token plus the user it belongs to.
///
/// The API renews the access token as it ages (returned via the
/// `X-Renewed-Token` response header), so holding this in a single
/// immutable object makes "replace the token in place" an explicit,
/// single-point update - see `AuthController.applyRenewedToken`.
class Session {
  const Session({
    required this.accessToken,
    required this.user,
    this.isNewUser = false,
    this.isBusOperator = false,
  });

  factory Session.fromJson(Map<String, dynamic> json) => Session(
    accessToken: json['accessToken'] as String,
    user: AppUser.fromJson(json['user'] as Map<String, dynamic>),
    isNewUser: json['isNewUser'] == true,
    isBusOperator: json['busOperator'] != null || json['isBusOperator'] == true,
  );

  final String accessToken;
  final AppUser user;
  final bool isNewUser;
  final bool isBusOperator;

  Session copyWith({String? accessToken, AppUser? user}) => Session(
    accessToken: accessToken ?? this.accessToken,
    user: user ?? this.user,
    isNewUser: isNewUser,
    isBusOperator: isBusOperator,
  );

  Map<String, dynamic> toJson() => {
    'accessToken': accessToken,
    'user': user.toJson(),
    'isBusOperator': isBusOperator,
  };
}
