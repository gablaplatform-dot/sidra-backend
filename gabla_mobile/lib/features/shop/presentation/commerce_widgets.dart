import 'package:url_launcher/url_launcher.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';
import '../../cart/application/cart_controller.dart';
import '../../settings/application/theme_controller.dart';

AppThemeStyle commerceStyle(WidgetRef ref) =>
    ref.watch(themeControllerProvider.select((p) => p.style));
double commerceRadius(AppThemeStyle style) => switch (style) {
  AppThemeStyle.editorial => 5,
  AppThemeStyle.discover => 30,
  AppThemeStyle.cinematic => 12,
  AppThemeStyle.orbit => 32,
  _ => 20,
};

class CommerceAppBar extends ConsumerWidget implements PreferredSizeWidget {
  const CommerceAppBar({
    super.key,
    required this.title,
    this.actions = const [],
  });
  final String title;
  final List<Widget> actions;
  @override
  Size get preferredSize => const Size.fromHeight(64);
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final style = commerceStyle(ref);
    return AppBar(
      title: Text(title),
      centerTitle:
          style == AppThemeStyle.discover || style == AppThemeStyle.orbit,
      actions: [
        ...actions,
        const CommerceCartButton(),
        const SizedBox(width: 8),
      ],
    );
  }
}

class CommerceCartButton extends ConsumerWidget {
  const CommerceCartButton({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => IconButton(
    tooltip: 'Shopping bag',
    onPressed: () => context.push('/cart'),
    icon: Badge(
      isLabelVisible: ref.watch(cartCountProvider) > 0,
      label: Text('${ref.watch(cartCountProvider)}'),
      child: const Icon(Icons.shopping_bag_outlined),
    ),
  );
}

class CommerceTitle extends StatelessWidget {
  const CommerceTitle(
    this.title, {
    super.key,
    this.subtitle,
    this.action,
    this.label = 'Explore',
  });
  final String title, label;
  final String? subtitle;
  final VoidCallback? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 22, bottom: 14),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppTypography.of(context).display(size: 26)),
              if (subtitle != null)
                Padding(
                  padding: const EdgeInsets.only(top: 5),
                  child: Text(
                    subtitle!,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
            ],
          ),
        ),
        if (action != null) TextButton(onPressed: action, child: Text(label)),
      ],
    ),
  );
}

class CommerceEmpty extends StatelessWidget {
  const CommerceEmpty({
    super.key,
    required this.title,
    required this.message,
    this.onAction,
    this.action = 'Explore the shop',
    this.icon = Icons.shopping_bag_outlined,
  });
  final String title, message, action;
  final IconData icon;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(28),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 48, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 20),
        Text(
          title,
          textAlign: TextAlign.center,
          style: AppTypography.of(context).display(size: 26),
        ),
        const SizedBox(height: 12),
        Text(message, textAlign: TextAlign.center),
        if (onAction != null)
          Padding(
            padding: const EdgeInsets.only(top: 20),
            child: FilledButton(onPressed: onAction, child: Text(action)),
          ),
      ],
    ),
  );
}

class CommerceLoading extends StatelessWidget {
  const CommerceLoading({super.key, this.rows = 3});
  final int rows;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (var i = 0; i < rows; i++)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Container(
            height: 116,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(20),
            ),
          ),
        ),
    ],
  );
}

class CommercePanel extends ConsumerWidget {
  const CommercePanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.index = 0,
  });
  final Widget child;
  final EdgeInsets padding;
  final int index;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final style = commerceStyle(ref);
    final c = Theme.of(context).colorScheme;
    return DesignEntrance(
      index: index,
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          color: c.surfaceContainerLow,
          borderRadius: BorderRadius.circular(commerceRadius(style)),
          border: style == AppThemeStyle.editorial
              ? Border(top: BorderSide(color: c.outlineVariant))
              : null,
        ),
        child: child,
      ),
    );
  }
}

class CommerceImage extends StatelessWidget {
  const CommerceImage(this.url, {super.key, this.fit = BoxFit.cover});
  final String? url;
  final BoxFit fit;
  @override
  Widget build(BuildContext context) {
    final fallback = ColoredBox(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Center(
        child: Icon(
          Icons.image_outlined,
          size: 32,
          color: Theme.of(context).colorScheme.outline,
        ),
      ),
    );
    return url == null || url!.isEmpty
        ? fallback
        : Image.network(url!, fit: fit, errorBuilder: (_, _, _) => fallback);
  }
}

/// Category-defined answers retain labels, units, booleans and safe URL actions.
class CommerceAttributes extends StatelessWidget {
  const CommerceAttributes({
    super.key,
    required this.values,
    this.fields = const [],
  });
  final Map<String, dynamic> values;
  final List<Map> fields;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      for (final entry in values.entries)
        if (entry.value != null &&
            entry.value.toString().isNotEmpty &&
            !(entry.value is List && (entry.value as List).isEmpty))
          Builder(
            builder: (context) {
              final field = fields
                  .where((f) => f['key'] == entry.key)
                  .firstOrNull;
              final value = entry.value is bool
                  ? (entry.value == true ? 'Yes' : 'No')
                  : entry.value is List
                  ? (entry.value as List).join(', ')
                  : entry.value.toString();
              final label =
                  field?['label']?.toString() ??
                  entry.key.replaceAllMapped(
                    RegExp('[A-Z]'),
                    (m) => ' ${m[0]}',
                  );
              final text = field?['unit'] == null
                  ? value
                  : '$value ${field!['unit']}';
              final uri = Uri.tryParse(
                value.startsWith('www.') ? 'https://$value' : value,
              );
              final link =
                  field?['type'] == 'url' &&
                  uri != null &&
                  ['https', 'http'].contains(uri.scheme);
              return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                subtitle: Text(
                  text,
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                    color: link ? Theme.of(context).colorScheme.primary : null,
                  ),
                ),
                trailing: link ? const Icon(Icons.open_in_new, size: 16) : null,
                onTap: link
                    ? () => launchUrl(uri, mode: LaunchMode.externalApplication)
                    : null,
              );
            },
          ),
    ],
  );
}
