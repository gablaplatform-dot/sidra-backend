/// A provider's video ad, as served by `GET /promotions/ads/videos`. Mirrors
/// `PromotionService#_toVideoAdDto` on the backend.
class VideoAd {
  const VideoAd({
    required this.id,
    required this.title,
    this.subtitle,
    required this.videoUrl,
    this.imageUrl,
    this.ctaLabel,
    this.ctaHref,
    this.providerId,
    this.providerName,
    this.providerAvatarUrl,
  });

  factory VideoAd.fromJson(Map<String, dynamic> json) => VideoAd(
    id: json['id'] as String,
    title: json['title'] as String? ?? '',
    subtitle: json['subtitle'] as String?,
    videoUrl: json['videoUrl'] as String,
    imageUrl: json['imageUrl'] as String?,
    ctaLabel: json['ctaLabel'] as String?,
    ctaHref: json['ctaHref'] as String?,
    providerId: json['providerId'] as String?,
    providerName: json['providerName'] as String?,
    providerAvatarUrl: json['providerAvatarUrl'] as String?,
  );

  final String id;
  final String title;
  final String? subtitle;
  final String videoUrl;
  final String? imageUrl;
  final String? ctaLabel;
  final String? ctaHref;
  final String? providerId;
  final String? providerName;
  final String? providerAvatarUrl;
}
