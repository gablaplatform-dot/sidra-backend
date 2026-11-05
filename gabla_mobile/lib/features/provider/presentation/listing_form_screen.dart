import '../../../core/network/api_exception.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/media/media_upload_button.dart';
import '../../../core/media/sound_video_screen.dart';
import '../../../core/network/network_providers.dart';
import '../../../core/widgets/async_value_view.dart';
import '../../shop/application/commerce_providers.dart';
import '../../shop/presentation/commerce_widgets.dart';
import '../../workspace/application/workspace_providers.dart';
import '../../workspace/presentation/custom_field_input.dart';

final listingFormDataProvider =
    FutureProvider.family<Map<String, dynamic>, String?>((ref, id) async {
      final api = ref.watch(apiClientProvider);
      final results = await Future.wait([
        api
            .getList(
              '/product-categories/mine',
              query: {if (id != null) 'listingId': id},
            )
            .catchError((Object e) {
              if (e is ApiException && e.statusCode == 404)
                return api.getList('/product-categories');
              throw e;
            }),
        api.getList(
          '/service-categories/mine',
          query: {if (id != null) 'listingId': id},
        ),
        api.get<Map<String, dynamic>>('/providers/me'),
        api.getList('/shop-categories/mine'),
        if (id != null) api.getList('/listings/me', query: {'limit': 100}),
      ]);
      return {
        'products': results[0],
        'services': results[1],
        'provider': results[2],
        'collections': results[3],
        'listing': id == null
            ? null
            : (results[4] as List)
                  .cast<Map>()
                  .where((m) => m['id'] == id)
                  .firstOrNull,
      };
    });

class ListingFormScreen extends ConsumerStatefulWidget {
  const ListingFormScreen({super.key, this.listingId});
  final String? listingId;
  @override
  ConsumerState<ListingFormScreen> createState() => _ListingFormScreenState();
}

class _ListingFormScreenState extends ConsumerState<ListingFormScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController(),
      _description = TextEditingController(),
      _price = TextEditingController(),
      _original = TextEditingController(),
      _discount = TextEditingController(),
      _inventory = TextEditingController(),
      _sku = TextEditingController();
  String _kind = 'product', _bookingMode = 'none';
  String? _category, _collection, _image;
  List<String> _gallery = [];
  Map<String, dynamic> _answers = {},
      _booking = {
        'unit': 'night',
        'advanceDays': 90,
        'minUnits': 1,
        'maxUnits': 30,
        'inventory': 1,
        'capacity': 1,
        'depositPercent': 0,
      };
  bool _ready = false,
      _busy = false,
      _isNew = false,
      _featured = false,
      _online = true;
  String? _error;
  @override
  void dispose() {
    for (final c in [
      _name,
      _description,
      _price,
      _original,
      _discount,
      _inventory,
      _sku,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  List<Map<String, dynamic>> _flatten(
    List<dynamic> nodes, [
    String prefix = '',
  ]) => [
    for (final raw in nodes) ...[
      {
        ...Map<String, dynamic>.from(raw),
        'displayName': '$prefix${raw['name']}',
      },
      ..._flatten(raw['children'] as List? ?? [], '$prefix${raw['name']} / '),
    ],
  ];
  @override
  Widget build(BuildContext context) => CommerceScaffold(
    appBar: CommerceAppBar(
      title: widget.listingId == null ? 'Create listing' : 'Edit listing',
    ),
    body: AsyncValueView(
      value: ref.watch(listingFormDataProvider(widget.listingId)),
      onRetry: () => ref.invalidate(listingFormDataProvider(widget.listingId)),
      data: (context, data) {
        final listing = data['listing'] as Map?;
        if (!_ready) {
          if (widget.listingId != null && listing == null)
            return const CommerceEmpty(
              title: 'Listing not found',
              message:
                  'This listing may have been removed or belongs to another business.',
            );
          _name.text = '${listing?['name'] ?? ''}';
          _description.text = '${listing?['description'] ?? ''}';
          _price.text = '${listing?['price'] ?? ''}';
          _original.text = '${listing?['originalPrice'] ?? ''}';
          _discount.text = '${listing?['discountPercent'] ?? ''}';
          _inventory.text = '${listing?['inventory'] ?? ''}';
          _sku.text = '${listing?['sku'] ?? ''}';
          _kind =
              '${listing?['type'] ?? ((data['products'] as List).isEmpty && (data['services'] as List).isNotEmpty ? 'service' : 'product')}';
          _category =
              (listing?['productCategoryId'] ?? listing?['serviceCategoryId'])
                  as String?;
          _collection = listing?['shopCategoryId'] as String?;
          _bookingMode = '${listing?['bookingMode'] ?? 'none'}';
          _booking = {..._booking, ...?listing?['booking'] as Map?};
          _answers = Map<String, dynamic>.from(
            listing?['customFields'] as Map? ?? {},
          );
          final media = listing?['media'] as Map? ?? {};
          _image = media['imageUrl'] as String?;
          _gallery = (media['gallery'] as List? ?? [])
              .map((v) => '$v')
              .toList();
          _featured = listing?['featured'] == true;
          _isNew = listing?['isNew'] == true;
          _online = listing?['onlinePaymentEnabled'] != false;
          _ready = true;
        }
        final tree = data[_kind == 'service' ? 'services' : 'products'] as List;
        final categories = _flatten(tree), node = findShopNode(tree, _category);
        final fields =
            (node?['effectiveListingFields'] ?? node?['listingFields'] ?? [])
                as List;
        final collections = _flatten(data['collections'] as List);
        return Form(
          key: _form,
          child: ListView(
            padding: const EdgeInsets.all(18),
            children: [
              const CommerceFlowHeader(
                title: 'Listing details',
                message:
                    'Add an accurate description, your own photos and a price. Booking settings apply to services only.',
                icon: Icons.edit_note_outlined,
              ),
              const CommerceTitle('About the listing'),
              CommercePanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'product', label: Text('Product')),
                        ButtonSegment(value: 'service', label: Text('Service')),
                      ],
                      selected: {_kind},
                      onSelectionChanged: _busy
                          ? null
                          : (v) => setState(() {
                              _kind = v.first;
                              _category = null;
                              _answers = {};
                            }),
                    ),
                    const SizedBox(height: 18),
                    TextFormField(
                      controller: _name,
                      maxLength: 200,
                      decoration: const InputDecoration(
                        labelText: 'Listing name',
                      ),
                      validator: (v) => (v ?? '').trim().isEmpty
                          ? 'Give your listing a name.'
                          : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _description,
                      maxLines: 4,
                      maxLength: 5000,
                      decoration: const InputDecoration(
                        labelText: 'Description',
                        hintText:
                            'Describe what is included, condition and any important limitations.',
                        alignLabelWithHint: true,
                      ),
                    ),
                    DropdownButtonFormField<String>(
                      key: ValueKey(_kind),
                      initialValue: categories.any((c) => c['id'] == _category)
                          ? _category
                          : null,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Category / subcategory',
                      ),
                      items: [
                        for (final c in categories)
                          DropdownMenuItem(
                            value: '${c['id']}',
                            enabled:
                                (c['children'] as List? ?? const []).isEmpty,
                            child: Text(
                              '${c['displayName']}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                      onChanged: (v) => setState(() {
                        _category = v;
                        _answers = {};
                      }),
                      validator: (v) => v == null
                          ? 'Choose a category.'
                          : ((findShopNode(tree, v)?['children'] as List? ?? [])
                                .isNotEmpty)
                          ? 'Choose a subcategory within this group.'
                          : null,
                    ),
                    if (collections.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 14),
                        child: DropdownButtonFormField<String>(
                          initialValue: _collection,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Your shop collection (optional)',
                          ),
                          items: [
                            const DropdownMenuItem(
                              value: '',
                              child: Text('No collection'),
                            ),
                            for (final c in collections)
                              DropdownMenuItem(
                                value: '${c['id']}',
                                child: Text(
                                  '${c['displayName']}',
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                          ],
                          onChanged: (v) => _collection = v == '' ? null : v,
                        ),
                      ),
                  ],
                ),
              ),
              const CommerceTitle('Photos & video'),
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text(
                  'Use photos of the actual product, place or service. The cover appears in search results.',
                ),
              ),
              if (_image != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: SizedBox(height: 200, child: CommerceImage(_image)),
                ),
              MediaUploadButton(
                video: false,
                label: 'Choose cover photo',
                onUploaded: (u) => setState(() => _image = u),
              ),
              MediaUploadButton(
                folder: 'listing-gallery',
                label: 'Add gallery photo or video',
                onUploaded: (u) => setState(() => _gallery.add(u)),
              ),
              Wrap(
                spacing: 8,
                children: [
                  for (final u in _gallery)
                    InputChip(
                      avatar: Icon(
                        isVideoUrl(u)
                            ? Icons.videocam_outlined
                            : Icons.image_outlined,
                        size: 16,
                      ),
                      label: Text('Media ${_gallery.indexOf(u) + 1}'),
                      onDeleted: () => setState(() => _gallery.remove(u)),
                    ),
                ],
              ),
              const CommerceTitle('Pricing & stock'),
              CommercePanel(
                child: Column(
                  children: [
                    TextFormField(
                      controller: _price,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: InputDecoration(
                        labelText: _kind == 'service' && _bookingMode != 'none'
                            ? 'Price per ${_booking['unit']} (UGX)'
                            : 'Price (UGX)',
                      ),
                      validator: (v) =>
                          (v ?? '').isNotEmpty &&
                              (double.tryParse(v!) == null ||
                                  double.parse(v) < 0)
                          ? 'Enter a valid price.'
                          : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _original,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Original price (optional)',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _discount,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Discount % (optional)',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _inventory,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Stock quantity (optional)',
                        helperText: 'Leave blank if stock is not tracked.',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _sku,
                      decoration: const InputDecoration(
                        labelText: 'SKU (optional)',
                      ),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Mark as new'),
                      value: _isNew,
                      onChanged: (v) => setState(() => _isNew = v),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Featured listing'),
                      value: _featured,
                      onChanged: (v) => setState(() => _featured = v),
                    ),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Accept online payment'),
                      value: _online,
                      onChanged: (v) => setState(() => _online = v),
                    ),
                  ],
                ),
              ),
              if (fields.isNotEmpty) ...[
                const CommerceTitle('Category details'),
                CommercePanel(
                  child: Column(
                    children: [
                      for (final raw in fields)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: CustomFieldInput(
                            key: ValueKey('$_category-${raw['key']}'),
                            field: Map<String, dynamic>.from(raw),
                            value: _answers[raw['key']],
                            onChanged: (v) =>
                                setState(() => _answers['${raw['key']}'] = v),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
              if (_kind == 'service') ...[
                const CommerceTitle('Online reservations'),
                CommercePanel(
                  child: Column(
                    children: [
                      DropdownButtonFormField<String>(
                        initialValue: _bookingMode,
                        decoration: const InputDecoration(
                          labelText: 'Booking mode',
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: 'none',
                            child: Text('Contact only'),
                          ),
                          DropdownMenuItem(
                            value: 'request',
                            child: Text('Provider approval'),
                          ),
                          DropdownMenuItem(
                            value: 'instant',
                            child: Text('Instant booking'),
                          ),
                        ],
                        onChanged: (v) => setState(() => _bookingMode = v!),
                      ),
                      if (_bookingMode != 'none') ...[
                        const SizedBox(height: 14),
                        DropdownButtonFormField<String>(
                          initialValue: '${_booking['unit']}',
                          decoration: const InputDecoration(
                            labelText: 'Price unit',
                          ),
                          items: [
                            for (final u in ['night', 'day', 'hour'])
                              DropdownMenuItem(value: u, child: Text(u)),
                          ],
                          onChanged: (v) =>
                              setState(() => _booking['unit'] = v),
                        ),
                        for (final entry in {
                          'advanceDays': 'Days ahead bookable',
                          'minUnits': 'Minimum duration',
                          'maxUnits': 'Maximum duration',
                          'inventory': 'Rooms / spaces',
                          'capacity': 'Guests per room / space',
                          'leadTimeHours': 'Advance notice (hours)',
                          'responseHours': 'Response window (hours)',
                          'payWithinHours': 'Payment window (hours)',
                        }.entries)
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: TextFormField(
                              initialValue: '${_booking[entry.key] ?? ''}',
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(
                                labelText: entry.value,
                              ),
                              onChanged: (v) {
                                final number = int.tryParse(v);
                                if (number != null)
                                  _booking[entry.key] = number;
                              },
                            ),
                          ),
                        const SizedBox(height: 12),
                        DropdownButtonFormField<int>(
                          initialValue:
                              [
                                0,
                                20,
                                30,
                                50,
                                100,
                              ].contains(_booking['depositPercent'])
                              ? _booking['depositPercent']
                              : 0,
                          decoration: const InputDecoration(
                            labelText: 'Online deposit',
                          ),
                          items: [
                            for (final percent in [0, 20, 30, 50, 100])
                              DropdownMenuItem(
                                value: percent,
                                child: Text(
                                  percent == 0
                                      ? 'No online deposit'
                                      : '$percent% of booking total',
                                ),
                              ),
                          ],
                          onChanged: (v) => _booking['depositPercent'] = v,
                        ),
                        const SizedBox(height: 14),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Text(
                            'Dates unavailable for booking',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                        ),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            for (final date
                                in _booking['blockedDates'] as List? ?? [])
                              InputChip(
                                label: Text('$date'),
                                onDeleted: () => setState(
                                  () => _booking['blockedDates'] =
                                      (_booking['blockedDates'] as List)
                                          .where((d) => d != date)
                                          .toList(),
                                ),
                              ),
                            ActionChip(
                              avatar: const Icon(
                                Icons.event_busy_outlined,
                                size: 16,
                              ),
                              label: const Text('Block a date'),
                              onPressed: () async {
                                final date = await showDatePicker(
                                  context: context,
                                  firstDate: DateTime.now(),
                                  lastDate: DateTime.now().add(
                                    const Duration(days: 730),
                                  ),
                                );
                                if (date != null && mounted)
                                  setState(
                                    () => _booking['blockedDates'] = {
                                      ...?(_booking['blockedDates'] as List?),
                                      '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
                                    }.toList()..sort(),
                                  );
                              },
                            ),
                          ],
                        ),
                        for (final entry in {
                          'checkIn': 'Check-in time (HH:mm)',
                          'checkOut': 'Checkout time (HH:mm)',
                          'depositNote': 'Deposit note',
                          'openFrom': 'Hourly opening time (HH:mm)',
                          'openTo': 'Hourly closing time (HH:mm)',
                          'instructions': 'Guest instructions',
                        }.entries)
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: TextFormField(
                              initialValue: '${_booking[entry.key] ?? ''}',
                              decoration: InputDecoration(
                                labelText: entry.value,
                              ),
                              onChanged: (v) => _booking[entry.key] = v,
                            ),
                          ),
                        DropdownButtonFormField<String>(
                          initialValue:
                              [
                                'flexible',
                                'moderate',
                                'strict',
                              ].contains(_booking['cancellation'])
                              ? _booking['cancellation']
                              : 'flexible',
                          decoration: const InputDecoration(
                            labelText: 'Cancellation policy',
                          ),
                          items: [
                            for (final v in ['flexible', 'moderate', 'strict'])
                              DropdownMenuItem(value: v, child: Text(v)),
                          ],
                          onChanged: (v) => _booking['cancellation'] = v,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              const SizedBox(height: 22),
              FilledButton(
                onPressed: _busy ? null : () => _save(data['provider'] as Map),
                child: Padding(
                  padding: const EdgeInsets.all(15),
                  child: Text(_busy ? 'Saving…' : 'Save listing'),
                ),
              ),
            ],
          ),
        );
      },
    ),
  );
  Future<void> _save(Map provider) async {
    if (!_form.currentState!.validate()) return;
    final price = double.tryParse(_price.text) ?? 0,
        original = double.tryParse(_original.text),
        discount = int.tryParse(_discount.text),
        inventory = int.tryParse(_inventory.text);
    if (_kind == 'service' && _bookingMode != 'none' && price <= 0) {
      setState(
        () => _error = 'Bookable services need a price greater than zero.',
      );
      return;
    }
    if (_original.text.isNotEmpty && (original == null || original < price) ||
        _discount.text.isNotEmpty &&
            (discount == null ||
                discount < 1 ||
                discount > 100 ||
                original == null ||
                original <= 0) ||
        _inventory.text.isNotEmpty && (inventory == null || inventory < 0)) {
      setState(
        () => _error = 'Check the original price, discount and stock values.',
      );
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final payload = {
        'name': _name.text.trim(),
        'description': _description.text.trim(),
        'type': _kind,
        'price': price,
        'originalPrice': original,
        'discountPercent': discount,
        'inventory': inventory,
        'sku': _sku.text.trim().isEmpty ? null : _sku.text.trim(),
        'categoryId': provider['categoryId'],
        'productCategoryId': _kind == 'product' ? _category : null,
        'serviceCategoryId': _kind == 'service' ? _category : null,
        'shopCategoryId': _collection,
        'media': {'imageUrl': _image, 'gallery': _gallery},
        'customFields': _answers,
        'featured': _featured,
        'isNew': _isNew,
        'onlinePaymentEnabled': _online,
        if (_kind == 'service') ...{
          'bookingMode': _bookingMode,
          'booking': _bookingMode == 'none' ? <String, dynamic>{} : _booking,
        },
      };
      final api = ref.read(apiClientProvider);
      if (widget.listingId == null) {
        await api.post('/listings', body: payload);
      } else {
        await api.patch('/listings/${widget.listingId}', body: payload);
      }
      ref.invalidate(workspaceDataProvider('/listings/me?limit=100'));
      ref.invalidate(listingFormDataProvider(widget.listingId));
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted)
        setState(() {
          _busy = false;
          _error = '$e';
        });
    }
  }
}
