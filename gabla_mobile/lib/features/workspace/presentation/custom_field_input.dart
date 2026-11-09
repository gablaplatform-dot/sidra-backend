import 'package:flutter/material.dart';

class CustomFieldInput extends StatelessWidget {
  const CustomFieldInput({
    super.key,
    required this.field,
    required this.value,
    required this.onChanged,
  });
  final Map<String, dynamic> field;
  final dynamic value;
  final ValueChanged<dynamic> onChanged;
  @override
  Widget build(BuildContext context) {
    final label = '${field['label'] ?? field['key']}',
        type = '${field['type'] ?? 'text'}';
    final required = field['required'] == true;
    final options = (field['options'] as List? ?? [])
        .map((o) => o is Map ? '${o['value'] ?? o['label']}' : '$o')
        .toList();
    if (['boolean', 'checkbox', 'switch'].contains(type))
      return SwitchListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(label),
        value: value == true,
        onChanged: onChanged,
      );
    if (['multiselect', 'multi_select', 'multi-select'].contains(type)) {
      final chosen = (value is List ? value as List : [])
          .map((v) => '$v')
          .toSet();
      return FormField<bool>(
        validator: (_) => required && chosen.isEmpty ? 'Choose $label.' : null,
        builder: (state) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final option in options)
                  FilterChip(
                    label: Text(option),
                    selected: chosen.contains(option),
                    onSelected: (v) {
                      final next = {...chosen};
                      if (v) {
                        next.add(option);
                      } else {
                        next.remove(option);
                      }
                      onChanged(next.toList());
                    },
                  ),
              ],
            ),
            if (state.hasError)
              Text(
                state.errorText!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
          ],
        ),
      );
    }
    if (options.isNotEmpty)
      return DropdownButtonFormField<String>(
        initialValue: options.contains(value) ? value : null,
        isExpanded: true,
        decoration: InputDecoration(labelText: label),
        items: options
            .map((o) => DropdownMenuItem(value: o, child: Text(o)))
            .toList(),
        onChanged: onChanged,
        validator: (v) =>
            required && (v ?? '').isEmpty ? 'Choose $label.' : null,
      );
    return TextFormField(
      initialValue: value?.toString() ?? '',
      maxLines: type == 'textarea' ? 3 : 1,
      keyboardType: type == 'number'
          ? const TextInputType.numberWithOptions(decimal: true)
          : TextInputType.text,
      decoration: InputDecoration(labelText: '$label${required ? ' *' : ''}'),
      onChanged: (v) => onChanged(type == 'number' ? num.tryParse(v) : v),
      validator: (v) => required && (v ?? '').trim().isEmpty
          ? 'Enter $label.'
          : type == 'number' && (v ?? '').isNotEmpty && num.tryParse(v!) == null
          ? 'Enter a valid number.'
          : null,
    );
  }
}
