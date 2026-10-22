/** Best-effort device info for the GPS-change audit log (`gps_audit_log`) — Manager and Admin are
 * both web-only roles (see CLAUDE.md), so `navigator` is reliably available there; `null` elsewhere
 * (native) just means the column stays empty for that row, never a crash. */
export function currentUserAgent(): string | null {
  return typeof navigator !== 'undefined' ? navigator.userAgent : null;
}
