import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/api/api_client.dart';
import '../../../core/auth/auth_controller.dart';
import '../../shared/widgets/status_chip.dart';
import '../worker_providers.dart';

const _workerStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED'];

class OrderDetailPage extends ConsumerStatefulWidget {
  final String orderId;
  final bool allowStatusUpdate;
  const OrderDetailPage({super.key, required this.orderId, this.allowStatusUpdate = false});

  @override
  ConsumerState<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends ConsumerState<OrderDetailPage> {
  Map<String, dynamic>? _order;
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  String? _error;
  bool _updating = false;
  bool _postingMessage = false;
  final _msgController = TextEditingController();
  String _msgType = 'CHAT';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _msgController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final dio = ref.read(dioProvider);
      final results = await Future.wait([
        dio.get('/orders/${widget.orderId}'),
        dio.get('/orders/${widget.orderId}/messages'),
      ]);
      setState(() {
        _order = results[0].data['order'] as Map<String, dynamic>;
        _messages =
            (results[1].data['messages'] as List).cast<Map<String, dynamic>>();
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _updateStatus(String status) async {
    setState(() => _updating = true);
    final dio = ref.read(dioProvider);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await dio.patch('/orders/${widget.orderId}', data: {'status': status});
      setState(() {
        _order = {..._order!, 'status': r.data['order']['status']};
      });
      ref.invalidate(workerOrdersProvider);
      messenger.showSnackBar(const SnackBar(content: Text('Status updated')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _postMessage() async {
    final body = _msgController.text.trim();
    if (body.isEmpty) return;
    setState(() => _postingMessage = true);
    final dio = ref.read(dioProvider);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await dio.post(
        '/orders/${widget.orderId}/messages',
        data: {'type': _msgType, 'body': body},
      );
      setState(() {
        _messages = [..._messages, r.data['message'] as Map<String, dynamic>];
        _msgController.clear();
      });
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Send failed: $e')));
    } finally {
      if (mounted) setState(() => _postingMessage = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Order details')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!)))
              : _body(),
    );
  }

  Widget _body() {
    final o = _order!;
    final cuisines = (o['cuisines'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final inventoryUsage =
        (o['inventoryUsage'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final rawMaterials = inventoryUsage
        .where((u) => (u['inventoryItem']?['type']) == 'RAW_MATERIAL')
        .toList();
    final kitchen = inventoryUsage
        .where((u) => (u['inventoryItem']?['type']) != 'RAW_MATERIAL')
        .toList();
    final workers = (o['workers'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final customer = o['customer'] as Map<String, dynamic>?;
    final scheduledFor = o['scheduledFor'] != null
        ? DateTime.parse(o['scheduledFor'] as String).toLocal()
        : null;
    final totalPlates =
        cuisines.fold<int>(0, (s, c) => s + (c['plates'] as int? ?? 0));

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  o['orderNumber'] as String,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
              StatusChip(o['status'] as String),
            ],
          ),
          const SizedBox(height: 12),
          if (scheduledFor != null)
            _InfoRow(
              icon: Icons.event,
              label: 'When',
              value: DateFormat('EEE, MMM d · HH:mm').format(scheduledFor),
            ),
          if (o['location'] != null && (o['location'] as String).isNotEmpty)
            _InfoRow(
              icon: Icons.location_on,
              label: 'Location',
              value: o['location'] as String,
            ),
          if (customer != null)
            _InfoRow(
              icon: Icons.person,
              label: 'Customer',
              value:
                  '${customer['user']?['name'] ?? '—'}${customer['user']?['phone'] != null ? '  ·  ${customer['user']['phone']}' : ''}',
            ),
          if (workers.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Team on this order',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: workers
                  .map(
                    (w) => Chip(
                      avatar: const Icon(Icons.person_outline, size: 16),
                      label: Text(
                        (w['worker']?['user']?['name'] as String?) ?? '—',
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (cuisines.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text('Cuisines  ·  $totalPlates plates',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ...cuisines.map(
              (c) => _LineCard(
                title: (c['cuisine']?['name'] as String?) ?? '—',
                trailing: '× ${c['plates']} plates',
              ),
            ),
          ],
          if (rawMaterials.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Raw materials',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ...rawMaterials.map(
              (u) => _LineCard(
                title: (u['inventoryItem']?['name'] as String?) ?? '—',
                trailing: '${u['quantity']} ${u['inventoryItem']?['unit'] ?? ''}',
              ),
            ),
          ],
          if (kitchen.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Kitchen inventory',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            ...kitchen.map(
              (u) => _LineCard(
                title: (u['inventoryItem']?['name'] as String?) ?? '—',
                trailing: '${u['quantity']} ${u['inventoryItem']?['unit'] ?? ''}',
              ),
            ),
          ],
          if (o['notes'] != null && (o['notes'] as String).isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Notes', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(o['notes'] as String),
          ],
          if (widget.allowStatusUpdate) ...[
            const SizedBox(height: 24),
            const Text('Update status',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _workerStatuses.map((s) {
                final selected = o['status'] == s;
                return ChoiceChip(
                  label: Text(s.replaceAll('_', ' ')),
                  selected: selected,
                  onSelected: _updating || selected ? null : (_) => _updateStatus(s),
                );
              }).toList(),
            ),
            if (_updating) ...[
              const SizedBox(height: 12),
              const LinearProgressIndicator(),
            ],
          ],
          const SizedBox(height: 24),
          const Divider(),
          const SizedBox(height: 8),
          const Text('Discussion',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          const Text(
            'Chat with the team, raise suggestions, or log customer feedback.',
            style: TextStyle(color: Colors.black54, fontSize: 12),
          ),
          const SizedBox(height: 12),
          ..._messages.map((m) => _MessageBubble(
                message: m,
                isMine: m['author']?['id'] ==
                    ref.read(authControllerProvider).user?.id,
              )),
          if (_messages.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'No messages yet — be the first to write.',
                style: TextStyle(color: Colors.black54),
              ),
            ),
          const SizedBox(height: 12),
          _composer(),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _composer() {
    final role = ref.read(authControllerProvider).user?.role;
    final allowedTypes = role == UserRole.customer
        ? const ['COMPLAINT', 'SUGGESTION']
        : const ['CHAT', 'SUGGESTION'];
    if (!allowedTypes.contains(_msgType)) {
      _msgType = allowedTypes.first;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 6,
          children: allowedTypes
              .map(
                (t) => ChoiceChip(
                  label: Text(_typeLabel(t)),
                  selected: _msgType == t,
                  onSelected: (_) => setState(() => _msgType = t),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _msgController,
                minLines: 1,
                maxLines: 4,
                decoration: const InputDecoration(
                  hintText: 'Type a message…',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton.icon(
              icon: _postingMessage
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : const Icon(Icons.send, size: 16),
              label: const Text('Send'),
              onPressed: _postingMessage ? null : _postMessage,
            ),
          ],
        ),
      ],
    );
  }

  String _typeLabel(String t) {
    switch (t) {
      case 'CHAT':
        return 'Chat';
      case 'COMPLAINT':
        return 'Complaint';
      case 'SUGGESTION':
        return 'Suggestion';
    }
    return t;
  }
}

class _LineCard extends StatelessWidget {
  final String title;
  final String trailing;
  const _LineCard({required this.title, required this.trailing});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: Colors.grey.shade300),
      ),
      child: ListTile(
        dense: true,
        title: Text(title),
        trailing: Text(
          trailing,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Map<String, dynamic> message;
  final bool isMine;
  const _MessageBubble({required this.message, required this.isMine});

  @override
  Widget build(BuildContext context) {
    final author = message['author'] as Map<String, dynamic>?;
    final type = message['type'] as String? ?? 'CHAT';
    final created = DateTime.parse(message['createdAt'] as String).toLocal();

    Color bg;
    Color border;
    switch (type) {
      case 'COMPLAINT':
        bg = Colors.red.shade50;
        border = Colors.red.shade200;
        break;
      case 'SUGGESTION':
        bg = Colors.amber.shade50;
        border = Colors.amber.shade200;
        break;
      default:
        bg = isMine ? Colors.blue.shade50 : Colors.grey.shade100;
        border = isMine ? Colors.blue.shade200 : Colors.grey.shade300;
    }

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        constraints:
            BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        decoration: BoxDecoration(
          color: bg,
          border: Border.all(color: border),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment:
              isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${author?['name'] ?? '—'} · ${author?['role'] ?? ''}',
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.black54),
                ),
                if (type != 'CHAT') ...[
                  const SizedBox(width: 6),
                  Text(
                    '· $type',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: type == 'COMPLAINT'
                            ? Colors.red.shade700
                            : Colors.amber.shade800),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 2),
            Text(message['body'] as String),
            const SizedBox(height: 2),
            Text(
              DateFormat('MMM d HH:mm').format(created),
              style: const TextStyle(fontSize: 10, color: Colors.black45),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.black54),
          const SizedBox(width: 8),
          SizedBox(
            width: 80,
            child: Text(label, style: const TextStyle(color: Colors.black54)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}
