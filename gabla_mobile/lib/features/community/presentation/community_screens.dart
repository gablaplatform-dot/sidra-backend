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
                title: 'Your ${widget.kind}, together',
                message: 'Sign in to manage your posts and saved discoveries.',
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
                  padding: const EdgeInsets.fromLTRB(18, 8, 18, 24),
                  children: [
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
                                  ? 'Artist, venue or event'
                                  : 'Role, company or skill',
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
    final event = post['kind'] == 'event', c = Theme.of(context).colorScheme;
    final media = (post['media'] as List? ?? []).cast<Map>();
    final poster =
        media.where((m) => m['type'] == 'image').firstOrNull?['url'] as String?;
    final picture = poster == null
        ? (event
              ? Image.asset(
                  'assets/artwork/community-concert.png',
                  fit: BoxFit.cover,
                )
              : ColoredBox(
                  color: c.primaryContainer,
                  child: Center(
                    child: Text(
                      '${post['organization'] ?? 'G'}'.isEmpty
                          ? 'G'
                          : '${post['organization'] ?? 'G'}'[0].toUpperCase(),
                      style: TextStyle(
                        color: c.onPrimaryContainer,
                        fontWeight: FontWeight.w800,
                        fontSize: 38,
                      ),
                    ),
                  ),
                ))
        : Image.network(
            poster,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const Icon(Icons.image_outlined),
          );
    final radius = communityRadius(style);
    Widget words({Color? ink}) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '${post['organization'] ?? ''}'.isEmpty
              ? (event ? 'LOCAL EVENT' : 'OPPORTUNITY')
              : '${post['organization']}',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.5,
            color: ink ?? c.primary,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          '${post['title']}',
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.of(
            context,
          ).display(size: event ? 25 : 23, color: ink),
        ),
        const SizedBox(height: 12),
        Text(
          event
              ? eventDate(post)
              : '${prettyCommunity(post['employmentType'] as String?)} · ${prettyCommunity(post['workplace'] as String?)}',
          style: TextStyle(
            fontSize: 12,
            color: ink?.withValues(alpha: .85) ?? c.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 7),
        Text(
          '${post['district'] ?? ''}',
          style: TextStyle(
            fontSize: 12,
            color: ink?.withValues(alpha: .8) ?? c.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 14),
        Text(
          communityPay(post),
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: ink ?? c.primary,
          ),
        ),
        if (post['status'] != 'approved')
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Chip(
              label: Text(prettyCommunity(post['status'] as String?)),
            ),
          ),
      ],
    );
    Widget content;
    if (event && style == AppThemeStyle.discover) {
      content = Stack(
        children: [
          SizedBox(
            height: 350,
            width: double.infinity,
            child: Hero(tag: 'community-${post['id']}', child: picture),
          ),
          const Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Colors.black87],
                ),
              ),
            ),
          ),
          Positioned(
            left: 22,
            right: 22,
            bottom: 22,
            child: words(ink: Colors.white),
          ),
        ],
      );
    } else if (event && style == AppThemeStyle.editorial) {
      content = Row(
        children: [
          Expanded(
            child: SizedBox(
              height: 285,
              child: Hero(tag: 'community-${post['id']}', child: picture),
            ),
          ),
          Expanded(
            child: Padding(padding: const EdgeInsets.all(16), child: words()),
          ),
        ],
      );
    } else if (event && style == AppThemeStyle.orbit) {
      content = Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: c.secondaryContainer,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  eventDate(post),
                  style: TextStyle(
                    fontSize: 11,
                    color: c.onSecondaryContainer,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 90,
                  height: 110,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: Hero(tag: 'community-${post['id']}', child: picture),
                  ),
                ),
                const SizedBox(width: 18),
                Expanded(child: words()),
              ],
            ),
          ],
        ),
      );
    } else if (event && style == AppThemeStyle.cinematic) {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 330,
            child: Hero(tag: 'community-${post['id']}', child: picture),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(width: 42, height: 3, color: c.primary),
                const SizedBox(height: 20),
                words(),
              ],
            ),
          ),
        ],
      );
    } else if (event) {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: style == AppThemeStyle.orbit ? 170 : 205,
            child: Hero(tag: 'community-${post['id']}', child: picture),
          ),
          Padding(padding: const EdgeInsets.all(20), child: words()),
        ],
      );
    } else if (style == AppThemeStyle.editorial) {
      content = Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(width: 5, height: 92, color: c.primary),
            const SizedBox(width: 22),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(right: 22),
                child: words(),
              ),
            ),
          ],
        ),
      );
    } else if (style == AppThemeStyle.discover) {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(height: 140, child: picture),
          Padding(padding: const EdgeInsets.all(24), child: words()),
        ],
      );
    } else if (style == AppThemeStyle.orbit) {
      content = Padding(
        padding: const EdgeInsets.all(22),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: c.secondaryContainer,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Icon(Icons.work_outline, color: c.onSecondaryContainer),
            ),
            const SizedBox(width: 18),
            Expanded(child: words()),
          ],
        ),
      );
    } else if (style == AppThemeStyle.cinematic) {
      content = Padding(
        padding: const EdgeInsets.all(26),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              post['jobType'] == 'task'
                  ? 'THE NEXT PROJECT'
                  : 'THE NEXT CHAPTER',
              style: TextStyle(
                color: c.primary,
                fontSize: 10,
                letterSpacing: 2.5,
              ),
            ),
            const Divider(height: 32),
            words(),
            const SizedBox(height: 24),
            Align(
              alignment: Alignment.centerRight,
              child: Icon(Icons.north_east, size: 32, color: c.primary),
            ),
          ],
        ),
      );
    } else {
      content = Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: c.primaryContainer,
                    borderRadius: BorderRadius.circular(communityRadius(style)),
                  ),
                  child: Icon(
                    post['jobType'] == 'task'
                        ? Icons.handyman_outlined
                        : Icons.work_outline,
                    color: c.onPrimaryContainer,
                  ),
                ),
                const Spacer(),
                Chip(
                  label: Text(
                    post['jobType'] == 'task' ? 'Paid task' : 'Vacancy',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            words(),
            if (style == AppThemeStyle.cinematic) ...[
              const SizedBox(height: 18),
              Divider(color: c.primary.withValues(alpha: .5)),
            ],
          ],
        ),
      );
    }
    return Material(
      color: c.surfaceContainerLow,
      borderRadius: BorderRadius.circular(radius),
      clipBehavior: Clip.antiAlias,
      child: InkWell(onTap: onTap, child: content),
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
                  Chip(label: Text('${post['category']}')),
                  Chip(label: Text('${post['district'] ?? ''}')),
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
              if (!event)
                Text(
                  'per ${details['payPeriod'] ?? 'month'}',
                  style: TextStyle(color: c.onSurfaceVariant),
                ),
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
                        borderRadius: BorderRadius.circular(16),
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
                              title: 'Introduce yourself',
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
                          ? 'Application ${post['myApplication']['status']}'
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
                        ? 'Remove from saved'
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

class CommunityApplicationsScreen extends ConsumerWidget {
  const CommunityApplicationsScreen({super.key, this.postId});
  final String? postId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final endpoint = postId == null
        ? '/jobs/applications/mine'
        : '/jobs/$postId/applicants';
    return Scaffold(
      appBar: CommunityAppBar(
        title: postId == null ? 'My applications' : 'Applicants',
      ),
      body: AsyncValueView<Map<String, dynamic>>(
        value: ref.watch(communityEndpointProvider(endpoint)),
        onRetry: () => ref.invalidate(communityEndpointProvider(endpoint)),
        data: (context, data) {
          final items = communityItems(data);
          if (items.isEmpty)
            return const CommerceEmpty(
              title: 'No applications yet',
              message:
                  'Applications will appear here when someone takes the next step.',
            );
          return ListView(
            padding: const EdgeInsets.all(20),
            children: items.map((application) {
              final user = application['user'] as Map? ?? {};
              final post = application['post'] as Map? ?? {};
              final title = postId == null ? post['title'] : user['name'];
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$title',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 10),
                      Text("${application['status']}"),
                      if (postId != null) ...[
                        Text("${user['email'] ?? ''}"),
                        Text("${application['phone'] ?? ''}"),
                        const SizedBox(height: 10),
                        SelectableText("${application['coverLetter']}"),
                        if ("${application['portfolioUrl'] ?? ''}".startsWith(
                          'https://',
                        ))
                          TextButton(
                            onPressed: () => launchUrl(
                              Uri.parse("${application['portfolioUrl']}"),
                              mode: LaunchMode.externalApplication,
                            ),
                            child: const Text('Open portfolio / CV'),
                          ),
                      ],
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        children: [
                          for (final status
                              in postId == null
                                  ? ['withdrawn']
                                  : ['reviewed', 'shortlisted', 'declined'])
                            if (application['status'] != 'withdrawn')
                              OutlinedButton(
                                onPressed: () async {
                                  try {
                                    await ref
                                        .read(apiClientProvider)
                                        .patch(
                                          "/jobs/applications/${application['id']}",
                                          body: {'status': status},
                                        );
                                    ref.invalidate(
                                      communityEndpointProvider(endpoint),
                                    );
                                  } catch (e) {
                                    if (context.mounted)
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        SnackBar(content: Text('$e')),
                                      );
                                  }
                                },
                                child: Text(
                                  status == 'withdrawn'
                                      ? 'Withdraw'
                                      : prettyCommunity(status),
                                ),
                              ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          );
        },
      ),
    );
  }
}
