import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPanelNotifications,
  classifyAdminExtension,
  classifyFileVisualKind,
} from './panelEnhancements';

test('buildPanelNotifications reflects real errors, suspended/high-CPU servers, and activity', () => {
  const notifications = buildPanelNotifications(
    [
      {
        id: '1',
        uuidShort: 'srv-1',
        name: 'Alpha SMP',
        node: 'eu-west-1',
        allocation: '198.51.100.14:25565',
        eggName: 'Paper 1.21',
        state: 'running',
        cpuPercent: 92.4,
        memoryUsedMb: 4096,
        memoryLimitMb: 8192,
        diskUsedMb: 10000,
        diskLimitMb: 20000,
      },
      {
        id: '2',
        uuidShort: 'srv-2',
        name: 'Suspended Box',
        node: 'us-east-2',
        allocation: '203.0.113.10:25566',
        eggName: 'Vanilla',
        state: 'suspended',
        cpuPercent: 0,
        memoryUsedMb: 0,
        memoryLimitMb: 2048,
        diskUsedMb: 1000,
        diskLimitMb: 10000,
      },
    ],
    [
      {
        id: 'act-1',
        event: 'server:power.start',
        description: 'Started Alpha SMP',
        actor: 'elena',
        ipAddress: '127.0.0.1',
        timestamp: '2026-11-23 12:00',
        status: 'completed',
      },
    ],
    'API timeout',
  );

  assert.equal(notifications[0]?.severity, 'danger');
  assert.ok(notifications.some((n) => n.title.includes('High CPU')));
  assert.ok(notifications.some((n) => n.title.includes('suspended')));
  assert.ok(notifications.some((n) => n.title === 'Started Alpha SMP'));
});

test('classifyAdminExtension groups extensions into Theme, Minecraft, Integrations, Infrastructure', () => {
  assert.equal(
    classifyAdminExtension({
      identifier: 'io.calagopus.blush',
      name: 'Petalnodes Theme',
      version: '0.3.0',
      author: 'Petalnodes',
      status: 'active',
      description: 'Light and dark theme',
    }).category,
    'Theme',
  );
  assert.equal(
    classifyAdminExtension({
      identifier: 'gg.ir77.mcversionchooser',
      name: 'MC Version Chooser',
      version: '1.2.0',
      author: 'ir77',
      status: 'active',
      description: 'Minecraft jar picker',
    }).category,
    'Minecraft',
  );
  assert.equal(
    classifyAdminExtension({
      identifier: 'dev.caloptreyx.gdrive',
      name: 'Google Drive Backups',
      version: '1.0.1',
      author: 'caloptreyx',
      status: 'disabled',
      description: 'Remote cloud backup sync',
    }).category,
    'Integrations',
  );
});

test('classifyFileVisualKind recognizes folders, jars, archives, configs, logs, and text', () => {
  assert.equal(classifyFileVisualKind('plugins', true), 'folder');
  assert.equal(classifyFileVisualKind('paper-1.21.jar', false), 'jar');
  assert.equal(classifyFileVisualKind('world-backup.tar.gz', false), 'archive');
  assert.equal(classifyFileVisualKind('server.properties', false), 'code');
  assert.equal(classifyFileVisualKind('latest.log', false), 'log');
  assert.equal(classifyFileVisualKind('eula.txt', false), 'text');
});
