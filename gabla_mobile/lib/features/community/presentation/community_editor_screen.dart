import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme_style.dart';
import '../../../core/motion/design_transitions.dart';
import '../../settings/application/theme_controller.dart';
import 'community_design.dart';
import 'community_location_input.dart';
import '../../../core/media/media_upload_button.dart';
import '../../../core/media/sound_video_screen.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/theme/font_group.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../auth/application/session_controller.dart';
import '../../ride/domain/ride_location.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../application/community_providers.dart';
import 'community_screens.dart';

class CommunityEditorScreen extends ConsumerStatefulWidget {
  const CommunityEditorScreen({super.key, required this.kind, this.id});
  final String kind;
  final String? id;
  @override
  ConsumerState<CommunityEditorScreen> createState() => _EditorState();
}

class _EditorState extends ConsumerState<CommunityEditorScreen> {
  final form = GlobalKey<FormState>(),
      fields = <String, TextEditingController>{};
  final media = <Map<String, dynamic>>[];
  bool ready = false, busy = false;
  int step = 0;
  final scroll = ScrollController();
  AppThemeStyle get style => ref.watch(themeControllerProvider).style;
  String? error;
  String category = '',
      jobType = 'vacancy',
      employment = 'full_time',
      workplace = 'onsite',
      period = 'month',
      currency = 'UGX';
  DateTime? start, end, deadline;
  RideLocation? location;
  bool get event => widget.kind == 'events';
  TextEditingController field(String key) =>
      fields.putIfAbsent(key, () => TextEditingController());
  @override
  void dispose() {
    for (final c in fields.values) c.dispose();
    scroll.dispose();
    super.dispose();
  }

  Widget input(
    String key,
    String label, {
    bool required = false,
    bool number = false,
    int lines = 1,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        TextFormField(
          key: ValueKey('community-input-$key'),
          controller: field(key),
          maxLines: lines,
          keyboardType: number
              ? const TextInputType.numberWithOptions(decimal: true)
              : lines > 1
              ? TextInputType.multiline
              : TextInputType.text,
          decoration: InputDecoration(hintText: required ? "$label *" : label)
              .applyDefaults(
                communityTheme(Theme.of(context), style).inputDecorationTheme,
              ),
          style: Theme.of(context).textTheme.bodyMedium,
          validator: (v) {
            if (required && (v ?? '').trim().isEmpty) return 'Enter $label';
            if (number &&
                (v ?? '').isNotEmpty &&
                (num.tryParse(v!) == null || num.parse(v) < 0))
              return 'Enter a valid amount';
            return null;
          },
        ),
      ],
    ),
  );
  Widget pick(
    String label,
    String value,
    List<String> values,
    ValueChanged<String> set,
  ) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          key: ValueKey('community-pick-$label'),
          initialValue: values.contains(value) ? value : null,
          isExpanded: true,
          decoration: InputDecoration(hintText: "Choose ${label.toLowerCase()}")
              .applyDefaults(
                communityTheme(Theme.of(context), style).inputDecorationTheme,
              ),
          style: Theme.of(context).textTheme.bodyMedium,
          items: values
              .map(
                (v) =>
                    DropdownMenuItem(value: v, child: Text(prettyCommunity(v))),
              )
              .toList(),
          onChanged: (v) => setState(() => set(v!)),
          validator: (v) => v == null ? 'Choose $label' : null,
        ),
      ],
    ),
  );
  Widget dateButton(
    String label,
    DateTime? value,
    ValueChanged<DateTime?> set, {
    bool time = true,
  }) => OutlinedButton.icon(
    onPressed: () async {
      final day = await showDatePicker(
        context: context,
        initialDate: value ?? DateTime.now(),
        firstDate: DateTime.now().subtract(const Duration(days: 365)),
        lastDate: DateTime.now().add(const Duration(days: 1095)),
      );
      if (day == null || !mounted) return;
      if (!time) {
        setState(() => set(day.add(const Duration(hours: 23, minutes: 59))));
        return;
      }
      final clock = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.fromDateTime(value ?? DateTime.now()),
      );
      if (clock != null && mounted)
        setState(
          () => set(
            DateTime(day.year, day.month, day.day, clock.hour, clock.minute),
          ),
        );
    },
    icon: const Icon(Icons.calendar_month_outlined),
    label: Text(
      value == null
          ? label
          : '$label · ${DateFormat(time ? 'd MMM yyyy, HH:mm' : 'd MMM yyyy').format(value)}',
    ),
  );
  void restore(Map<String, dynamic>? post) {
    if (ready) return;
    final details = post?['details'] as Map? ?? {};
    for (final k in [
      'title',
      'description',
      'organization',
      'district',
      'address',
    ])
      field(k).text = '${post?[k] ?? ''}';
    for (final k in [
      'phone',
      'email',
      'website',
      'requirements',
      'bookingUrl',
      'entranceNote',
      'ageRestriction',
    ])
      field(k).text = '${details[k] ?? ''}';
    field('payMin').text = '${post?['payMin'] ?? 0}';
    field('payMax').text = '${post?['payMax'] ?? 0}';
    category = '${post?['category'] ?? ''}';
    jobType = '${post?['jobType'] ?? 'vacancy'}';
    employment = '${post?['employmentType'] ?? 'full_time'}';
    workplace = '${post?['workplace'] ?? 'onsite'}';
    currency = '${post?['currency'] ?? 'UGX'}';
    period = '${details['payPeriod'] ?? 'month'}';
    start = DateTime.tryParse('${post?['startsAt']}')?.toLocal();
    end = DateTime.tryParse('${post?['endsAt']}')?.toLocal();
    deadline = DateTime.tryParse('${post?['deadline']}')?.toLocal();
    media.addAll(
      (post?['media'] as List? ?? []).map((m) => Map<String, dynamic>.from(m)),
    );
    if (post?['lat'] is num && post?['lng'] is num)
      location = RideLocation(
        lat: (post!['lat'] as num).toDouble(),
        lng: (post['lng'] as num).toDouble(),
        address: '${post['address']}',
      );
    ready = true;
  }

  Future<void> save() async {
    if (field('title').text.trim().isEmpty || category.isEmpty) {
      setState(() {
        step = 0;
        error = 'Add a title and choose a category.';
      });
      return;
    }
    if (field('description').text.trim().length < 20) {
      setState(() {
        step = 1;
        error = 'Add a description of at least 20 characters.';
      });
      return;
    }
    if (field('address').text.trim().isEmpty) {
      setState(() {
        step = 2;
        error = 'Add a location using search, a complete address, or the map.';
      });
      return;
    }
    if (!form.currentState!.validate()) return;
    if (event && (start == null || end == null || !end!.isAfter(start!))) {
      setState(() {
        step = 2;
        error = 'Choose an event end time after its start.';
      });
      return;
    }
    if (event && !media.any((m) => m['type'] == 'image')) {
      setState(() {
        step = 3;
        error = 'Add a poster or photo for your event.';
      });
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final min = num.tryParse(field('payMin').text) ?? 0,
          max = event ? min : num.tryParse(field('payMax').text) ?? 0;
      final body = <String, dynamic>{
        for (final k in [
          'title',
          'description',
          'organization',
          'district',
          'address',
        ])
          k: field(k).text.trim(),
        'category': category,
        'currency': currency,
        'payMin': min,
        'payMax': max,
        'media': media,
        'lat': location?.lat,
        'lng': location?.lng,
        'details': {
          for (final k in [
            'phone',
            'email',
            'website',
            if (event) ...[
              'bookingUrl',
              'entranceNote',
              'ageRestriction',
            ] else
              'requirements',
          ])
            k: field(k).text.trim(),
          if (!event) 'payPeriod': jobType == 'task' ? 'task' : period,
        },
        if (event) ...{
          'startsAt': start!.toUtc().toIso8601String(),
          'endsAt': end!.toUtc().toIso8601String(),
        } else ...{
          'jobType': jobType,
          'employmentType': employment,
          'workplace': workplace,
          'deadline': deadline?.toUtc().toIso8601String(),
        },
      };
      final api = ref.read(apiClientProvider);
      if (widget.id == null) {
        await api.post('/${widget.kind}', body: body);
      } else {
        await api.patch('/${widget.kind}/${widget.id}', body: body);
      }
      ref.invalidate(communityEndpointProvider);
      if (mounted) {
        context.go('/${widget.kind}/mine');
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Submitted for review. Manage your post in My posts.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget pair(Widget first, Widget second) => LayoutBuilder(
    builder: (context, box) => box.maxWidth >= 360
        ? Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: first),
              const SizedBox(width: 14),
              Expanded(child: second),
            ],
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [first, second],
          ),
  );

  List<Widget> basics() {
    final cats = event ? eventCategories : jobCategories;
    return [
      input(
        'title',
        event ? 'Event title' : 'Job or task title',
        required: true,
      ),
      input(
        'organization',
        event ? 'Organizer or band' : 'Company or organization',
      ),
      pick('Category', category, [
        ...cats,
        if (category.isNotEmpty && !cats.contains(category)) category,
      ], (v) => category = v),
      if (!event) ...[
        const Text(
          'What are you posting?',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final entry in {
              'vacancy': 'Employment vacancy',
              'task': 'Paid task',
            }.entries)
              ChoiceChip(
                label: Text(entry.value),
                selected: jobType == entry.key,
                onSelected: (_) => setState(() => jobType = entry.key),
              ),
          ],
        ),
        const SizedBox(height: 18),
        pick('Employment type', employment, [
          'full_time',
          'part_time',
          'contract',
          'temporary',
          'internship',
        ], (v) => employment = v),
        const Text(
          'Workplace',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final value in ['onsite', 'hybrid', 'remote'])
              ChoiceChip(
                label: Text(prettyCommunity(value)),
                selected: workplace == value,
                onSelected: (_) => setState(() => workplace = value),
              ),
          ],
        ),
        const SizedBox(height: 8),
      ],
    ];
  }

  List<Widget> details() => [
    input(
      'description',
      event ? 'About your event' : 'About the role or task',
      required: true,
      lines: 4,
    ),
    if (!event) input('requirements', 'Skills and requirements', lines: 3),
    pair(
      pick('Currency', currency, [
        'UGX',
        'USD',
        'KES',
        'TZS',
      ], (v) => currency = v),
      input(
        'payMin',
        event ? 'Entrance price (0 = free)' : 'Minimum pay (0 = negotiable)',
        number: true,
      ),
    ),
    if (!event) ...[
      input('payMax', 'Maximum pay (optional)', number: true),
      pick('Pay period', period, [
        'hour',
        'day',
        'week',
        'month',
        'year',
        'task',
        'negotiable',
      ], (v) => period = v),
    ] else ...[
      input('entranceNote', 'Entrance details'),
      input('ageRestriction', 'Age restriction (optional)'),
      input('bookingUrl', 'Organizer booking URL (optional)'),
    ],
  ];
  List<Widget> placeAndTime() => [
    if (event) ...[
      dateButton('Starts', start, (v) => start = v),
      const SizedBox(height: 10),
      dateButton('Ends', end, (v) => end = v),
      const SizedBox(height: 24),
    ] else ...[
      dateButton(
        'Application deadline',
        deadline,
        (v) => deadline = v,
        time: false,
      ),
      if (deadline != null)
        TextButton(
          onPressed: () => setState(() => deadline = null),
          child: const Text('Remove deadline'),
        ),
      const SizedBox(height: 22),
    ],
    CommunityLocationInput(
      controller: field('address'),
      location: location,
      event: event,
      onSelected: (place) => setState(() => location = place),
    ),
    const SizedBox(height: 20),
    input('district', 'District (optional)'),
  ];
  Widget attachments() {
    final c = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: c.surfaceContainerLow,
            border: Border.all(color: c.outlineVariant),
            borderRadius: BorderRadius.circular(communityRadius(style)),
          ),
          child: Column(
            children: [
              Icon(
                event
                    ? Icons.add_photo_alternate_outlined
                    : Icons.cloud_upload_outlined,
                size: 28,
                color: c.primary,
              ),
              const SizedBox(height: 10),
              Text(
                event ? 'Upload your event poster' : 'Add photos or a video',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 7),
              Text(
                event
                    ? 'A poster or photo is required. Add videos too.'
                    : 'Show the workplace, team or project.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: c.onSurfaceVariant,
                  fontSize: 12,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 16),
              MediaUploadButton(
                folder: event ? 'community-events' : 'community-jobs',
                label: event ? 'Add poster or video' : 'Add photo or video',
                registerAsset: false,
                onUploaded: (url) => setState(
                  () => media.add({
                    'url': url,
                    'type': isVideoUrl(url) ? 'video' : 'image',
                  }),
                ),
              ),
            ],
          ),
        ),
        for (var i = 0; i < media.length; i++)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: media[i]['type'] == 'video'
                ? const Icon(Icons.videocam_outlined)
                : Image.network(
                    '${media[i]['url']}',
                    width: 44,
                    height: 44,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) =>
                        const Icon(Icons.image_outlined),
                  ),
            title: Text(
              '${media[i]['type'] == 'video' ? 'Video' : 'Photo / poster'} ${i + 1}',
              style: const TextStyle(fontSize: 13),
            ),
            trailing: IconButton(
              tooltip: 'Remove attachment',
              onPressed: () => setState(() => media.removeAt(i)),
              icon: const Icon(Icons.close, size: 18),
            ),
          ),
      ],
    );
  }

  List<Widget> contact() => [
    attachments(),
    const SizedBox(height: 24),
    input('phone', 'Contact phone'),
    input('email', 'Contact email'),
    input('website', 'Website URL (optional)'),
  ];
  final sectionNames = ['Basics', 'Details', 'Location', 'Media & contact'];
  Widget section(int index, List<Widget> children) {
    final c = Theme.of(context).colorScheme;
    final editorial = style == AppThemeStyle.editorial;
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Container(
        padding: editorial
            ? const EdgeInsets.symmetric(vertical: 10)
            : const EdgeInsets.all(18),
        decoration: editorial
            ? null
            : BoxDecoration(
                color: c.surface,
                border: Border.all(color: c.outlineVariant),
                borderRadius: BorderRadius.circular(communityRadius(style)),
              ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  '0${index + 1}',
                  style: TextStyle(
                    color: c.primary,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    sectionNames[index],
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            ...children,
            if (editorial) const Divider(height: 24),
          ],
        ),
      ),
    );
  }

  Widget draftChecklist() {
    final c = Theme.of(context).colorScheme;
    final rows = [
      (
        1,
        Icons.subject_outlined,
        event ? 'Event details' : 'Role & pay',
        field('description').text.trim().length >= 20,
      ),
      (
        2,
        Icons.place_outlined,
        'Date & location',
        field('address').text.trim().isNotEmpty &&
            (!event || start != null && end != null),
      ),
      (
        3,
        Icons.add_photo_alternate_outlined,
        'Media & contact',
        !event || media.any((m) => m['type'] == 'image'),
      ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 28),
        const Text(
          'Before you submit',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        for (final row in rows)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              border: Border.all(color: c.outlineVariant),
              borderRadius: BorderRadius.circular(4),
            ),
            child: ListTile(
              dense: true,
              leading: Icon(
                row.$4 ? Icons.check_circle_outline : row.$2,
                size: 20,
                color: c.primary,
              ),
              title: Text(
                row.$1 == 1 && !event ? 'Role & pay' : row.$3,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              subtitle: Text(
                row.$4 ? 'Added' : 'Add details',
                style: TextStyle(fontSize: 11, color: c.onSurfaceVariant),
              ),
              trailing: const Icon(Icons.arrow_forward, size: 17),
              onTap: () => goStep(row.$1),
            ),
          ),
      ],
    );
  }

  void goStep(int next) {
    setState(() {
      step = next;
      error = null;
    });
    if (scroll.hasClients) scroll.jumpTo(0);
  }

  Widget content(Map<String, dynamic>? post) {
    restore(post);
    final c = Theme.of(context).colorScheme;
    final wizard = style == AppThemeStyle.discover,
        tabbed = style == AppThemeStyle.orbit;
    final groups = [basics(), details(), placeAndTime(), contact()];
    Widget intro() {
      final title = event ? 'Create an event' : 'Post an opportunity';
      if (style == AppThemeStyle.cinematic)
        return Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: c.surfaceContainerHigh,
            border: Border(left: BorderSide(color: c.primary, width: 3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                event ? 'THE NEXT LIVE MOMENT' : 'YOUR NEXT GREAT HIRE',
                style: TextStyle(
                  color: c.primary,
                  fontSize: 10,
                  letterSpacing: 1.8,
                ),
              ),
              const SizedBox(height: 16),
              Text(title, style: AppTypography.of(context).display(size: 32)),
              const SizedBox(height: 12),
              const Text(
                'Build your post. We review it before it goes live.',
                style: TextStyle(fontSize: 12, height: 1.5),
              ),
            ],
          ),
        );
      if (style == AppThemeStyle.orbit)
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              event ? 'EVENT / NEW LISTING' : 'WORK / NEW LISTING',
              style: TextStyle(
                color: c.primary,
                fontSize: 10,
                letterSpacing: 1.5,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            Text(title, style: AppTypography.of(context).display(size: 30)),
            const SizedBox(height: 14),
            const Divider(height: 1, thickness: 2),
          ],
        );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            wizard
                ? 'STEP ${step + 1} OF 4'
                : event
                ? 'MAKE IT HAPPEN'
                : 'FIND YOUR PEOPLE',
            style: TextStyle(
              fontSize: 10,
              letterSpacing: 1.5,
              color: c.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            wizard ? sectionNames[step] : title,
            style: AppTypography.of(
              context,
            ).display(size: style == AppThemeStyle.editorial ? 36 : 30),
          ),
          const SizedBox(height: 12),
          Text(
            'Your post is reviewed before appearing publicly.',
            style: TextStyle(
              color: c.onSurfaceVariant,
              fontSize: 12,
              height: 1.5,
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        if (wizard || tabbed)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Column(
              children: [
                if (wizard)
                  Row(
                    children: [
                      for (var i = 0; i < 4; i++)
                        Expanded(
                          child: Container(
                            height: 3,
                            margin: EdgeInsets.only(right: i == 3 ? 0 : 5),
                            color: i <= step ? c.primary : c.outlineVariant,
                          ),
                        ),
                    ],
                  )
                else
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (var i = 0; i < 4; i++)
                          Padding(
                            padding: const EdgeInsets.only(right: 14),
                            child: TextButton(
                              key: ValueKey('community-tab-$i'),
                              onPressed: () => goStep(i),
                              style: TextButton.styleFrom(
                                foregroundColor: i == step
                                    ? c.primary
                                    : c.onSurfaceVariant,
                                side: i == step
                                    ? BorderSide(color: c.primary)
                                    : null,
                              ),
                              child: Text(sectionNames[i]),
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        Expanded(
          child: Form(
            key: form,
            child: ListView(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 24),
              children: [
                intro(),
                const SizedBox(height: 26),
                if (wizard || tabbed)
                  AnimatedSwitcher(
                    duration: MediaQuery.disableAnimationsOf(context)
                        ? Duration.zero
                        : const Duration(milliseconds: 260),
                    transitionBuilder: (child, animation) => FadeTransition(
                      opacity: animation,
                      child: SlideTransition(
                        position: Tween(
                          begin: const Offset(.035, 0),
                          end: Offset.zero,
                        ).animate(animation),
                        child: child,
                      ),
                    ),
                    child: Column(
                      key: ValueKey('community-step-$step'),
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ...groups[step],
                        if (tabbed && step == 0) draftChecklist(),
                      ],
                    ),
                  )
                else if (style == AppThemeStyle.cinematic) ...[
                  DesignEntrance(index: 0, child: attachments()),
                  const SizedBox(height: 24),
                  for (var i = 0; i < 3; i++)
                    DesignEntrance(index: i + 1, child: section(i, groups[i])),
                  section(3, [
                    input('phone', 'Contact phone'),
                    input('email', 'Contact email'),
                    input('website', 'Website URL (optional)'),
                  ]),
                ] else
                  for (var i = 0; i < 4; i++)
                    DesignEntrance(index: i, child: section(i, groups[i])),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 18),
                    child: Text(
                      error!,
                      style: TextStyle(
                        color: c.error,
                        fontSize: 13,
                        height: 1.5,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: c.surface,
            border: Border(top: BorderSide(color: c.outlineVariant)),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              child: Row(
                children: [
                  if (wizard && step > 0) ...[
                    OutlinedButton(
                      onPressed: () => goStep(step - 1),
                      child: const Text('Back'),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: FilledButton(
                      onPressed: busy
                          ? null
                          : () => wizard && step < 3
                                ? (form.currentState!.validate()
                                      ? goStep(step + 1)
                                      : null)
                                : save(),
                      child: Text(
                        busy
                            ? 'Submitting…'
                            : wizard && step < 3
                            ? 'Continue'
                            : 'Submit for review',
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) => CommunityDesignScope(
    style: style,
    child: Builder(
      builder: (context) => Scaffold(
        appBar: CommunityAppBar(
          title: widget.id == null
              ? 'Post ${event ? 'an event' : 'a job'}'
              : 'Edit post',
        ),
        body: !ref.watch(isSignedInProvider)
            ? CommerceEmpty(
                title: 'Create with Gabla',
                message: 'Sign in to publish your post.',
                action: 'Sign in',
                onAction: () =>
                    communitySignIn(context, ref, '/${widget.kind}/new'),
              )
            : widget.id == null
            ? Builder(builder: (inner) => content(null))
            : AsyncValueView<Map<String, dynamic>>(
                value: ref.watch(
                  communityEndpointProvider('/${widget.kind}/${widget.id}'),
                ),
                onRetry: () => ref.invalidate(
                  communityEndpointProvider('/${widget.kind}/${widget.id}'),
                ),
                data: (context, post) => post['canManage'] == true
                    ? content(post)
                    : const CommerceEmpty(
                        title: 'Post unavailable',
                        message: 'You can only edit your own posts.',
                      ),
              ),
      ),
    ),
  );
}
