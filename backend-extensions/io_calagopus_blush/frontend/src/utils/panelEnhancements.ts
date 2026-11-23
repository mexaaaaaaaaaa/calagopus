import type { CalagopusActivityEntry, CalagopusServerSummary } from '../api/calagopusDashboard';
import type { CalagopusAdminExtension } from '../api/calagopusModules';

export interface PanelNotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'danger' | 'success';
  targetPath?: string;
}

export function buildPanelNotifications(
  servers: readonly CalagopusServerSummary[],
  activity: readonly CalagopusActivityEntry[],
  errorMessage?: string | null,
): PanelNotificationItem[] {
  const items: PanelNotificationItem[] = [];

  if (errorMessage) {
    items.push({
      id: 'notif-api-error',
      title: 'Panel connection issue',
      description: errorMessage,
      timestamp: 'Now',
      severity: 'danger',
    });
  }

  for (const srv of servers) {
    if (srv.state === 'suspended') {
      items.push({
        id: `notif-srv-susp-${srv.uuidShort}`,
        title: `${srv.name} suspended`,
        description: `Container ${srv.uuidShort} on ${srv.node} requires attention.`,
        timestamp: 'Status',
        severity: 'danger',
        targetPath: `/server/${srv.uuidShort}/overview`,
      });
    } else if (srv.cpuPercent >= 85) {
      items.push({
        id: `notif-srv-cpu-${srv.uuidShort}`,
        title: `High CPU on ${srv.name}`,
        description: `Container CPU utilization is ${srv.cpuPercent.toFixed(1)}% on ${srv.node}.`,
        timestamp: 'Telemetry',
        severity: 'warning',
        targetPath: `/server/${srv.uuidShort}/overview`,
      });
    }
  }

  for (const act of activity.slice(0, 6)) {
    items.push({
      id: `notif-act-${act.id}`,
      title: act.description,
      description: `${act.event} · ${act.actor}`,
      timestamp: act.timestamp,
      severity:
        act.status === 'failed'
          ? 'danger'
          : act.status === 'warning'
            ? 'warning'
            : 'info',
      targetPath: '/account/activity',
    });
  }

  return items;
}

export type ExtensionCategory = 'Theme' | 'Minecraft' | 'Integrations' | 'Infrastructure';

export interface ClassifiedExtension extends CalagopusAdminExtension {
  category: ExtensionCategory;
  shortCode: string;
}

export function classifyAdminExtension(ext: CalagopusAdminExtension): ClassifiedExtension {
  const hay = `${ext.identifier} ${ext.name} ${ext.description}`.toLowerCase();
  let category: ExtensionCategory = 'Infrastructure';
  if (hay.includes('theme') || hay.includes('blush') || hay.includes('qunix') || hay.includes('mint') || hay.includes('amber')) {
    category = 'Theme';
  } else if (hay.includes('mc') || hay.includes('minecraft') || hay.includes('serverproperties') || hay.includes('player') || hay.includes('version')) {
    category = 'Minecraft';
  } else if (hay.includes('gdrive') || hay.includes('discord') || hay.includes('content') || hay.includes('ai')) {
    category = 'Integrations';
  }

  const words = ext.name.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).filter(Boolean);
  const shortCode =
    words.length >= 2
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : (words[0]?.slice(0, 2) ?? 'EX').toUpperCase();

  return {
    ...ext,
    category,
    shortCode,
  };
}

export type FileVisualKind = 'folder' | 'archive' | 'code' | 'log' | 'jar' | 'text';

export function classifyFileVisualKind(name: string, isDirectory: boolean): FileVisualKind {
  if (isDirectory) return 'folder';
  const lower = name.toLowerCase();
  if (lower.endsWith('.jar')) return 'jar';
  if (lower.endsWith('.zip') || lower.endsWith('.tar.gz') || lower.endsWith('.gz') || lower.endsWith('.tar')) {
    return 'archive';
  }
  if (
    lower.endsWith('.yml') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.json') ||
    lower.endsWith('.toml') ||
    lower.endsWith('.properties') ||
    lower.endsWith('.sh') ||
    lower.endsWith('.conf')
  ) {
    return 'code';
  }
  if (lower.endsWith('.log')) return 'log';
  return 'text';
}
