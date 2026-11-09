part of 'mylike_screen.dart';

const _shoe = _Photo('shop', Rect.fromLTWH(640, 248, 420, 416));
const _jacket = _Photo('shop', Rect.fromLTWH(143, 767, 157, 213));

class _Shop extends StatelessWidget {
  const _Shop();

  @override
  Widget build(BuildContext context) => _Page(
    title: 'Gabla Shop',
    trailing: _CircleButton(
      Icons.shopping_bag_outlined,
      'Cart',
      () => _open(context, 'cart'),
    ),
    footer: const _ShopDock(),
    children: [
      _ShopSearchBar(),
      const SizedBox(height: 16),
      ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: ColoredBox(
          color: _ink,
          child: Stack(
            children: [
              const Positioned.fill(
                left: 155,
                child: _Photo(
                  'shop',
                  Rect.fromLTWH(143, 767, 157, 213),
                  alignment: Alignment.topCenter,
                ),
              ),
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      stops: [0, .48, 1],
                      colors: [_ink, _ink, Colors.transparent],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'THE SHOP EDIT',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 10,
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Everyday\nessentials',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        height: 1.05,
                        fontWeight: FontWeight.w800,
                        fontVariations: [FontVariation('wght', 800)],
                      ),
                    ),
                    const SizedBox(height: 12),
                    _Action(
                      'Shop collection',
                      () => _open(context, 'shop-search'),
                      color: Colors.white,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 12),
      const _ShopCategories(),
      _Section(
        'New arrivals',
        action: 'See all',
        onTap: () => _open(context, 'shop-search'),
      ),
      const _ProductGrid(),
    ],
  );
}

class _ShopSearchBar extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    borderRadius: BorderRadius.circular(28),
    elevation: 2,
    shadowColor: Colors.black12,
    child: Row(
      children: [
        Expanded(
          child: InkWell(
            borderRadius: BorderRadius.circular(28),
            onTap: () => _open(context, 'shop-search'),
            child: const Padding(
              padding: EdgeInsets.fromLTRB(16, 14, 2, 14),
              child: Row(
                children: [
                  Icon(Icons.search, size: 22, color: Colors.black45),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'what are you looking for?',
                      style: TextStyle(color: Colors.black54),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        Container(height: 28, width: 1, color: const Color(0xffe7e7e7)),
        IconButton(
          onPressed: () => _open(context, 'filters'),
          tooltip: 'Filters',
          icon: const Icon(Icons.tune),
        ),
        const SizedBox(width: 4),
      ],
    ),
  );
}

class _Dots extends StatelessWidget {
  const _Dots({required this.color, this.selected = 1});
  final Color color;
  final int selected;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      for (var i = 0; i < 3; i++)
        Container(
          width: i == selected ? 28 : 8,
          height: 8,
          margin: const EdgeInsets.symmetric(horizontal: 2),
          decoration: BoxDecoration(
            color: i == selected ? color : const Color(0xffd9d9d9),
            borderRadius: BorderRadius.circular(5),
          ),
        ),
    ],
  );
}

class _ShopCategories extends StatelessWidget {
  const _ShopCategories();
  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (final category in const [
        ('Men’s\noutfit', Icons.checkroom),
        ('Women’s\noutfit', Icons.dry_cleaning_outlined),
        ('Men’s\nfootwear', Icons.ice_skating_outlined),
      ])
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(right: 5),
            child: InkWell(
              borderRadius: BorderRadius.circular(11),
              onTap: () => _open(context, 'shop-search'),
              child: _Panel(
                color: const Color(0xffececec),
                radius: 11,
                padding: const EdgeInsets.symmetric(
                  horizontal: 7,
                  vertical: 10,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        category.$1,
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          fontVariations: [FontVariation('wght', 700)],
                        ),
                      ),
                    ),
                    Icon(category.$2, size: 19),
                  ],
                ),
              ),
            ),
          ),
        ),
    ],
  );
}

class _ProductGrid extends StatelessWidget {
  const _ProductGrid();
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      for (final item in const [
        ('Utility Jacket', 'UGX 210,000', _jacket),
        ('Grey Casual shoe', 'UGX 120,000', _shoe),
      ])
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(right: 6),
            child: InkWell(
              onTap: () => _open(context, 'product'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AspectRatio(
                    aspectRatio: .86,
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: Stack(
                        fit: StackFit.expand,
                        children: [
                          item.$3,
                          const Positioned(top: 6, right: 6, child: _Heart()),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 7),
                  Text(
                    item.$1,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  Text(item.$2),
                ],
              ),
            ),
          ),
        ),
    ],
  );
}

class _Heart extends StatefulWidget {
  const _Heart();
  @override
  State<_Heart> createState() => _HeartState();
}

class _HeartState extends State<_Heart> {
  bool saved = false;
  @override
  Widget build(BuildContext context) => _CircleButton(
    saved ? Icons.favorite : Icons.favorite_border,
    saved ? 'Remove from saved' : 'Save',
    () => setState(() => saved = !saved),
    tint: Colors.white,
    ink: Colors.black54,
  );
}

class _ShopDock extends StatelessWidget {
  const _ShopDock();
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    elevation: 8,
    shadowColor: Colors.black12,
    borderRadius: BorderRadius.circular(42),
    child: Padding(
      padding: const EdgeInsets.all(7),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          Flexible(
            child: _Panel(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 10),
              color: const Color(0xffe9efd6),
              radius: 27,
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.home_outlined, size: 19),
                  SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      'Home',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
          ),
          IconButton(
            tooltip: 'Cart',
            onPressed: () => _open(context, 'cart'),
            icon: const Icon(Icons.shopping_cart_outlined),
          ),
          IconButton(
            tooltip: 'Saved',
            onPressed: () => _open(context, 'saved'),
            icon: const Icon(Icons.favorite_border),
          ),
          IconButton(
            tooltip: 'Account',
            onPressed: () => _open(context, 'profile'),
            icon: const Icon(Icons.person_outline),
          ),
        ],
      ),
    ),
  );
}

class _Product extends ConsumerStatefulWidget {
  const _Product();
  @override
  ConsumerState<_Product> createState() => _ProductState();
}

class _ProductState extends ConsumerState<_Product> {
  String size = 'L';
  int quantity = 1;
  int photo = 0;
  bool following = true;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      bottom: false,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 22),
        children: [
          Row(
            children: [
              _CircleButton(
                Icons.chevron_left,
                'Back',
                () => _back(context),
                tint: Colors.white,
              ),
              const Expanded(
                child: Center(
                  child: Text(
                    'Details',
                    style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              _CircleButton(
                Icons.shopping_bag_outlined,
                'Cart',
                () => _open(context, 'cart'),
                tint: Colors.white,
              ),
            ],
          ),
          const SizedBox(height: 18),
          AspectRatio(
            aspectRatio: 1.01,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Hero(
                tag: 'mylike-product',
                child: PageView(
                  onPageChanged: (index) => setState(() => photo = index),
                  children: const [
                    _shoe,
                    _Photo('shop', Rect.fromLTWH(650, 275, 400, 365)),
                    _Photo('shop', Rect.fromLTWH(702, 332, 321, 315)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          _Dots(color: _ink, selected: photo),
          const SizedBox(height: 14),
          const Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Men Footwear',
                      style: TextStyle(color: Colors.black54, fontSize: 13),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Grey Casual shoe',
                      style: TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w800,
                        fontVariations: [FontVariation('wght', 800)],
                      ),
                    ),
                  ],
                ),
              ),
              _Heart(),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              const CircleAvatar(
                backgroundColor: Color(0xfff6dfc3),
                child: Icon(Icons.storefront_outlined, color: _ink),
              ),
              const SizedBox(width: 9),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Velora Store',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      'Official store',
                      style: TextStyle(color: Colors.black54, fontSize: 11),
                    ),
                  ],
                ),
              ),
              _Action(
                following ? 'Following' : 'Follow',
                () => setState(() => following = !following),
                color: _ink,
              ),
            ],
          ),
          const SizedBox(height: 15),
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Select size', style: TextStyle(color: Colors.black54)),
              Text('QTY', style: TextStyle(color: Colors.black54)),
            ],
          ),
          const SizedBox(height: 6),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            runSpacing: 8,
            children: [
              Wrap(
                spacing: 4,
                children: [
                  for (final option in ['S', 'M', 'L', 'XL'])
                    ChoiceChip(
                      showCheckmark: false,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(6),
                      ),
                      selectedColor: const Color(0xffdededb),
                      label: Text(option),
                      selected: size == option,
                      onSelected: (_) => setState(() => size = option),
                    ),
                ],
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    tooltip: 'Decrease quantity',
                    onPressed: quantity > 1
                        ? () => setState(() => quantity--)
                        : null,
                    icon: const Icon(Icons.remove, size: 17),
                  ),
                  Text('$quantity'),
                  IconButton(
                    tooltip: 'Increase quantity',
                    onPressed: () => setState(() => quantity++),
                    icon: const Icon(Icons.add, size: 17),
                  ),
                ],
              ),
            ],
          ),
          const _Section('Description'),
          const Text(
            'A soft grey slip-on with a textured upper and a white rubber sole.',
          ),
        ],
      ),
    ),
    bottomNavigationBar: _Footer(
      child: _Panel(
        color: Colors.white,
        radius: 12,
        padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 9),
        child: Row(
          children: [
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Total price',
                    style: TextStyle(color: Colors.black54, fontSize: 12),
                  ),
                  Text(
                    'UGX ${_money(quantity * 120000)}',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _Action('Add to Cart', () {
              ref.read(_bag.notifier).state += quantity;
              _open(context, 'cart');
            }, icon: Icons.shopping_bag_outlined),
          ],
        ),
      ),
    ),
  );
}

String _money(int amount) => amount.toString().replaceAllMapped(
  RegExp(r'\B(?=(\d{3})+(?!\d))'),
  (_) => ',',
);

class _ShopSupport extends ConsumerWidget {
  const _ShopSupport({required this.screen});
  final String screen;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(_bag);
    final total = 'UGX ${_money(count * 120000)}';
    return _Page(
      title: _groups['Shop']![screen]!,
      children: switch (screen) {
        'categories' => [
          const _ShopCategories(),
          const _Section('Browse products'),
          const _ProductGrid(),
        ],
        'shop-search' => [
          const TextField(
            decoration: InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search products',
            ),
          ),
          _Section(
            'New Arrival',
            action: 'Filters',
            onTap: () => _open(context, 'filters'),
          ),
          const _ProductGrid(),
        ],
        'filters' => [
          const _Section('Category'),
          const _ShopCategories(),
          const _Section('Price range'),
          const TextField(
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: 'Minimum price'),
          ),
          const SizedBox(height: 10),
          const TextField(
            keyboardType: TextInputType.number,
            decoration: InputDecoration(labelText: 'Maximum price'),
          ),
        ],
        'cart' => [
          if (count == 0) ...[
            const _Heading(
              'Your cart is empty',
              'Open a product to preview adding it to the cart.',
            ),
            const SizedBox(height: 16),
            _Action('Browse products', () => _open(context, 'shop')),
          ] else ...[
            const _Heading('Your cart', 'Velora Store'),
            const SizedBox(height: 16),
            _Panel(
              color: Colors.white,
              child: Row(
                children: [
                  const SizedBox(width: 72, height: 72, child: _shoe),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Grey Casual shoe',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Decrease quantity',
                    onPressed: () => ref.read(_bag.notifier).state--,
                    icon: const Icon(Icons.remove),
                  ),
                  Text('$count'),
                  IconButton(
                    tooltip: 'Increase quantity',
                    onPressed: () => ref.read(_bag.notifier).state++,
                    icon: const Icon(Icons.add),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _Heading(total, 'Subtotal'),
          ],
        ],
        'checkout' => [
          const _Heading('Delivery details', 'Review the checkout layout.'),
          const SizedBox(height: 16),
          for (final label in [
            'Full name',
            'Phone number',
            'Delivery address',
            'Notes',
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: TextField(decoration: InputDecoration(labelText: label)),
            ),
          const _Section('Payment'),
          const ListTile(
            leading: Icon(Icons.payments_outlined),
            title: Text('Cash on delivery'),
          ),
          const ListTile(
            leading: Icon(Icons.phone_android),
            title: Text('Mobile money after acceptance'),
          ),
          _Heading(total, 'Order total'),
        ],
        'orders' => [
          const _RowLink(
            Icons.receipt_long_outlined,
            'Order #1285',
            'Velora Store · Awaiting acceptance',
            'order',
          ),
        ],
        _ => [
          const _Heading(
            'Order #1285',
            'Awaiting seller acceptance · Example order',
          ),
          const SizedBox(height: 16),
          const _RowLink(
            Icons.shopping_bag_outlined,
            'Grey Casual shoe',
            'Qty 1 · UGX 120,000',
            'product',
          ),
          const _Section('Fulfilment'),
          const Text('Delivery · Cash on delivery'),
        ],
      },
      footer: switch (screen) {
        'filters' => _Action(
          'Apply filters',
          () => _open(context, 'shop-search'),
        ),
        'cart' when count > 0 => _Action(
          'Checkout',
          () => _open(context, 'checkout'),
        ),
        'checkout' => _Action('Preview order', () => _open(context, 'order')),
        _ => null,
      },
    );
  }
}
