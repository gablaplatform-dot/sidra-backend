part of 'mylike_screen.dart';

const _band = _Photo('events', Rect.fromLTWH(264, 221, 279, 183));
const _singer = _Photo('events', Rect.fromLTWH(642, 198, 309, 117));
const _poster = _Photo('events', Rect.fromLTWH(264, 551, 60, 62));
const _eventFace = _Photo('events', Rect.fromLTWH(515, 164, 26, 28));

class _Events extends StatelessWidget {
  const _Events();
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 14),
        children: [
          Row(
            children: [
              const Text(
                'Events',
                style: TextStyle(fontSize: 23, fontWeight: FontWeight.w800),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: InkWell(
                  onTap: () => _open(context, 'vendors'),
                  child: const Text(
                    'Vendors',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      fontVariations: [FontVariation('wght', 700)],
                      color: Colors.white54,
                    ),
                  ),
                ),
              ),
              _CircleButton(
                Icons.search,
                'Search',
                () => _open(context, 'search'),
                tint: Colors.white12,
                ink: Colors.white,
              ),
              const SizedBox(width: 8),
              InkWell(
                onTap: () => _open(context, 'profile'),
                child: const SizedBox(
                  width: 32,
                  height: 32,
                  child: ClipOval(child: _eventFace),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          InkWell(
            onTap: () => _open(context, 'event'),
            borderRadius: BorderRadius.circular(22),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(22),
              child: Stack(
                children: [
                  const Positioned.fill(child: _band),
                  const Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          stops: [0, .45, 1],
                          colors: [
                            Colors.transparent,
                            Colors.transparent,
                            Color(0xea1a2024),
                          ],
                        ),
                      ),
                    ),
                  ),
                  ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 320),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(16, 218, 16, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              CircleAvatar(
                                radius: 10,
                                backgroundColor: _lime,
                                child: Icon(
                                  Icons.music_note,
                                  size: 12,
                                  color: _ink,
                                ),
                              ),
                              SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Owanbe Niger',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Trench Party',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              fontVariations: [FontVariation('wght', 800)],
                            ),
                          ),
                          const SizedBox(height: 6),
                          Wrap(
                            spacing: 9,
                            runSpacing: 4,
                            children: const [
                              _EventMeta(Icons.schedule, 'July 14 · 7 AM'),
                              _EventMeta(
                                Icons.location_on_outlined,
                                '88 Palms, Lekki Phase 1',
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          _Section(
            'Nearby Events',
            action: 'View All',
            onTap: () => _open(context, 'saved-events'),
          ),
          const _EventRow(
            'TechFest NG',
            'InnovateAfrica',
            'Tomorrow 9:00 AM',
            _poster,
          ),
          const _EventRow(
            'Afro Nation Lagos',
            'The Weekend Social',
            'Tomorrow 11:00 AM',
            _singer,
          ),
        ],
      ),
    ),
    bottomNavigationBar: const _EventDock(),
  );
}

class _EventMeta extends StatelessWidget {
  const _EventMeta(this.icon, this.label);
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 13, color: Colors.white70),
      const SizedBox(width: 4),
      Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11)),
    ],
  );
}

class _EventRow extends StatelessWidget {
  const _EventRow(this.title, this.host, this.time, this.image);
  final String title, host, time;
  final Widget image;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: InkWell(
      onTap: () => _open(context, 'event'),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(9),
            child: SizedBox(width: 76, height: 76, child: image),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(host, style: const TextStyle(fontSize: 11)),
                const SizedBox(height: 5),
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                _EventMeta(Icons.schedule, time),
                const SizedBox(height: 4),
                const _EventMeta(Icons.location_on_outlined, 'Lekki, Lagos'),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, size: 16, color: Colors.white38),
        ],
      ),
    ),
  );
}

class _EventDock extends StatelessWidget {
  const _EventDock();
  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: const BoxDecoration(
      border: Border(top: BorderSide(color: Colors.white12)),
    ),
    child: SafeArea(
      top: false,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          for (final item in const [
            (Icons.home_filled, 'Events', 'events'),
            (Icons.favorite_border, 'Saved events', 'saved-events'),
            (Icons.add_circle_outline, 'Post an event', 'event-form'),
            (Icons.explore_outlined, 'Mylike screens', 'home'),
            (Icons.chat_bubble_outline, 'Messages', 'messages'),
          ])
            IconButton(
              tooltip: item.$2,
              onPressed: () => _open(context, item.$3),
              icon: Icon(
                item.$1,
                color: item.$3 == 'events' ? _orange : Colors.white60,
              ),
            ),
        ],
      ),
    ),
  );
}

class _Event extends StatelessWidget {
  const _Event();
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      top: false,
      bottom: false,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          Stack(
            children: [
              const Positioned.fill(bottom: 76, child: _singer),
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      stops: [0, .32, .65, 1],
                      colors: [
                        Color(0x66000000),
                        Colors.transparent,
                        Color(0xd6203641),
                        Color(0xff122637),
                      ],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: EdgeInsets.fromLTRB(
                  18,
                  MediaQuery.paddingOf(context).top + 12,
                  18,
                  18,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _CircleButton(
                          Icons.chevron_left,
                          'Back',
                          () => _back(context),
                          tint: Colors.white24,
                          ink: Colors.white,
                        ),
                        const Spacer(),
                        _CircleButton(
                          Icons.reply,
                          'Share',
                          () => _preview(
                            context,
                            'Sharing is shown for presentation.',
                          ),
                          tint: Colors.white24,
                          ink: Colors.white,
                        ),
                        const SizedBox(width: 7),
                        const _Heart(dark: true),
                      ],
                    ),
                    const SizedBox(height: 145),
                    const Row(
                      children: [
                        Flexible(
                          child: Text(
                            'Afro Nation Lagos',
                            style: TextStyle(
                              fontSize: 25,
                              fontWeight: FontWeight.w800,
                              fontVariations: [FontVariation('wght', 800)],
                              color: Colors.white,
                            ),
                          ),
                        ),
                        SizedBox(width: 8),
                        Icon(Icons.verified, size: 19, color: Colors.white),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Sat, 9 Aug, 11:00 AM – 12:00 PM',
                      style: TextStyle(color: Colors.white70),
                    ),
                    const SizedBox(height: 12),
                    const Row(
                      children: [
                        SizedBox(
                          width: 25,
                          height: 25,
                          child: ClipOval(child: _eventFace),
                        ),
                        SizedBox(
                          width: 22,
                          height: 22,
                          child: ClipOval(child: _singer),
                        ),
                        SizedBox(width: 8),
                        Text('100+', style: TextStyle(color: Colors.white)),
                      ],
                    ),
                    const SizedBox(height: 13),
                    const Text(
                      'Experience Afro Nation Lagos, a celebration of music, dance and culture. Join us at 88 Palms for live performances.',
                      style: TextStyle(
                        color: Colors.white70,
                        height: 1.45,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 2, 18, 15),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _Section('Host'),
                const _RowLink(
                  Icons.music_note,
                  'The Weekend Social',
                  '',
                  'vendors',
                ),
                const SizedBox(height: 9),
                const _Section('88 Palms'),
                const Text(
                  'Lekki, Lagos',
                  style: TextStyle(color: Colors.white60),
                ),
                const SizedBox(height: 12),
                const SizedBox(
                  height: 148,
                  child: ClipRRect(
                    borderRadius: BorderRadius.all(Radius.circular(16)),
                    child: _PreviewMap(event: true),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
    bottomNavigationBar: _Footer(
      child: _Action(
        'Buy Ticket',
        () => _preview(context, 'No ticket was purchased.'),
        color: _orange,
      ),
    ),
  );
}

class _EventCollection extends StatelessWidget {
  const _EventCollection({required this.screen});
  final String screen;
  @override
  Widget build(BuildContext context) => _Page(
    title: _groups['Events']![screen]!,
    children: [
      if (screen == 'vendors') ...[
        const _Heading('Vendors', 'Meet the hosts and event suppliers.'),
        const SizedBox(height: 12),
        const _RowLink(
          Icons.music_note,
          'The Weekend Social',
          'Event host',
          'event',
        ),
        const _RowLink(
          Icons.storefront_outlined,
          'Owanbe Niger',
          'Events and entertainment',
          'event',
        ),
      ] else ...[
        const _EventRow(
          'Afro Nation Lagos',
          'The Weekend Social',
          'Sat, 9 Aug · 11 AM',
          _singer,
        ),
        if (screen == 'my-events')
          _Action('Post an event', () => _open(context, 'event-form')),
      ],
    ],
  );
}

class _Jobs extends StatelessWidget {
  const _Jobs();

  @override
  Widget build(BuildContext context) => _Page(
    title: 'Jobs',
    trailing: _CircleButton(
      Icons.bookmark_border,
      'Saved jobs',
      () => _open(context, 'saved-jobs'),
    ),
    children: [
      const Row(
        children: [
          CircleAvatar(backgroundColor: Color(0xffdce8c6), child: Text('A')),
          SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Hello, Alex',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                Text('Welcome back', style: TextStyle(fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
      const SizedBox(height: 20),
      const _Heading('Popular jobs', 'Vacancies and paid tasks'),
      const SizedBox(height: 12),
      const TextField(
        decoration: InputDecoration(
          prefixIcon: Icon(Icons.search),
          hintText: 'Job title or company',
        ),
      ),
      const SizedBox(height: 10),
      OutlinedButton.icon(
        onPressed: () => showModalBottomSheet<void>(
          context: context,
          builder: (context) => SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const _Section('Job type'),
                  for (final type in [
                    'All jobs',
                    'Full time',
                    'Paid tasks',
                    'Remote',
                  ])
                    ListTile(
                      title: Text(type),
                      onTap: () => Navigator.pop(context),
                    ),
                ],
              ),
            ),
          ),
        ),
        icon: const Icon(Icons.tune, size: 16),
        label: const Text('Filter'),
      ),
      const SizedBox(height: 14),
      for (final listing in const [
        (
          'Studio North',
          'Product Designer',
          'Hybrid · Full time · Kampala',
          'UGX 2,800,000 / month',
          Icons.design_services_outlined,
          Color(0xffefd45b),
        ),
        (
          'The Portrait Room',
          'Event Photographer',
          'On-site · Paid task · Kampala',
          'UGX 250,000 / task',
          Icons.photo_camera_outlined,
          Color(0xffd7f0b0),
        ),
      ])
        Padding(
          padding: const EdgeInsets.only(bottom: 9),
          child: InkWell(
            onTap: () => _open(context, 'job'),
            child: _Panel(
              color: Colors.white,
              radius: 20,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 13,
                        backgroundColor: listing.$6,
                        child: Icon(listing.$5, size: 15, color: _ink),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          listing.$1,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      _CircleButton(
                        Icons.bookmark_border,
                        'Saved jobs',
                        () => _open(context, 'saved-jobs'),
                        tint: Colors.white,
                      ),
                    ],
                  ),
                  const Divider(height: 8),
                  Text(
                    listing.$2,
                    style: const TextStyle(
                      fontSize: 23,
                      height: 1.1,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    listing.$3,
                    style: const TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                  const SizedBox(height: 9),
                  _Panel(
                    color: const Color(0xffeeeeed),
                    radius: 22,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 5,
                    ),
                    child: Text(
                      listing.$4,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      const _RowLink(
        Icons.work_outline,
        'My applications',
        'View sample records',
        'applications',
      ),
    ],
    footer: _Action(
      'Post a job or task',
      () => _open(context, 'job-form'),
      icon: Icons.add,
    ),
  );
}

class _Job extends StatelessWidget {
  const _Job();
  @override
  Widget build(BuildContext context) => _Page(
    title: 'Job details',
    trailing: const _Heart(),
    children: [
      _Panel(
        color: const Color(0xffd9edc4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const CircleAvatar(
              backgroundColor: _ink,
              child: Icon(Icons.design_services_outlined, color: Colors.white),
            ),
            const SizedBox(height: 12),
            const _Heading('Product Designer', 'Studio North · Kampala'),
            const SizedBox(height: 12),
            const Text(
              'UGX 2,800,000 / month',
              style: TextStyle(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              children: [
                for (final label in ['Full time', 'Hybrid'])
                  Chip(label: Text(label)),
              ],
            ),
          ],
        ),
      ),
      const _Section('About the job'),
      const Text(
        'Design mobile experiences with a small product team. Work on research, prototypes and design handoff.',
      ),
      const _Section('Requirements'),
      const Text(
        'A portfolio of mobile product work and experience collaborating with developers.',
      ),
      const _Section('Location'),
      const _RowLink(
        Icons.location_on_outlined,
        'Kampala',
        'Hybrid workplace',
        'nearby',
      ),
    ],
    footer: _Action('Apply now', () => _open(context, 'job-apply')),
  );
}

class _JobCollection extends StatelessWidget {
  const _JobCollection({required this.screen});
  final String screen;
  @override
  Widget build(BuildContext context) => _Page(
    title: _groups['Jobs']![screen]!,
    children: [
      if (screen == 'applicants')
        const _RowLink(
          Icons.person_outline,
          'Sample applicant',
          'Product Designer · Awaiting review',
          'job-apply',
        )
      else
        _RowLink(
          Icons.work_outline,
          'Product Designer',
          screen == 'applications'
              ? 'Studio North · Application preview'
              : 'Studio North · Full time',
          'job',
        ),
      if (screen == 'my-jobs')
        const _RowLink(
          Icons.group_outlined,
          'Applicants',
          'See the applicant list layout',
          'applicants',
        ),
    ],
  );
}
