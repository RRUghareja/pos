import 'package:flutter/material.dart';

class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip(this.status, {super.key});

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _colors(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(
        _label(status),
        style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }

  String _label(String s) => s.replaceAll('_', ' ');

  (Color, Color) _colors(String s) {
    switch (s) {
      case 'PENDING':
        return (const Color(0xFFFFF3CD), const Color(0xFF8A6100));
      case 'IN_PROGRESS':
        return (const Color(0xFFDCEAFE), const Color(0xFF1D4ED8));
      case 'COMPLETED':
        return (const Color(0xFFD1FAE5), const Color(0xFF047857));
      case 'DELIVERED':
        return (const Color(0xFFE0E7FF), const Color(0xFF3730A3));
      case 'CANCELLED':
        return (const Color(0xFFFEE2E2), const Color(0xFFB91C1C));
      default:
        return (const Color(0xFFE5E7EB), const Color(0xFF374151));
    }
  }
}
