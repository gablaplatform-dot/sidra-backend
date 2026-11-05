import '../../../core/sharing/share_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'community_design.dart';
import '../../../core/location/google_route_map.dart';
import '../../../core/media/sound_video_screen.dart';
import '../../../core/motion/design_transitions.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/theme/font_group.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../auth/application/session_controller.dart';
import '../../ride/domain/ride_location.dart';
import '../../settings/application/theme_controller.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../workspace/presentation/workspace_form.dart';
import '../application/community_providers.dart';

bool communitySignIn(BuildContext context, WidgetRef ref, String next) {
  if (ref.read(isSignedInProvider)) return true;
  context.push(Uri(path: '/login', queryParameters: {'next': next}).toString());
  return false;
}

Future<Map<String, dynamic>?> communityForm(
  BuildContext context, {
  required String title,
  required List<WorkspaceField> fields,
  Map<String, dynamic> initial = const {},
}) async {
  Map<String, dynamic>? result;
  final style = ProviderScope.containerOf(
    context,
    listen: false,
  ).read(themeControllerProvider).style;
  await showModalBottomSheet<bool>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    showDragHandle: true,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: Radius.circular(communityRadius(style)),
      ),
    ),
    builder: (_) => CommunityDesignScope(
      style: style,
      child: WorkspaceForm(
        title: title,
        action: title != 'Narrow your search'
            ? 'Send application'
            : 'Apply filters',
        fields: fields
            .map(
              (f) => WorkspaceField(
                f.keyName,
                f.label,
                type: f.type,
                required: f.required,
                options: f.options,
                labels: f.labels,
                value: initial[f.keyName] ?? f.value,
              ),
            )
            .toList(),
        save: (values) async {
          result = values;
        },
      ),
    ),
  );
  return result;
}

String prettyCommunity(String? value) {
  if (value == 'onsite') return 'On-site';
  final text = (value ?? '').replaceAll('_', ' ');
  return text.isEmpty ? text : '${text[0].toUpperCase()}${text.substring(1)}';
}

String eventDate(Map post) {
  final date = DateTime.tryParse('${post['startsAt']}');
  return date == null
      ? 'Date to be announced'
      : DateFormat('EEE, d MMM · HH:mm').format(date.toLocal());
}

class CommunityHubScreen extends ConsumerStatefulWidget {
  const CommunityHubScreen({
    super.key,
    required this.kind,
    this.scope = 'browse',
  });
  final String kind, scope;
  @override
  ConsumerState<CommunityHubScreen> createState() => _CommunityHubScreenState();
}

class _CommunityHubScreenState extends ConsumerState<CommunityHubScreen> {
  final _search = TextEditingController();
  String _q = '', _category = '', _type = '', _workplace = '', _district = '';
  int _page = 1;
  bool get filtered =>
      [_q, _category, _type, _workplace, _district].any((v) => v.isNotEmpty);
  void clearFilters() => setState(() {
    _search.clear();
    _q = _category = _type = _workplace = _district = '';
    _page = 1;
  });
  bool get event => widget.kind == 'events';
  String get endpoint => Uri(
    path:
        '/${widget.kind}${widget.scope == 'browse' ? '' : '/${widget.scope}'}',
    queryParameters: {
      'page': '$_page',
      'limit': '20',
      if (_q.isNotEmpty) 'q': _q,
      if (_category.isNotEmpty) 'category': _category,
      if (_type.isNotEmpty) 'jobType': _type,
      if (_workplace.isNotEmpty) 'workplace': _workplace,
      if (_district.isNotEmpty) 'district': _district,
    },
  ).toString();
  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme,
        style = ref.watch(themeControllerProvider).style;
    final private = widget.scope != 'browse';
    return CommunityDesignScope(
      style: style,
      child: Scaffold(
        appBar: CommunityAppBar(
          title: widget.scope == 'mine'
              ? 'My ${widget.kind}'
              : widget.scope == 'saved'
              ? 'Saved ${widget.kind}'
              : event
              ? 'Events'
              : 'Jobs',
          actions: [
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_horiz),
              onSelected: (v) {
                if (communitySignIn(context, ref, '/${widget.kind}/$v'))
                  context.push('/${widget.kind}/$v');
              },
              itemBuilder: (_) => [
                PopupMenuItem(value: 'mine', child: Text('My ${widget.kind}')),
                PopupMenuItem(
                  value: 'saved',
                  child: Text('Saved ${widget.kind}'),
                ),
                if (!event)
                  const PopupMenuItem(
                    value: 'applications',
                    child: Text('My applications'),
                  ),
              ],
            ),
          ],
        ),
        bottomNavigationBar: Container(
          decoration: BoxDecoration(
            color: c.surface,
            border: Border(top: BorderSide(color: c.outlineVariant)),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 10, 18, 10),
              child: FilledButton.icon(
                onPressed: () {
                  if (communitySignIn(context, ref, '/${widget.kind}/new'))
                    context.push('/${widget.kind}/new');
                },
                icon: const Icon(Icons.add, size: 18),
                label: Text(event ? 'Create an event' : 'Post a job or task'),
              ),
            ),
          ),
        ),
        body: private && !ref.watch(isSignedInProvider)
            ? CommerceEmpty(
                title: widget.scope == 'saved'
                    ? 'Saved ${widget.kind}'
                    : 'My ${widget.kind}',
                message: widget.scope == 'saved'
                    ? 'Sign in to see posts you saved.'
                    : 'Sign in to manage posts you created.',
                action: 'Sign in',
                onAction: () => communitySignIn(
                  context,
                  ref,
                  '/${widget.kind}/${widget.scope}',
                ),
              )
            : RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(communityEndpointProvider(endpoint));
                },
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                  children: [
                    if (private) ...[
                      CommunityPageHeading(
                        style: style,
                        eyebrow: widget.scope == 'saved'
                            ? 'Saved posts'
                            : 'Your posts',
                        title: widget.scope == 'saved'
                            ? 'Saved ${widget.kind}'
                            : 'My ${widget.kind}',
                        description: widget.scope == 'saved'
                            ? event
                                  ? 'Events you marked as interested or going.'
                                  : 'Jobs and paid tasks you saved for later.'
                            : 'Open a post to check its review status, edit details${event ? ' or cancel it.' : ', view applicants or close it.'}',
                        icon: widget.scope == 'saved'
                            ? Icons.bookmark_border
                            : Icons.edit_outlined,
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (!private) ...[
                      CommunityBrowseHeader(style: style, event: event),
                      const SizedBox(height: 22),
                      TextField(
                        controller: _search,
                        onSubmitted: (v) => setState(() {
                          _q = v.trim();
                          _page = 1;
                        }),
                        decoration:
                            InputDecoration(
                              hintText: event
                                  ? 'Event, organizer or keyword'
                                  : 'Job, company or keyword',
                              prefixIcon: const Icon(Icons.search),
                              suffixIcon: IconButton(
                                tooltip: 'Search',
                                onPressed: () => setState(() {
                                  _q = _search.text.trim();
                                  _page = 1;
                                }),
                                icon: const Icon(Icons.arrow_forward),
                              ),
                            ).applyDefaults(
                              communityTheme(
                                Theme.of(context),
                                style,
                              ).inputDecorationTheme,
                            ),
                      ),
                      const SizedBox(height: 12),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            for (final cat in [
                              '',
                              ...(event ? eventCategories : jobCategories),
                            ])
                              Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                  label: Text(cat.isEmpty ? 'All' : cat),
                                  selected: _category == cat,
                                  onSelected: (_) => setState(() {
                                    _category = cat;
                                    _page = 1;
                                  }),
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (!event)
                        Wrap(
                          spacing: 8,
                          children: [
                            for (final entry in {
                              '': 'All work',
                              'vacancy': 'Vacancies',
                              'task': 'Paid tasks',
                            }.entries)
                              ChoiceChip(
                                label: Text(entry.value),
                                selected: _type == entry.key,
                                onSelected: (_) => setState(() {
                                  _type = entry.key;
                                  _page = 1;
                                }),
                              ),
                          ],
                        ),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          icon: const Icon(Icons.tune, size: 18),
                          label: Text(
                            _district.isEmpty && _workplace.isEmpty
                                ? 'Location & filters'
                                : 'Filters active',
                          ),
                          onPressed: () async {
                            final result = await communityForm(
                              context,
                              title: 'Narrow your search',
                              initial: {
                                'district': _district,
                                'workplace': _workplace,
                              },
                              fields: [
                                const WorkspaceField('district', 'District'),
                                if (!event)
                                  const WorkspaceField(
                                    'workplace',
                                    'Workplace',
                                    type: 'select',
                                    options: ['', 'onsite', 'hybrid', 'remote'],
                                    labels: {
                                      '': 'Any workplace',
                                      'onsite': 'On-site',
                                      'hybrid': 'Hybrid',
                                      'remote': 'Remote',
                                    },
                                  ),
                              ],
                            );
                            if (result != null && mounted)
                              setState(() {
                                _district = '${result['district'] ?? ''}'
                                    .trim();
                                _workplace = '${result['workplace'] ?? ''}';
                                _page = 1;
                              });
                          },
                        ),
                      ),
                    ],
                    if (!private && filtered)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: clearFilters,
                          icon: const Icon(Icons.close, size: 16),
                          label: const Text('Clear search & filters'),
                        ),
                      ),
                    const SizedBox(height: 16),
                    AsyncValueView<Map<String, dynamic>>(
                      value: ref.watch(communityEndpointProvider(endpoint)),
                      onRetry: () =>
                          ref.invalidate(communityEndpointProvider(endpoint)),
                      data: (context, data) {
                        final items = communityItems(data),
                            total =
                                (data['total'] as num?)?.toInt() ??
                                items.length;
                        if (items.isEmpty)
                          return CommunityEmptyState(
                            event: event,
                            private: private,
                            scope: widget.scope,
                            filtered: filtered,
                            onAction: private
                                ? () => widget.scope == 'saved'
                                      ? context.push('/${widget.kind}')
                                      : context.push('/${widget.kind}/new')
                                : filtered
                                ? clearFilters
                                : null,
                          );
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              '$total ${event ? (total == 1 ? 'event' : 'events') : (total == 1 ? 'opportunity' : 'opportunities')}',
                              style: TextStyle(
                                color: c.onSurfaceVariant,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 14),
                            for (var i = 0; i < items.length; i++)
                              Padding(
                                padding: EdgeInsets.only(
                                  bottom: style == AppThemeStyle.editorial
                                      ? 22
                                      : 16,
                                ),
                                child: DesignEntrance(
                                  index: i,
                                  child: CommunityPostCard(
                                    post: items[i],
                                    style: style,
                                    onTap: () => context.push(
                                      '/${widget.kind}/p/${items[i]['id']}',
                                    ),
                                  ),
                                ),
                              ),
                            if (total > 20)
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  TextButton(
                                    onPressed: _page > 1
                                        ? () => setState(() => _page--)
                                        : null,
                                    child: const Text('Previous'),
                                  ),
                                  Text('Page $_page'),
                                  TextButton(
                                    onPressed: _page * 20 < total
                                        ? () => setState(() => _page++)
                                        : null,
                                    child: const Text('Next'),
                                  ),
                                ],
                              ),
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

class CommunityPostCard extends StatelessWidget {
  const CommunityPostCard({
    super.key,
    required this.post,
    required this.style,
    required this.onTap,
  });
  final Map<String, dynamic> post;
  final AppThemeStyle style;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    final event = post['kind'] == 'event';
    final media = (post['media'] as List? ?? []).cast<Map>();
    final poster =
        media.where((m) => m['type'] == 'image').firstOrNull?['url'] as String?;
    final organization = '${post['organization'] ?? ''}'.trim();
    final location = '${post['district'] ?? ''}'.trim().isNotEmpty
        ? '${post['district']}'
        : '${post['address'] ?? ''}';
    final metadata = event
        ? eventDate(post)
        : [
            post['jobType'] == 'task'
                ? 'Paid task'
                : prettyCommunity(post['employmentType'] as String?),
            prettyCommunity(post['workplace'] as String?),
          ].where((v) => v.isNotEmpty).join(' · ');
    Widget image(double height) => SizedBox(
      height: height,
      width: double.infinity,
      child: Hero(
        tag: 'community-${post['id']}',
        child: poster == null
            ? CommunityMediaPlaceholder(style: style, event: event)
            : Image.network(
                poster,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => ColoredBox(
                  color: c.secondaryContainer,
                  child: Icon(
                    Icons.image_outlined,
                    color: c.onSecondaryContainer,
                  ),
                ),
              ),
      ),
    );
    Widget facts() => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (organization.isNotEmpty) ...[
          Text(
            organization,
            style: TextStyle(
              color: c.onSurfaceVariant,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 7),
        ],
        Text(
          '${post['title'] ?? ''}',
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.of(
            context,
          ).display(size: style == AppThemeStyle.cinematic ? 27 : 23),
        ),
        const SizedBox(height: 12),
        if (metadata.isNotEmpty)
          Text(
            metadata,
            style: TextStyle(
              color: c.onSurfaceVariant,
              fontSize: 13,
              height: 1.5,
            ),
          ),
        if (location.isNotEmpty) ...[
          const SizedBox(height: 7),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.place_outlined, size: 16, color: c.onSurfaceVariant),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  location,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: c.onSurfaceVariant,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        ],
        const SizedBox(height: 16),
        Text(
          communityPay(post),
          style: TextStyle(
            color: c.primary,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        if (!event && communityPayPeriod(post).isNotEmpty) ...[
          const SizedBox(height: 3),
          Text(
            communityPayPeriod(post),
            style: TextStyle(color: c.onSurfaceVariant, fontSize: 12),
          ),
        ],
        if ('${post['status'] ?? ''}'.isNotEmpty &&
            post['status'] != 'approved') ...[
          const SizedBox(height: 12),
          Text(
            'Status: ${prettyCommunity(post['status'] as String?)}',
            style: TextStyle(
              color: c.onSurfaceVariant,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ],
    );
    final content = switch (style) {
      AppThemeStyle.gabla => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (event) image(poster == null ? 72 : 180),
          Padding(padding: const EdgeInsets.all(18), child: facts()),
        ],
      ),
      AppThemeStyle.editorial => LayoutBuilder(
        builder: (context, box) {
          final sideImage =
              event &&
              poster != null &&
              box.maxWidth >= 360 &&
              MediaQuery.textScalerOf(context).scale(14) <= 18;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: sideImage
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: facts()),
                      const SizedBox(width: 18),
                      SizedBox(width: 110, child: image(140)),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (event && poster != null) ...[
                        image(180),
                        const SizedBox(height: 16),
                      ],
                      facts(),
                    ],
                  ),
          );
        },
      ),
      AppThemeStyle.discover => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (poster != null) image(event ? 200 : 140),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: c.primary, width: 3)),
            ),
            child: facts(),
          ),
        ],
      ),
      AppThemeStyle.cinematic => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (event && poster != null) image(240),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '${post['category'] ?? (event ? 'Event' : 'Job')}',
                  style: TextStyle(
                    color: c.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Divider(height: 26),
                facts(),
              ],
            ),
          ),
        ],
      ),
      AppThemeStyle.orbit => Padding(
        padding: const EdgeInsets.all(16),
        child: LayoutBuilder(
          builder: (context, box) {
            if (box.maxWidth < 280 ||
                MediaQuery.textScalerOf(context).scale(14) > 18)
              return facts();
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(width: 58, child: image(event ? 76 : 58)),
                const SizedBox(width: 14),
                Expanded(child: facts()),
              ],
            );
          },
        ),
      ),
    };
    return Semantics(
      button: true,
      child: Material(
        color: style == AppThemeStyle.editorial
            ? c.surface
            : c.surfaceContainerLow,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(communityRadius(style)),
          side: style == AppThemeStyle.orbit
              ? BorderSide(color: c.outlineVariant)
              : BorderSide.none,
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              content,
              if (style == AppThemeStyle.editorial) const Divider(height: 1),
            ],
          ),
        ),
      ),
    );
  }
}

class CommunityDetailScreen extends ConsumerStatefulWidget {
  const CommunityDetailScreen({
    super.key,
    required this.kind,
    required this.id,
  });
  final String kind, id;
  @override
  ConsumerState<CommunityDetailScreen> createState() =>
      _CommunityDetailScreenState();
}

class _CommunityDetailScreenState extends ConsumerState<CommunityDetailScreen> {
  bool _busy = false;
  String get endpoint => '/${widget.kind}/${widget.id}';
  Future<void> _mutate(Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      ref.invalidate(communityEndpointProvider(endpoint));
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => CommunityDesignScope(
    style: ref.watch(themeControllerProvider).style,
    child: Scaffold(
      appBar: CommunityAppBar(
        title: widget.kind == 'events' ? 'Event details' : 'Opportunity',
        actions: [
          if (ref.watch(communityEndpointProvider(endpoint)).value?['status'] ==
              'approved')
            IconButton(
              tooltip: 'Share ${widget.kind == 'events' ? 'event' : 'job'}',
              icon: const Icon(Icons.ios_share_outlined),
              onPressed: () => shareGablaItem(
                context,
                type: widget.kind == 'events' ? 'event' : 'job',
                id: widget.id,
                title:
                    '${ref.read(communityEndpointProvider(endpoint)).value?['title'] ?? 'Discover it on Gabla'}',
              ),
            ),
        ],
      ),
      body: AsyncValueView<Map<String, dynamic>>(
        value: ref.watch(communityEndpointProvider(endpoint)),
        onRetry: () => ref.invalidate(communityEndpointProvider(endpoint)),
        data: (context, post) {
          final event = widget.kind == 'events',
              details = Map<String, dynamic>.from(
                post['details'] as Map? ?? {},
              ),
              media = (post['media'] as List? ?? []).cast<Map>();
          final mine = post['canManage'] == true,
              poster =
                  media.where((m) => m['type'] == 'image').firstOrNull?['url']
                      as String?;
          final active = post['status'] == 'approved',
              c = Theme.of(context).colorScheme;
          final deadline = DateTime.tryParse('${post['deadline']}'),
              ends = DateTime.tryParse('${post['endsAt']}');
          final available =
              active &&
              (event
                  ? (ends?.isAfter(DateTime.now()) ?? false)
                  : (deadline == null || deadline.isAfter(DateTime.now())));
          Future<void> respond(String? status) => _mutate(() async {
            if (!communitySignIn(
              context,
              ref,
              '/${widget.kind}/p/${widget.id}',
            ))
              return;
            await ref
                .read(apiClientProvider)
                .put('$endpoint/response', body: {'status': status});
          });
          return ListView(
            padding: const EdgeInsets.fromLTRB(20, 10, 20, 40),
            children: [
              CommunityDetailMasthead(
                style: ref.watch(themeControllerProvider).style,
                post: post,
                poster: poster,
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if ('${post['category'] ?? ''}'.isNotEmpty)
                    Chip(label: Text('${post['category']}')),
                  if ('${post['district'] ?? ''}'.isNotEmpty)
                    Chip(label: Text('${post['district']}')),
                  if (!event)
                    Chip(
                      label: Text(
                        prettyCommunity(post['workplace'] as String?),
                      ),
                    ),
                  if (!active)
                    Chip(
                      label: Text(prettyCommunity(post['status'] as String?)),
                    ),
                ],
              ),
              const SizedBox(height: 18),
              Text(
                communityPay(post),
                style: AppTypography.of(
                  context,
                ).display(size: 28, color: c.primary),
              ),
              if (!event && communityPayPeriod(post).isNotEmpty)
                Text(
                  communityPayPeriod(post),
                  style: TextStyle(color: c.onSurfaceVariant),
                ),
              if (!event) ...[
                const SizedBox(height: 18),
                if ('${post['employmentType'] ?? ''}'.isNotEmpty)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.work_outline),
                    title: Text(
                      post['jobType'] == 'task'
                          ? 'Paid task'
                          : prettyCommunity(post['employmentType'] as String?),
                    ),
                    subtitle: Text(
                      prettyCommunity(post['workplace'] as String?),
                    ),
                  ),
                if ('${post['address'] ?? ''}'.isNotEmpty)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.place_outlined),
                    title: Text('${post['address']}'),
                  ),
                if (deadline != null)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.schedule_outlined),
                    title: Text(
                      'Apply by ${DateFormat('d MMM yyyy').format(deadline.toLocal())}',
                    ),
                  ),
              ],
              if (event) ...[
                const SizedBox(height: 14),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.calendar_month_outlined),
                  title: Text(eventDate(post)),
                  subtitle: Text(
                    '${post['organization']} · ${post['address']}',
                  ),
                ),
                if ('${details['entranceNote'] ?? ''}'.isNotEmpty)
                  Text('${details['entranceNote']}'),
                if ('${details['ageRestriction'] ?? ''}'.isNotEmpty)
                  Text('${details['ageRestriction']}'),
              ],
              if (event && ends != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Ends ${DateFormat('EEE, d MMM · HH:mm').format(ends.toLocal())}',
                    style: TextStyle(color: c.onSurfaceVariant),
                  ),
                ),
              const SizedBox(height: 22),
              Text(
                event ? 'About the event' : 'About this opportunity',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              SelectableText(
                '${post['description']}',
                style: const TextStyle(height: 1.65),
              ),
              if ('${details['requirements'] ?? ''}'.isNotEmpty) ...[
                const SizedBox(height: 22),
                Text(
                  'What you’ll need',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 10),
                SelectableText(
                  '${details['requirements']}',
                  style: const TextStyle(height: 1.6),
                ),
              ],
              if (media.isNotEmpty) ...[
                const SizedBox(height: 24),
                SizedBox(
                  height: 110,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: media.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemBuilder: (context, i) => InkWell(
                      onTap: () => media[i]['type'] == 'video'
                          ? openSoundVideo(context, '${media[i]['url']}')
                          : showDialog<void>(
                              context: context,
                              builder: (_) => Dialog(
                                child: InteractiveViewer(
                                  child: Image.network('${media[i]['url']}'),
                                ),
                              ),
                            ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(
                          communityRadius(
                            ref.watch(themeControllerProvider).style,
                          ),
                        ),
                        child: SizedBox(
                          width: 130,
                          child: media[i]['type'] == 'video'
                              ? const ColoredBox(
                                  color: Colors.black87,
                                  child: Icon(
                                    Icons.play_circle,
                                    color: Colors.white,
                                    size: 42,
                                  ),
                                )
                              : Image.network(
                                  '${media[i]['url']}',
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) =>
                                      const Icon(Icons.image_outlined),
                                ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
              if (post['lat'] is num && post['lng'] is num) ...[
                const SizedBox(height: 24),
                GoogleRouteMap(
                  from: RideLocation(
                    lat: (post['lat'] as num).toDouble(),
                    lng: (post['lng'] as num).toDouble(),
                    address: '${post['address']}',
                  ),
                  fromLabel: event ? 'Venue' : 'Work location',
                  height: 240,
                ),
              ],
              if ('${details['phone'] ?? ''}'.isNotEmpty)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.phone_outlined),
                  title: Text('${details['phone']}'),
                  onTap: () => launchUrl(
                    Uri(scheme: 'tel', path: '${details['phone']}'),
                  ),
                ),
              if ('${details['email'] ?? ''}'.isNotEmpty)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.mail_outline),
                  title: Text('${details['email']}'),
                  onTap: () => launchUrl(
                    Uri(scheme: 'mailto', path: '${details['email']}'),
                  ),
                ),
              const SizedBox(height: 24),
              if (mine) ...[
                if ('${post['moderationNote'] ?? ''}'.isNotEmpty)
                  Text('Review note: ${post['moderationNote']}'),
                FilledButton.icon(
                  onPressed: _busy
                      ? null
                      : () => context.push('/${widget.kind}/edit/${widget.id}'),
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Edit post'),
                ),
                if (!event)
                  OutlinedButton(
                    onPressed: () =>
                        context.push('/jobs/applicants/${widget.id}'),
                    child: Text(
                      'View applicants (${post['applicationCount'] ?? 0})',
                    ),
                  ),
                if (!['closed', 'cancelled'].contains(post['status']))
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () async {
                            final yes = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: Text(
                                  event
                                      ? 'Cancel this event?'
                                      : 'Close this opportunity?',
                                ),
                                content: const Text(
                                  'It will be removed from public discovery.',
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(ctx, false),
                                    child: const Text('Keep post'),
                                  ),
                                  FilledButton(
                                    onPressed: () => Navigator.pop(ctx, true),
                                    child: const Text('Confirm'),
                                  ),
                                ],
                              ),
                            );
                            if (yes == true)
                              _mutate(() async {
                                await ref
                                    .read(apiClientProvider)
                                    .post('$endpoint/close');
                              });
                          },
                    child: Text(event ? 'Cancel event' : 'Close post'),
                  ),
              ] else if (available) ...[
                if (event)
                  FilledButton.icon(
                    onPressed: _busy
                        ? null
                        : () => respond(
                            post['myResponse'] == 'going' ? null : 'going',
                          ),
                    icon: const Icon(Icons.event_available_outlined),
                    label: Text(
                      post['myResponse'] == 'going'
                          ? 'You’re going · Undo'
                          : 'I’m going',
                    ),
                  )
                else
                  FilledButton(
                    onPressed: _busy || post['myApplication'] != null
                        ? null
                        : () async {
                            if (!communitySignIn(
                              context,
                              ref,
                              '/jobs/p/${widget.id}',
                            ))
                              return;
                            final form = await communityForm(
                              context,
                              title: 'Apply for this job',
                              fields: const [
                                WorkspaceField(
                                  'coverLetter',
                                  'Why are you a good fit?',
                                  type: 'long',
                                  required: true,
                                ),
                                WorkspaceField('phone', 'Phone'),
                                WorkspaceField(
                                  'portfolioUrl',
                                  'Portfolio or CV link (HTTPS)',
                                ),
                              ],
                            );
                            if (form != null)
                              _mutate(() async {
                                await ref
                                    .read(apiClientProvider)
                                    .post('$endpoint/apply', body: form);
                              });
                          },
                    child: Text(
                      post['myApplication'] != null
                          ? 'Application: ${prettyCommunity(post['myApplication']['status'] as String?)}'
                          : 'Apply now',
                    ),
                  ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: _busy
                      ? null
                      : () => respond(
                          post['myResponse'] != null
                              ? null
                              : (event ? 'interested' : 'saved'),
                        ),
                  icon: Icon(
                    post['myResponse'] != null
                        ? Icons.bookmark
                        : Icons.bookmark_border,
                  ),
                  label: Text(
                    post['myResponse'] != null
                        ? event && post['myResponse'] == 'going'
                              ? 'Remove going response'
                              : 'Remove from saved'
                        : 'Save for later',
                  ),
                ),
                if (event &&
                    '${details['bookingUrl'] ?? ''}'.startsWith('https://'))
                  TextButton.icon(
                    onPressed: () => launchUrl(
                      Uri.parse('${details['bookingUrl']}'),
                      mode: LaunchMode.externalApplication,
                    ),
                    icon: const Icon(Icons.open_in_new),
                    label: const Text('Organizer’s booking page'),
                  ),
              ] else
                const Text('This post is not currently accepting responses.'),
            ],
          );
        },
      ),
    ),
  );
}

class CommunityApplicationsScreen extends ConsumerStatefulWidget {
  const CommunityApplicationsScreen({super.key, this.postId});
  final String? postId;
  @override
  ConsumerState<CommunityApplicationsScreen> createState() =>
      _ApplicationsState();
}

class _ApplicationsState extends ConsumerState<CommunityApplicationsScreen> {
  final _pending = <String>{};
  String get endpoint => widget.postId == null
      ? '/jobs/applications/mine'
      : '/jobs/${widget.postId}/applicants';
  Future<void> updateStatus(
    Map<String, dynamic> application,
    String status,
  ) async {
    final id = '${application['id']}';
    if (_pending.contains(id)) return;
    setState(() => _pending.add(id));
    try {
      await ref
          .read(apiClientProvider)
          .patch('/jobs/applications/$id', body: {'status': status});
      ref.invalidate(communityEndpointProvider);
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('$e')));
    } finally {
      if (mounted) setState(() => _pending.remove(id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final style = ref.watch(themeControllerProvider).style;
    final mine = widget.postId == null;
    return CommunityDesignScope(
      style: style,
      child: Builder(
        builder: (context) {
          final c = Theme.of(context).colorScheme;
          final title = mine ? 'My applications' : 'Applicants';
          return Scaffold(
            appBar: CommunityAppBar(title: title),
            body: !ref.watch(isSignedInProvider)
                ? CommerceEmpty(
                    title: title,
                    message: mine
                        ? 'Sign in to view applications you sent.'
                        : 'Sign in to review applications to your post.',
                    action: 'Sign in',
                    onAction: () => communitySignIn(
                      context,
                      ref,
                      mine
                          ? '/jobs/applications'
                          : '/jobs/applicants/${widget.postId}',
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: () async =>
                        ref.invalidate(communityEndpointProvider(endpoint)),
                    child: AsyncValueView<Map<String, dynamic>>(
                      value: ref.watch(communityEndpointProvider(endpoint)),
                      onRetry: () =>
                          ref.invalidate(communityEndpointProvider(endpoint)),
                      data: (context, data) {
                        final items = communityItems(data);
                        return ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(18, 8, 18, 28),
                          children: [
                            CommunityPageHeading(
                              style: style,
                              eyebrow: mine ? 'Job search' : 'Your job post',
                              title: title,
                              description: mine
                                  ? 'Check the status of applications you sent. Open a job to revisit its details.'
                                  : 'Read each application and update its review status.',
                              icon: Icons.assignment_outlined,
                            ),
                            const SizedBox(height: 24),
                            if (items.isEmpty) ...[
                              Icon(
                                Icons.assignment_outlined,
                                size: 28,
                                color: c.primary,
                              ),
                              const SizedBox(height: 16),
                              Text(
                                'No applications yet',
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                              const SizedBox(height: 10),
                              Text(
                                mine
                                    ? 'When you apply for a job or paid task, your application will appear here.'
                                    : 'Applications to this post will appear here after people submit them.',
                                style: TextStyle(
                                  color: c.onSurfaceVariant,
                                  height: 1.5,
                                ),
                              ),
                              const SizedBox(height: 18),
                              OutlinedButton(
                                onPressed: () => context.push(
                                  mine ? '/jobs' : '/jobs/p/${widget.postId}',
                                ),
                                child: Text(
                                  mine ? 'Browse jobs' : 'View job post',
                                ),
                              ),
                            ] else ...[
                              Text(
                                '${items.length} ${items.length == 1 ? 'application' : 'applications'}',
                                style: TextStyle(
                                  color: c.onSurfaceVariant,
                                  fontSize: 13,
                                ),
                              ),
                              const SizedBox(height: 14),
                              for (var i = 0; i < items.length; i++)
                                DesignEntrance(
                                  index: i,
                                  child: record(context, items[i], style, mine),
                                ),
                            ],
                          ],
                        );
                      },
                    ),
                  ),
          );
        },
      ),
    );
  }

  Widget record(
    BuildContext context,
    Map<String, dynamic> application,
    AppThemeStyle style,
    bool mine,
  ) {
    final c = Theme.of(context).colorScheme;
    final user = application['user'] as Map? ?? {};
    final post = application['post'] as Map? ?? {};
    final title = mine
        ? '${post['title'] ?? 'Job unavailable'}'
        : '${user['name'] ?? 'Applicant'}';
    final date = DateTime.tryParse('${application['createdAt']}')?.toLocal();
    final status = '${application['status'] ?? ''}';
    final pending = _pending.contains('${application['id']}');
    final actions = mine
        ? {'withdrawn': 'Withdraw application'}
        : {
            'reviewed': 'Mark reviewed',
            'shortlisted': 'Shortlist',
            'declined': 'Decline',
          };
    return CommunityRecordSurface(
      style: style,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            prettyCommunity(status),
            style: TextStyle(
              color: c.primary,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text(title, style: AppTypography.of(context).display(size: 23)),
          if (mine && '${post['organization'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              '${post['organization']}',
              style: TextStyle(color: c.onSurfaceVariant),
            ),
          ],
          if (date != null) ...[
            const SizedBox(height: 8),
            Text(
              'Applied ${DateFormat('d MMM yyyy').format(date)}',
              style: TextStyle(color: c.onSurfaceVariant, fontSize: 12),
            ),
          ],
          if (!mine) ...[
            const Divider(height: 28),
            for (final contact in [
              '${user['email'] ?? ''}',
              '${application['phone'] ?? ''}',
            ])
              if (contact.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: SelectableText(contact),
                ),
            const SizedBox(height: 8),
            Text(
              'Application',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: c.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            SelectableText(
              '${application['coverLetter'] ?? ''}',
              style: const TextStyle(height: 1.6),
            ),
            if ('${application['portfolioUrl'] ?? ''}'.startsWith('https://'))
              TextButton.icon(
                onPressed: () => launchUrl(
                  Uri.parse('${application['portfolioUrl']}'),
                  mode: LaunchMode.externalApplication,
                ),
                icon: const Icon(Icons.open_in_new, size: 16),
                label: const Text('Open portfolio / CV'),
              ),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (mine && post['id'] != null)
                TextButton.icon(
                  onPressed: () => context.push('/jobs/p/${post['id']}'),
                  icon: const Icon(Icons.arrow_forward, size: 16),
                  label: const Text('View job'),
                ),
              if (status != 'withdrawn')
                for (final action in actions.entries)
                  OutlinedButton(
                    onPressed: pending || status == action.key
                        ? null
                        : () => updateStatus(application, action.key),
                    child: Text(action.value),
                  ),
            ],
          ),
          if (pending)
            const Padding(
              padding: EdgeInsets.only(top: 10),
              child: Text(
                'Updating application…',
                semanticsLabel: 'Updating application',
              ),
            ),
        ],
      ),
    );
  }
}
