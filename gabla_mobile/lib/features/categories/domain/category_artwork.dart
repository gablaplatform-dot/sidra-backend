/// The first seven provider-directory categories only. ID matching deliberately
/// avoids overriding product categories or new/unrelated admin categories.
/// The underlying admin image URL remains intact in Category.imageUrl.
const providerCategoryArtwork = <String, String>{
  'cmq7q7svm000fubkdhwf98m4g': 'assets/categories/rental.jpg',
  'cmq7qkfw4000tubkddp732of8': 'assets/categories/jobs.jpg',
  'cmq9v0adb001dubkd4lfm00at': 'assets/categories/media.jpg',
  'cmqch43oh002dubkdedlno08a': 'assets/artwork/services.jpg',
  'cmqcreszc0031ubkd5xzpq46r': 'assets/categories/venue.jpg',
  'cmqcth3fs0041ubkdsvz86yv6': 'assets/categories/entertainment.jpg',
  'cmqctv568004lubkdxhstzuui': 'assets/categories/properties.jpg',
};

String? categoryArtworkForName(String name) {
  final words = name.toLowerCase();
  for (final (pattern, asset) in _categoryPhotos) {
    if (pattern.hasMatch(words)) return 'assets/$asset.jpg';
  }
  return null;
}

final _categoryPhotos = [
  (RegExp(r'\b(phone|phones|tablets?|mobiles?)\b'), 'categories/phones'),
  (RegExp(r'\b(babies|baby|kids|toys|children)\b'), 'categories/kids'),
  (RegExp(r'\b(beauty|cosmetics|personal care|salon)\b'), 'categories/beauty'),
  (RegExp(r'\b(pets?|veterinary)\b'), 'categories/pets'),
  (RegExp(r'\b(health|medical|pharmacy)\b'), 'categories/health'),
  (RegExp(r'\b(education|books|training)\b'), 'categories/education'),
  (
    RegExp(r'\b(fashion|apparel|apparels|clothing|shoes)\b'),
    'categories/fashion',
  ),
  (
    RegExp(r'\b(food|agriculture|agricultural|farming)\b'),
    'categories/farming',
  ),
  (RegExp(r'\b(tools|repair|construction|equipment)\b'), 'categories/tools'),
  (RegExp(r'\b(electronics|technology|computers)\b'), 'categories/electronics'),
  (RegExp(r'\b(furniture|appliances|kitchen)\b'), 'categories/furniture'),
  (RegExp(r'\b(travel|tourism|leisure|activities)\b'), 'categories/travel'),
  (RegExp(r'\b(vehicles?|cars?|drivers?)\b'), 'artwork/ride'),
  (RegExp(r'\b(venue|venues|events?)\b'), 'categories/venue'),
  (
    RegExp(r'\b(property|properties|accommodations|accomodations)\b'),
    'categories/properties',
  ),
  (RegExp(r'\b(rental|rentals)\b'), 'categories/rental'),
  (RegExp(r'\b(media|photography|marketing)\b'), 'categories/media'),
  (RegExp(r'\b(entertainment|music)\b'), 'categories/entertainment'),
  (RegExp(r'\b(jobs?|legal|consultancy)\b'), 'artwork/jobs'),
  (RegExp(r'\b(business|industry|printing|signage)\b'), 'categories/industry'),
];
