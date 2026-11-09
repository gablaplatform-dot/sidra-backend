part of 'mylike_screen.dart';

const _band = _Photo('events', Rect.fromLTWH(264, 221, 279, 183));
const _singer = _Photo('events', Rect.fromLTWH(642, 198, 309, 117));

class _Events extends StatefulWidget {
  const _Events();
  @override
  State<_Events> createState() => _EventsState();
}

class _EventsState extends State<_Events> {
  int day = 0;
  @override
  Widget build(BuildContext context) => _Page(
    title: 'Events',
    trailing: _CircleButton(
      Icons.search,
      'Search',
      () => _open(context, 'search'),
    ),
    footer: const _EventDock(),
    children: [
      const _Heading('What’s on', 'Lekki, Lagos'),
      const SizedBox(height: 12),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final category in ['Concerts', 'Festivals', 'Vendors'])
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ActionChip(
                  label: Text(category),
                  onPressed: () => _open(
                    context,
                    category == 'Vendors' ? 'vendors' : 'saved-events',
                  ),
                ),
              ),
          ],
        ),
      ),
      const SizedBox(height: 14),
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 44,
            child: Column(
              children: [
                const Text(
                  'AUG',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
                ),
                for (var i = 0; i < 5; i++)
                  Padding(
                    padding: const EdgeInsets.only(top: 7),
                    child: TextButton(
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        backgroundColor: i == day ? _ink : Colors.transparent,
                        foregroundColor: i == day ? Colors.white : _ink,
                        minimumSize: const Size(40, 44),
                      ),
                      onPressed: () => setState(() => day = i),
                      child: Text('${9 + i}'),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              children: [
                _EventPoster(
                  photo: day.isEven ? _singer : _band,
                  title: day.isEven ? 'Afro Nation Lagos' : 'Trench Party',
                  details: '88 Palms · ${9 + day} August',
                ),
                const SizedBox(height: 12),
                const _EventPoster(
                  photo: _band,
                  title: 'Trench Party',
                  details: 'Owanbe Niger · Lekki',
                ),
              ],
            ),
          ),
        ],
      ),
    ],
  );
}

class _EventPoster extends StatelessWidget {
  const _EventPoster({
    required this.photo,
    required this.title,
    required this.details,
  });
  final Widget photo;
  final String title, details;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: () => _open(context, 'event'),
    borderRadius: BorderRadius.circular(17),
    child: ClipRRect(
      borderRadius: BorderRadius.circular(17),
      child: SizedBox(
        width: double.infinity,
        child: Stack(
          children: [
            Positioned.fill(child: photo),
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
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 136, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                      fontVariations: [FontVariation('wght', 800)],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(details, style: const TextStyle(color: Colors.white70)),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
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
      border: Border(top: BorderSide(color: Colors.black12)),
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
                color: item.$3 == 'events' ? _ink : Colors.black54,
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
  Widget build(BuildContext context) => _Page(
    title: 'Event details',
    trailing: const _Heart(),
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(17),
        child: const SizedBox(
          height: 210,
          width: double.infinity,
          child: _singer,
        ),
      ),
      const SizedBox(height: 16),
      const _Heading('Afro Nation Lagos', 'Hosted by The Weekend Social'),
      const SizedBox(height: 14),
      const _Panel(
        color: Colors.white,
        child: Column(
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.calendar_today_outlined),
              title: Text('Saturday, 9 August'),
              subtitle: Text('11:00 AM – 12:00 PM'),
            ),
            Divider(height: 1),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.location_on_outlined),
              title: Text('88 Palms'),
              subtitle: Text('Lekki, Lagos'),
            ),
          ],
        ),
      ),
      const _Section('About the event'),
      const Text('A celebration of music, dance and culture at 88 Palms.'),
      const SizedBox(height: 14),
      const SizedBox(
        height: 130,
        child: ClipRRect(
          borderRadius: BorderRadius.all(Radius.circular(14)),
          child: _PreviewMap(event: true),
        ),
      ),
    ],
    footer: _Action(
      'View entrance details',
      () => _preview(context, 'Sample event information.'),
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
      const _Heading('Find your next role', 'Vacancies and paid tasks'),
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
      InkWell(
        onTap: () => _open(context, 'job'),
        borderRadius: BorderRadius.circular(18),
        child: _Panel(
          radius: 18,
          color: const Color(0xff075ee8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'FEATURED VACANCY',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 10,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Product Designer',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  fontVariations: [FontVariation('wght', 800)],
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Studio North · Hybrid · Kampala',
                style: TextStyle(color: Colors.white),
              ),
              const SizedBox(height: 12),
              _Action(
                'View job',
                () => _open(context, 'job'),
                color: Colors.white,
                icon: Icons.north_east,
              ),
            ],
          ),
        ),
      ),
      const _Section('Recent openings'),
      for (final listing in const [
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
        color: const Color(0xffe3efff),
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
    footer: _Action(
      'Apply now',
      () => _open(context, 'job-apply'),
      color: const Color(0xff075ee8),
    ),
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
