import 'package:flutter/material.dart';
import '../../../core/network/api_exception.dart';

String workspaceErrorMessage(
  Object error, {
  String fallback = 'Could not save your changes. Please try again.',
}) => error is ApiException
    ? error.message
    : error is StateError
    ? '${error.message}'
    : fallback;

class WorkspaceField {
  const WorkspaceField(
    this.keyName,
    this.label, {
    this.type = 'text',
    this.required = false,
    this.options = const [],
    this.value,
    this.labels = const {},
  });
  final String keyName, label, type;
  final bool required;
  final List<String> options;
  final Map<String, String> labels;
  final dynamic value;
}

Future<bool?> showWorkspaceForm(
  BuildContext context, {
  required String title,
  required List<WorkspaceField> fields,
  required Future<void> Function(Map<String, dynamic>) save,
  String action = 'Save',
}) => showModalBottomSheet<bool>(
  context: context,
  useSafeArea: true,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (_) =>
      WorkspaceForm(title: title, fields: fields, save: save, action: action),
);

class WorkspaceForm extends StatefulWidget {
  const WorkspaceForm({
    super.key,
    required this.title,
    required this.fields,
    required this.save,
    required this.action,
  });
  final String title, action;
  final List<WorkspaceField> fields;
  final Future<void> Function(Map<String, dynamic>) save;
  @override
  State<WorkspaceForm> createState() => _WorkspaceFormState();
}

class _WorkspaceFormState extends State<WorkspaceForm> {
  final _form = GlobalKey<FormState>();
  late final _controllers = {
    for (final field in widget.fields)
      field.keyName: TextEditingController(text: field.value?.toString() ?? ''),
  };
  late final Map<String, dynamic> _values = {
    for (final field in widget.fields) field.keyName: field.value,
  };
  bool _busy = false;
  String? _error;
  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      22,
      6,
      22,
      MediaQuery.viewInsetsOf(context).bottom + 20,
    ),
    child: SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      child: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.title,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 6),
            const Text(
              'Complete the details below. Optional fields are marked.',
            ),
            const SizedBox(height: 18),
            for (final f in widget.fields)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: f.type == 'bool'
                    ? SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(f.label),
                        value: _values[f.keyName] == true,
                        onChanged: _busy
                            ? null
                            : (v) => setState(() => _values[f.keyName] = v),
                      )
                    : f.options.isNotEmpty
                    ? DropdownButtonFormField<String>(
                        initialValue: f.options.contains(_values[f.keyName])
                            ? _values[f.keyName]
                            : null,
                        isExpanded: true,
                        decoration: InputDecoration(
                          labelText:
                              '${f.label}${f.required || f.label.toLowerCase().contains('optional') ? '' : ' (optional)'}',
                          errorMaxLines: 3,
                        ),
                        items: f.options
                            .map(
                              (s) => DropdownMenuItem(
                                value: s,
                                child: Text(
                                  f.labels[s] ?? s,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            )
                            .toList(),
                        onChanged: _busy ? null : (v) => _values[f.keyName] = v,
                        validator: (v) => f.required && (v ?? '').isEmpty
                            ? 'Choose ${f.label.toLowerCase()}.'
                            : null,
                      )
                    : TextFormField(
                        controller: _controllers[f.keyName],
                        enabled: !_busy,
                        obscureText: f.type == 'password',
                        autocorrect: f.type != 'password' && f.type != 'email',
                        enableSuggestions: f.type != 'password',
                        textInputAction: f.type == 'long'
                            ? TextInputAction.newline
                            : TextInputAction.next,
                        maxLines: f.type == 'long' ? 3 : 1,
                        keyboardType: f.type == 'number'
                            ? const TextInputType.numberWithOptions(
                                decimal: true,
                              )
                            : f.type == 'email'
                            ? TextInputType.emailAddress
                            : TextInputType.text,
                        decoration: InputDecoration(
                          labelText:
                              '${f.label}${f.required || f.label.toLowerCase().contains('optional') ? '' : ' (optional)'}',
                          errorMaxLines: 3,
                        ),
                        validator: (v) {
                          if (f.required && (v ?? '').trim().isEmpty)
                            return 'Enter ${f.label.toLowerCase()}.';
                          if (f.type == 'number' &&
                              (v ?? '').isNotEmpty &&
                              double.tryParse(v!) == null)
                            return 'Enter a valid number.';
                          if (f.type == 'password' && (v?.length ?? 0) < 8)
                            return 'Use at least 8 characters.';
                          return null;
                        },
                      ),
              ),
            if (_error != null)
              Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _busy
                  ? null
                  : () async {
                      if (!_form.currentState!.validate()) return;
                      setState(() {
                        _busy = true;
                        _error = null;
                      });
                      try {
                        final values = <String, dynamic>{
                          for (final f in widget.fields)
                            f.keyName: f.type == 'bool' || f.options.isNotEmpty
                                ? _values[f.keyName]
                                : f.type == 'number'
                                ? num.tryParse(
                                    _controllers[f.keyName]!.text.trim(),
                                  )
                                : _controllers[f.keyName]!.text.trim(),
                        };
                        await widget.save(values);
                        if (context.mounted) Navigator.pop(context, true);
                      } catch (e) {
                        if (mounted)
                          setState(() {
                            _busy = false;
                            _error = workspaceErrorMessage(e);
                          });
                      }
                    },
              child: Text(_busy ? 'Saving…' : widget.action),
            ),
          ],
        ),
      ),
    ),
  );
}
