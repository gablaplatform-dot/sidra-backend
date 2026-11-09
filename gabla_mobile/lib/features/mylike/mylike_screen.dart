import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart' as maps;

import '../../core/location/map_mode.dart';
import '../nearby/presentation/nearby_map.dart';

part 'mylike_shop.dart';
part 'mylike_community.dart';
part 'mylike_travel.dart';

const _lime = Color(0xffa5c54d);
const _orange = Color(0xffe9852b);
const _ink = Color(0xff141412);
const _paper = Color(0xfff7f7f7);
const _night = Color(0xff181817);
const _blue = Color(0xff0a4f63);

const _groups = {
  'Shop': {
    'shop': 'Shop',
    'product': 'Product details',
    'shop-search': 'Product search',
    'filters': 'Filters',
    'categories': 'Categories',
    'cart': 'Cart',
    'checkout': 'Checkout',
    'orders': 'Orders',
    'order': 'Order details',
  },
  'Events': {
    'events': 'Events',
    'event': 'Event details',
    'event-form': 'Post an event',
    'saved-events': 'Saved events',
    'my-events': 'My events',
    'vendors': 'Vendors',
  },
  'Jobs': {
    'jobs': 'Jobs',
    'job': 'Job details',
    'job-form': 'Post a job',
    'job-apply': 'Application',
    'applications': 'My applications',
    'saved-jobs': 'Saved jobs',
    'my-jobs': 'My jobs',
    'applicants': 'Applicants',
  },
  'Rides': {
    'ride': 'Get a ride',
    'ride-route': 'Set your route',
    'ride-options': 'Choose a ride',
    'ride-driver': 'Driver details',
    'ride-trip': 'Trip in progress',
    'ride-history': 'Ride history',
    'nearby': 'Nearby',
  },
  'Bus tickets': {
    'bus': 'Bus tickets',
    'bus-results': 'Departures',
    'bus-trip': 'Trip and seats',
    'bus-passengers': 'Passenger details',
    'bus-ticket': 'Ticket preview',
    'bus-tickets': 'My tickets',
    'bus-parks': 'Bus parks',
    'bus-park': 'Bus park details',
    'bus-operator': 'Operator dashboard',
    'bus-operator-login': 'Operator sign-in',
    'bus-onboarding': 'Operator invitation',
  },
  'Services and businesses': {
    'services': 'Services',
    'service': 'Service details',
    'booking': 'Book a service',
    'bookings': 'My bookings',
    'provider': 'Business profile',
    'listing-form': 'Create a listing',
    'provider-onboarding': 'Business invitation',
    'workspace': 'Business workspace',
    'business': 'Business details',
    'listings': 'My listings',
    'inquiries': 'Inquiries',
    'wallet': 'Wallet',
    'documents': 'Quotes and receipts',
    'document-design': 'Document settings',
    'seller-orders': 'Seller orders',
    'reservations': 'Reservations',
    'business-categories': 'Business categories',
    'analytics': 'Analytics',
    'promotions': 'Promotions',
    'promotion-form': 'Create a promotion',
  },
  'Account and discovery': {
    'search': 'Search Gabla',
    'saved': 'Saved',
    'profile': 'Account',
    'login': 'Sign in',
    'welcome': 'Account details',
    'delete-account': 'Delete account',
    'messages': 'Messages',
  },
};

void _open(BuildContext context, String screen) =>
    context.push('/mylike/$screen');

void _back(BuildContext context) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go('/settings/appearance');
  }
}

void _preview(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text('Preview only. $message')));
}

final _bag = StateProvider<int>((ref) => 0);

class MylikeScreen extends StatelessWidget {
  const MylikeScreen({super.key, required this.screen});
  final String screen;

  static Iterable<String> get screens => [
    'home',
    'screens',
    for (final group in _groups.values) ...group.keys,
  ];

  @override
  Widget build(BuildContext context) {
    final bus = _groups['Bus tickets']!.containsKey(screen);
    final jobs = _groups['Jobs']!.containsKey(screen);
    final services = _groups['Services and businesses']!.containsKey(screen);
    final dark =
        bus ||
        (screen != 'events' &&
            screen != 'event' &&
            _groups['Events']!.containsKey(screen));
    final accent = bus
        ? const Color(0xffa9d6ff)
        : dark
        ? _orange
        : jobs || services
        ? const Color(0xff075ee8)
        : _groups['Rides']!.containsKey(screen)
        ? _blue
        : _groups['Shop']!.containsKey(screen) ||
              screen == 'events' ||
              screen == 'event'
        ? _ink
        : _lime;
    final surface = bus
        ? const Color(0xff0d2d59)
        : dark
        ? _night
        : _paper;
    final colors = ColorScheme.fromSeed(
      seedColor: accent,
      brightness: dark ? Brightness.dark : Brightness.light,
      primary: accent,
      onPrimary: ThemeData.estimateBrightnessForColor(accent) == Brightness.dark
          ? Colors.white
          : _ink,
      surface: surface,
    );
    return Theme(
      data: ThemeData(
        colorScheme: colors,
        fontFamily: 'Manrope',
        scaffoldBackgroundColor: surface,
        appBarTheme: AppBarTheme(
          backgroundColor: surface,
          surfaceTintColor: Colors.transparent,
          centerTitle: true,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: bus
              ? const Color(0xff173b65)
              : dark
              ? const Color(0xff292927)
              : Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 14,
          ),
        ),
      ),
      child: Builder(
        builder: (context) => switch (screen) {
          'home' => const _Home(),
          'screens' => const _Index(),
          'shop' => const _Shop(),
          'product' => const _Product(),
          'shop-search' ||
          'categories' ||
          'filters' ||
          'cart' ||
          'checkout' ||
          'orders' ||
          'order' => _ShopSupport(screen: screen),
          'events' => const _Events(),
          'event' => const _Event(),
          'saved-events' ||
          'my-events' ||
          'vendors' => _EventCollection(screen: screen),
          'jobs' => const _Jobs(),
          'job' => const _Job(),
          'saved-jobs' ||
          'my-jobs' ||
          'applications' ||
          'applicants' => _JobCollection(screen: screen),
          'ride' ||
          'ride-options' ||
          'ride-driver' ||
          'ride-trip' => _Ride(screen: screen),
          'nearby' => const _Nearby(),
          'bus' ||
          'bus-results' ||
          'bus-trip' ||
          'bus-ticket' ||
          'bus-tickets' ||
          'bus-parks' ||
          'bus-park' ||
          'bus-operator' => _Bus(screen: screen),
          'services' ||
          'service' ||
          'provider' => _ServicePreview(screen: screen),
          'login' => const _SignIn(),
          'profile' ||
          'workspace' => _Account(workspace: screen == 'workspace'),
          _ when _forms.containsKey(screen) => _FormPage(spec: _forms[screen]!),
          _ when _records.containsKey(screen) => _RecordPage(
            spec: _records[screen]!,
          ),
          _ => const _Index(),
        },
      ),
    );
  }
}

class _Index extends StatelessWidget {
  const _Index();
  @override
  Widget build(BuildContext context) => _Page(
    title: 'Mylike',
    trailing: _CircleButton(
      Icons.tune,
      'Design Studio',
      () => context.push('/settings/appearance'),
    ),
    children: [
      const _Heading(
        'Presentation preview',
        'Sample screens for the Gabla customer app.',
      ),
      const SizedBox(height: 18),
      for (final group in _groups.entries) ...[
        _Section(group.key),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final item in group.value.entries)
              ActionChip(
                label: Text(item.value),
                onPressed: () => _open(context, item.key),
              ),
          ],
        ),
        const SizedBox(height: 20),
      ],
    ],
  );
}

class _Page extends StatelessWidget {
  const _Page({
    required this.title,
    required this.children,
    this.footer,
    this.trailing,
  });
  final String title;
  final List<Widget> children;
  final Widget? footer, trailing;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        title,
        style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
      ),
      leading: IconButton(
        onPressed: () => _back(context),
        tooltip: 'Back',
        icon: const Icon(Icons.chevron_left),
      ),
      actions: [if (trailing != null) trailing!, const SizedBox(width: 12)],
    ),
    body: SafeArea(
      top: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: children,
      ),
    ),
    bottomNavigationBar: footer == null ? null : _Footer(child: footer!),
  );
}

class _Footer extends StatelessWidget {
  const _Footer({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    minimum: const EdgeInsets.fromLTRB(14, 8, 14, 12),
    child: child,
  );
}

class _CircleButton extends StatelessWidget {
  const _CircleButton(this.icon, this.label, this.onTap, {this.tint, this.ink});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? tint, ink;
  @override
  Widget build(BuildContext context) => Material(
    color: tint ?? Theme.of(context).colorScheme.surfaceContainerHigh,
    shape: const CircleBorder(),
    child: IconButton(
      tooltip: label,
      onPressed: onTap,
      icon: Icon(icon, color: ink, size: 22),
    ),
  );
}

class _Action extends StatelessWidget {
  const _Action(this.label, this.onTap, {this.color, this.icon});
  final String label;
  final VoidCallback onTap;
  final Color? color;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    final background = color ?? Theme.of(context).colorScheme.primary;
    final foreground =
        ThemeData.estimateBrightnessForColor(background) == Brightness.dark
        ? Colors.white
        : _ink;
    final style = FilledButton.styleFrom(
      backgroundColor: background,
      foregroundColor: foreground,
      minimumSize: const Size(48, 48),
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      shape: const StadiumBorder(),
    );
    return icon == null
        ? FilledButton(style: style, onPressed: onTap, child: Text(label))
        : FilledButton.icon(
            style: style,
            onPressed: onTap,
            icon: Icon(icon, size: 19),
            label: Text(label),
          );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.title, this.description);
  final String title, description;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        title,
        style: const TextStyle(
          fontSize: 26,
          fontWeight: FontWeight.w800,
          fontVariations: [FontVariation('wght', 800)],
          height: 1.15,
        ),
      ),
      if (description.isNotEmpty) ...[
        const SizedBox(height: 8),
        Text(
          description,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            height: 1.45,
          ),
        ),
      ],
    ],
  );
}

class _Section extends StatelessWidget {
  const _Section(this.title, {this.action, this.onTap});
  final String title;
  final String? action;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12, bottom: 8),
    child: Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontVariations: [FontVariation('wght', 800)],
              fontSize: 16,
            ),
          ),
        ),
        if (action != null) TextButton(onPressed: onTap, child: Text(action!)),
      ],
    ),
  );
}

class _Panel extends StatelessWidget {
  const _Panel({
    required this.child,
    this.color,
    this.radius = 14,
    this.padding = const EdgeInsets.all(14),
  });
  final Widget child;
  final Color? color;
  final double radius;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) => Container(
    padding: padding,
    decoration: BoxDecoration(
      color: color ?? Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(radius),
    ),
    child: child,
  );
}

class _RowLink extends StatelessWidget {
  const _RowLink(this.icon, this.title, this.subtitle, this.target);
  final IconData icon;
  final String title, subtitle, target;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: _Panel(
      padding: const EdgeInsets.all(9),
      child: Icon(icon, size: 22),
    ),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
    subtitle: subtitle.isEmpty ? null : Text(subtitle),
    trailing: const Icon(Icons.chevron_right, size: 18),
    onTap: () => _open(context, target),
  );
}

class _Photo extends StatelessWidget {
  const _Photo(this.source, this.rect, {this.alignment = Alignment.center});
  final String source;
  final Rect rect;
  final Alignment alignment;
  @override
  Widget build(BuildContext context) => ClipRect(
    child: FittedBox(
      fit: BoxFit.cover,
      alignment: alignment,
      clipBehavior: Clip.hardEdge,
      child: SizedBox(
        width: rect.width,
        height: rect.height,
        child: Stack(
          children: [
            Positioned(
              left: -rect.left,
              top: -rect.top,
              width: 1200,
              height: source == 'shop' ? 1200 : 900,
              child: Image.asset(
                'assets/mylike/$source.jpg',
                fit: BoxFit.fill,
                excludeFromSemantics: true,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

typedef _FormSpec = ({
  String title,
  String intro,
  List<String> fields,
  String action,
  String? next,
});

const _forms = <String, _FormSpec>{
  'event-form': (
    title: 'Post an event',
    intro: 'Add a poster, schedule and venue.',
    fields: [
      'Event name',
      'Organizer or band',
      'Category',
      'Start date and time',
      'End date and time',
      'Venue or address',
      'Entrance price',
      'Description',
      'Poster and video',
    ],
    action: 'Preview event',
    next: 'event',
  ),
  'job-form': (
    title: 'Post a job',
    intro: 'Describe the role or paid task.',
    fields: [
      'Job title',
      'Company or organization',
      'Vacancy or paid task',
      'Workplace',
      'Location',
      'Pay range',
      'Requirements',
      'Description',
    ],
    action: 'Preview job',
    next: 'job',
  ),
  'job-apply': (
    title: 'Apply for this job',
    intro: 'Product Designer · Studio North',
    fields: [
      'Your name',
      'Phone number',
      'Portfolio or CV link',
      'Cover letter',
    ],
    action: 'Preview application',
    next: 'applications',
  ),
  'ride-route': (
    title: 'Set your route',
    intro: 'Choose a pickup and destination.',
    fields: ['Pickup location', 'Destination'],
    action: 'See ride options',
    next: 'ride-options',
  ),
  'bus-passengers': (
    title: 'Passenger details',
    intro: 'Kampala to Mbarara · Seat 12A',
    fields: ['Passenger name', 'Phone number', 'Email address'],
    action: 'Preview ticket',
    next: 'bus-ticket',
  ),
  'booking': (
    title: 'Book a service',
    intro: 'Studio photography · The Portrait Room',
    fields: ['Date', 'Time', 'Guests', 'Your name', 'Phone number', 'Notes'],
    action: 'Preview booking',
    next: 'bookings',
  ),
  'listing-form': (
    title: 'Create a listing',
    intro: 'Add product or service details.',
    fields: [
      'Listing name',
      'Product or service',
      'Category',
      'Price',
      'Stock',
      'Description',
      'Photos',
    ],
    action: 'Preview listing',
    next: 'product',
  ),
  'business': (
    title: 'Business details',
    intro: 'Manage what customers see.',
    fields: ['Business name', 'Category', 'Description', 'Phone', 'Address'],
    action: 'Preview business',
    next: 'provider',
  ),
  'provider-onboarding': (
    title: 'Business invitation',
    intro: 'Set up a profile for your business.',
    fields: [
      'Business name',
      'Your name',
      'Email',
      'Phone',
      'Category',
      'Location',
    ],
    action: 'Preview business',
    next: 'provider',
  ),
  'bus-onboarding': (
    title: 'Operator invitation',
    intro: 'Set up your bus company.',
    fields: ['Company name', 'Contact name', 'Phone', 'Email', 'Bus park'],
    action: 'Preview dashboard',
    next: 'bus-operator',
  ),
  'bus-operator-login': (
    title: 'Operator sign-in',
    intro: 'Manage departures and tickets.',
    fields: ['Business email', 'Password'],
    action: 'Preview dashboard',
    next: 'bus-operator',
  ),
  'welcome': (
    title: 'Account details',
    intro: 'Your Gabla profile.',
    fields: ['Full name', 'Phone number', 'District'],
    action: 'Preview account',
    next: 'profile',
  ),
  'delete-account': (
    title: 'Delete account',
    intro: 'Review the account deletion screen.',
    fields: ['Type DELETE to confirm'],
    action: 'Preview only',
    next: null,
  ),
  'document-design': (
    title: 'Document settings',
    intro: 'Set the details printed on quotes and receipts.',
    fields: [
      'Business name',
      'Address',
      'Contact details',
      'Payment instructions',
      'Footer note',
    ],
    action: 'Preview documents',
    next: 'documents',
  ),
  'promotion-form': (
    title: 'Create a promotion',
    intro: 'Set the message and dates.',
    fields: [
      'Title',
      'Listing',
      'Description',
      'Start date',
      'End date',
      'Banner',
    ],
    action: 'Preview promotion',
    next: 'promotions',
  ),
};

class _FormPage extends StatelessWidget {
  const _FormPage({required this.spec});
  final _FormSpec spec;
  @override
  Widget build(BuildContext context) => _Page(
    title: spec.title,
    children: [
      _Heading(spec.title, spec.intro),
      const SizedBox(height: 22),
      for (final label in spec.fields)
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  fontVariations: [FontVariation('wght', 800)],
                ),
              ),
              const SizedBox(height: 7),
              if (label == 'Venue or address' || label == 'Location')
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        decoration: const InputDecoration(
                          hintText: 'Search address',
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Pick on map',
                      onPressed: () => _open(context, 'nearby'),
                      icon: const Icon(Icons.map_outlined),
                    ),
                  ],
                )
              else
                TextField(
                  maxLines:
                      {
                        'Description',
                        'Notes',
                        'Cover letter',
                        'Requirements',
                      }.contains(label)
                      ? 3
                      : 1,
                  obscureText: label == 'Password',
                  decoration: InputDecoration(hintText: label),
                ),
            ],
          ),
        ),
    ],
    footer: _Action(spec.action, () {
      final next = spec.next;
      if (next != null) {
        _open(context, next);
      } else {
        _preview(context, 'Your account is unchanged.');
      }
    }),
  );
}

typedef _RecordSpec = ({
  String title,
  String summary,
  IconData icon,
  List<(String, String, String)> rows,
});

const _records = <String, _RecordSpec>{
  'services': (
    title: 'Services',
    summary: 'Browse services by category.',
    icon: Icons.handyman_outlined,
    rows: [
      ('Studio photography', 'The Portrait Room · Kampala', 'service'),
      ('Event planning', 'Browse business profiles', 'provider'),
      ('My bookings', 'Reservations and requests', 'bookings'),
    ],
  ),
  'service': (
    title: 'Studio photography',
    summary: 'The Portrait Room · Kampala · UGX 85,000 per session',
    icon: Icons.camera_alt_outlined,
    rows: [
      ('About the business', 'Portfolio and contact details', 'provider'),
      ('Check availability', 'Choose a date and time', 'booking'),
    ],
  ),
  'bookings': (
    title: 'My bookings',
    summary: 'Review the booking list layout.',
    icon: Icons.calendar_month_outlined,
    rows: [
      (
        'Studio photography',
        'Saturday · 10:30 AM · Awaiting confirmation',
        'service',
      ),
    ],
  ),
  'provider': (
    title: 'The Portrait Room',
    summary: 'Photography studio in Kampala',
    icon: Icons.storefront_outlined,
    rows: [
      ('Studio photography', 'Services and availability', 'service'),
      (
        'Business categories',
        'Explore related providers',
        'business-categories',
      ),
    ],
  ),
  'listings': (
    title: 'My listings',
    summary: 'Manage products and services.',
    icon: Icons.inventory_2_outlined,
    rows: [
      ('Grey Casual shoe', 'Published · UGX 120,000', 'product'),
      ('New listing', 'Product or service', 'listing-form'),
    ],
  ),
  'inquiries': (
    title: 'Inquiries',
    summary: 'Messages about your listings.',
    icon: Icons.chat_bubble_outline,
    rows: [('Photography inquiry', 'Session availability', 'messages')],
  ),
  'wallet': (
    title: 'Wallet',
    summary: 'UGX 84,500 available · Example balance',
    icon: Icons.account_balance_wallet_outlined,
    rows: [('Recent order', 'Payment history', 'order')],
  ),
  'documents': (
    title: 'Quotes and receipts',
    summary: 'Review your business documents.',
    icon: Icons.receipt_long_outlined,
    rows: [
      ('Receipt #1285', 'Order receipt', 'order'),
      (
        'Document settings',
        'Logo, business details and footer',
        'document-design',
      ),
    ],
  ),
  'seller-orders': (
    title: 'Seller orders',
    summary: 'Review orders from customers.',
    icon: Icons.shopping_bag_outlined,
    rows: [('Order #1285', 'Awaiting acceptance', 'order')],
  ),
  'reservations': (
    title: 'Reservations',
    summary: 'Manage requests and confirmed dates.',
    icon: Icons.calendar_today_outlined,
    rows: [('Studio photography', 'Saturday · 10:30 AM', 'bookings')],
  ),
  'business-categories': (
    title: 'Business categories',
    summary: 'Browse shops and service providers.',
    icon: Icons.category_outlined,
    rows: [
      ('Photography', 'Services', 'services'),
      ('Clothing and footwear', 'Shop categories', 'categories'),
    ],
  ),
  'analytics': (
    title: 'Analytics',
    summary: 'Example weekly activity',
    icon: Icons.bar_chart,
    rows: [
      ('128 listing views', 'This week', 'listings'),
      ('8 orders', 'This week', 'seller-orders'),
    ],
  ),
  'promotions': (
    title: 'Promotions',
    summary: 'Manage offers shown in the shop.',
    icon: Icons.local_offer_outlined,
    rows: [
      ('Weekend footwear offer', 'Example promotion', 'product'),
      ('Create promotion', 'Select a listing and dates', 'promotion-form'),
    ],
  ),
  'saved': (
    title: 'Saved',
    summary: 'Your saved places, products and posts.',
    icon: Icons.favorite_border,
    rows: [
      ('Grey Casual shoe', 'Product', 'product'),
      ('Afro Nation Lagos', 'Event', 'event'),
      ('Product Designer', 'Job', 'job'),
    ],
  ),
  'messages': (
    title: 'Messages',
    summary: 'Conversations about your orders and listings.',
    icon: Icons.chat_bubble_outline,
    rows: [('The Portrait Room', 'Studio session inquiry', 'provider')],
  ),
  'search': (
    title: 'Search Gabla',
    summary: 'Find products, services, jobs and events.',
    icon: Icons.search,
    rows: [
      ('Products', 'Shop catalog', 'shop-search'),
      ('Services', 'Local businesses', 'services'),
      ('Nearby', 'Explore the map', 'nearby'),
      ('Events', 'Browse events', 'events'),
      ('Jobs', 'Vacancies and paid tasks', 'jobs'),
    ],
  ),
  'ride-history': (
    title: 'Ride history',
    summary: 'Example past trips',
    icon: Icons.history,
    rows: [('Acacia Mall', 'Completed · UGX 14,500', 'ride-trip')],
  ),
};

class _RecordPage extends StatelessWidget {
  const _RecordPage({required this.spec});
  final _RecordSpec spec;
  @override
  Widget build(BuildContext context) => _Page(
    title: spec.title,
    children: [
      if (spec.title == 'Search Gabla')
        const TextField(
          decoration: InputDecoration(
            prefixIcon: Icon(Icons.search),
            hintText: 'Search',
          ),
        ),
      const SizedBox(height: 12),
      _Panel(
        child: Row(
          children: [
            Icon(spec.icon, size: 32),
            const SizedBox(width: 14),
            Expanded(child: _Heading(spec.title, spec.summary)),
          ],
        ),
      ),
      const SizedBox(height: 12),
      for (final row in spec.rows) _RowLink(spec.icon, row.$1, row.$2, row.$3),
    ],
  );
}

class _Account extends StatelessWidget {
  const _Account({required this.workspace});
  final bool workspace;

  @override
  Widget build(BuildContext context) => _Page(
    title: workspace ? 'Business workspace' : 'Account',
    children: [
      _Panel(
        color: Colors.white,
        child: Row(
          children: [
            CircleAvatar(
              radius: 25,
              backgroundColor: const Color(0xffdceadf),
              child: Icon(workspace ? Icons.storefront : Icons.person_outline),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    workspace ? 'The Portrait Room' : 'Gabla account',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      fontVariations: [FontVariation('wght', 800)],
                    ),
                  ),
                  const Text(
                    'Presentation preview',
                    style: TextStyle(color: Colors.black54),
                  ),
                  TextButton(
                    onPressed: () =>
                        _open(context, workspace ? 'business' : 'welcome'),
                    child: Text(workspace ? 'Edit business' : 'Edit profile'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      if (workspace) ...[
        const _Section('Business activity'),
        _AccountRows(
          items: [
            for (final item
                in _groups['Services and businesses']!.entries.where(
                  (item) => item.key != 'workspace' && item.key != 'business',
                ))
              (Icons.arrow_outward, item.value, item.key),
          ],
        ),
      ] else ...[
        const _Section('My activity'),
        const _AccountRows(
          items: [
            (Icons.shopping_bag_outlined, 'Orders', 'orders'),
            (Icons.calendar_month_outlined, 'Bookings', 'bookings'),
            (Icons.confirmation_number_outlined, 'Bus tickets', 'bus-tickets'),
            (Icons.route_outlined, 'Ride history', 'ride-history'),
            (Icons.favorite_border, 'Saved', 'saved'),
            (Icons.work_outline, 'Applications', 'applications'),
          ],
        ),
        const _Section('Account & business'),
        const _AccountRows(
          items: [
            (Icons.storefront_outlined, 'Business workspace', 'workspace'),
            (Icons.login, 'Sign in', 'login'),
            (Icons.delete_outline, 'Delete account', 'delete-account'),
          ],
        ),
      ],
      const SizedBox(height: 10),
      ListTile(
        title: const Text('Design Studio'),
        leading: const Icon(Icons.palette_outlined),
        onTap: () => context.push('/settings/appearance'),
      ),
    ],
  );
}

class _AccountRows extends StatelessWidget {
  const _AccountRows({required this.items});
  final List<(IconData, String, String)> items;

  @override
  Widget build(BuildContext context) => _Panel(
    color: Colors.white,
    padding: const EdgeInsets.symmetric(horizontal: 12),
    child: Column(
      children: [
        for (final item in items.indexed) ...[
          if (item.$1 > 0) const Divider(height: 1),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(item.$2.$1, size: 20),
            title: Text(item.$2.$2),
            trailing: const Icon(Icons.chevron_right, size: 18),
            onTap: () => _open(context, item.$2.$3),
          ),
        ],
      ],
    ),
  );
}

class _ServicePreview extends StatelessWidget {
  const _ServicePreview({required this.screen});
  final String screen;

  @override
  Widget build(BuildContext context) {
    final browse = screen == 'services';
    final business = screen == 'provider';
    return _Page(
      title: browse
          ? 'Services'
          : business
          ? 'Business profile'
          : 'Service details',
      children: [
        if (browse) ...[
          const _Heading('Find local services', 'Kampala'),
          const SizedBox(height: 14),
          const TextField(
            decoration: InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search for a service',
            ),
          ),
          const _Section('Browse by category'),
          Wrap(
            spacing: 8,
            children: [
              for (final item in const [
                (Icons.camera_alt_outlined, 'Photography'),
                (Icons.event_outlined, 'Events'),
                (Icons.handyman_outlined, 'Home services'),
              ])
                ActionChip(
                  avatar: Icon(item.$1, size: 16),
                  label: Text(item.$2),
                  onPressed: () => _open(context, 'service'),
                ),
            ],
          ),
          const _Section('Featured in Kampala'),
        ],
        InkWell(
          onTap: browse ? () => _open(context, 'service') : null,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Image.asset(
              'assets/mylike/studio.jpg',
              height: 194,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
        ),
        const SizedBox(height: 14),
        _Heading(
          business ? 'The Portrait Room' : 'Studio photography',
          'The Portrait Room · Kampala',
        ),
        const SizedBox(height: 8),
        if (!business)
          const Text(
            'UGX 85,000 per session',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: Color(0xff075ee8),
            ),
          ),
        const SizedBox(height: 12),
        if (browse)
          const _RowLink(
            Icons.calendar_month_outlined,
            'My bookings',
            'Reservations and requests',
            'bookings',
          )
        else ...[
          const _Section('About the studio'),
          const Text(
            'Portraits and product photography in a private studio. Sessions include lighting and a selection of edited photographs.',
          ),
          const SizedBox(height: 12),
          _RowLink(
            Icons.storefront_outlined,
            business ? 'View services' : 'The Portrait Room',
            'Kampala',
            business ? 'services' : 'provider',
          ),
        ],
      ],
      footer: browse || business
          ? null
          : _Action('Check availability', () => _open(context, 'booking')),
    );
  }
}

class _SignIn extends StatelessWidget {
  const _SignIn();
  @override
  Widget build(BuildContext context) => _Page(
    title: 'Sign in',
    children: [
      const SizedBox(height: 70),
      Center(
        child: Image.asset('assets/brand/icon-only.png', width: 66, height: 66),
      ),
      const SizedBox(height: 24),
      const _Heading('Welcome to Gabla', 'Sign in to save your activity.'),
      const SizedBox(height: 24),
      _Action(
        'Continue with Google',
        () => _open(context, 'welcome'),
        icon: Icons.login,
      ),
      const SizedBox(height: 10),
      OutlinedButton.icon(
        onPressed: () => _open(context, 'welcome'),
        icon: const Icon(Icons.apple),
        label: const Text('Continue with Apple'),
      ),
      const SizedBox(height: 12),
      const Text('Presentation preview'),
    ],
  );
}

class _Home extends StatelessWidget {
  const _Home();

  @override
  Widget build(BuildContext context) => _Page(
    title: 'Mylike',
    trailing: _CircleButton(
      Icons.grid_view,
      'All preview screens',
      () => _open(context, 'screens'),
    ),
    children: [
      const _Heading('Gabla', 'Mylike presentation preview'),
      const SizedBox(height: 14),
      InkWell(
        borderRadius: BorderRadius.circular(28),
        onTap: () => _open(context, 'search'),
        child: const _Panel(
          color: Colors.white,
          radius: 28,
          child: Row(
            children: [
              Icon(Icons.search),
              SizedBox(width: 10),
              Expanded(child: Text('Search products, services or places')),
            ],
          ),
        ),
      ),
      const SizedBox(height: 16),
      const _Section('Explore Gabla'),
      for (final pair in const [
        [
          (Icons.shopping_bag_outlined, 'Shop', 'shop'),
          (Icons.handyman_outlined, 'Services', 'services'),
        ],
        [
          (Icons.work_outline, 'Jobs', 'jobs'),
          (Icons.local_activity_outlined, 'Events', 'events'),
        ],
        [
          (Icons.local_taxi_outlined, 'Get a ride', 'ride'),
          (Icons.directions_bus_outlined, 'Bus tickets', 'bus'),
        ],
      ])
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: [
              for (final item in pair)
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => _open(context, item.$3),
                      child: _Panel(
                        color: item.$3 == 'events' ? _night : Colors.white,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              item.$1,
                              color: item.$3 == 'events' ? _orange : _ink,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              item.$2,
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontVariations: [FontVariation('wght', 800)],
                                color: item.$3 == 'events'
                                    ? Colors.white
                                    : _ink,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      const _Section('Coming up'),
      const _EventPoster(
        photo: _band,
        title: 'Trench Party',
        details: 'Live music · Lekki',
      ),
      const SizedBox(height: 12),
      const _RowLink(
        Icons.map_outlined,
        'Nearby',
        'Explore the sample map',
        'nearby',
      ),
      const _RowLink(
        Icons.person_outline,
        'Account',
        'Saved items and activity',
        'profile',
      ),
      const _RowLink(
        Icons.dashboard_outlined,
        'All preview screens',
        'Browse the full Mylike presentation',
        'screens',
      ),
    ],
  );
}
