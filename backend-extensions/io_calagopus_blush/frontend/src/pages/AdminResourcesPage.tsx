import React from 'react';
import { Cpu, Globe, Layers, Puzzle, Server, Settings, Shield, Users } from 'lucide-react';
import { formatMegabytes, type CalagopusActivityEntry, type CalagopusServerSummary } from '../api/calagopusDashboard';
import {
  filterRecordsByText,
  type CalagopusAdminExtension,
  type CalagopusAdminNode,
} from '../api/calagopusModules';
import { Button } from '../components/Button';
import { DataTable, type TableColumn } from '../components/DataTable';
import { EmptyState, ErrorState } from '../components/FeedbackStates';
import { SearchField } from '../components/FormControls';
import { Card, PageHeader, StatusBadge } from '../components/Surface';
import type { CalagopusUserContext } from '../navigation/calagopusRoutes';
import { ActivityLogPage } from './ActivityLogPage';

export interface AdminResourcesPageProps {
  currentPath: string;
  user: CalagopusUserContext;
  nodes: readonly CalagopusAdminNode[];
  extensions: readonly CalagopusAdminExtension[];
  servers: readonly CalagopusServerSummary[];
  auditLogs: readonly CalagopusActivityEntry[];
  onNavigate: (path: string) => void;
  compact?: boolean;
}

export function AdminResourcesPage({
  currentPath,
  user,
  nodes,
  extensions,
  servers,
  auditLogs,
  onNavigate,
  compact = false,
}: AdminResourcesPageProps) {
  const [query, setQuery] = React.useState('');

  const canAccessAdmin =
    user.isAdmin || user.permissions.some((p) => p.startsWith('admin.'));

  if (!canAccessAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Administration" description="Petalnodes administrative controls." />
        <ErrorState
          title="Administrator permission required"
          description="Your account role does not hold administrative privileges."
          retryLabel="Return to Workspace"
          onRetry={() => onNavigate('/')}
        />
      </div>
    );
  }

  if (currentPath === '/admin/audit-logs') {
    return (
      <ActivityLogPage
        title="Admin Audit Logs"
        description="System-wide administrative actions, node heartbeats, and extension events."
        entries={auditLogs}
        compact={compact}
      />
    );
  }

  if (currentPath === '/admin/nodes' || currentPath === '/admin/locations') {
    const filteredNodes = filterRecordsByText(nodes, query, (n) => [
      n.name,
      n.fqdn,
      n.location,
    ]);

    const nodeColumns: readonly TableColumn<CalagopusAdminNode>[] = [
      {
        key: 'name',
        header: 'Node',
        render: (n) => (
          <div>
            <p className="font-medium text-[#29232A]">{n.name}</p>
            <p className="font-mono text-[12px] text-[#777078]">{n.fqdn}</p>
          </div>
        ),
      },
      { key: 'location', header: 'Location' },
      {
        key: 'memoryAllocatedMb',
        header: 'Memory Allocated',
        align: 'right',
        numeric: true,
        render: (n) => `${formatMegabytes(n.memoryAllocatedMb)} / ${formatMegabytes(n.memoryMb)}`,
      },
      {
        key: 'serversCount',
        header: 'Servers',
        align: 'right',
        numeric: true,
      },
      {
        key: 'status',
        header: 'Daemon',
        render: (n) => (
          <StatusBadge
            tone={n.status === 'online' ? 'success' : 'warning'}
            label={n.status === 'online' ? 'Online' : 'Maintenance'}
          />
        ),
      },
    ];

    return (
      <div className="space-y-6">
        <PageHeader
          title={currentPath === '/admin/locations' ? 'Locations' : 'Nodes'}
          description="Regional infrastructure hosts connected via the Calagopus Wings daemon."
          metadata={[`${nodes.length} Wings nodes configured`]}
        />
        <Card
          title="Cluster Nodes"
          headerAction={
            <div className="w-full sm:w-64">
              <SearchField
                aria-label="Search nodes"
                placeholder="Search node or region..."
                value={query}
                onChange={setQuery}
              />
            </div>
          }
        >
          <DataTable
            caption="Cluster Nodes"
            columns={nodeColumns}
            rows={filteredNodes}
            compact={compact}
            emptyState={
              <EmptyState
                icon={currentPath === '/admin/locations' ? <Globe className="h-5 w-5" /> : <Cpu className="h-5 w-5" />}
                title="No matching nodes"
                description="Adjust your search filter."
              />
            }
          />
        </Card>
      </div>
    );
  }

  if (currentPath === '/admin/extensions') {
    type ExtensionRow = CalagopusAdminExtension & { id: string };
    const extRows: ExtensionRow[] = extensions.map((ext) => ({ ...ext, id: ext.identifier }));
    const extColumns: readonly TableColumn<ExtensionRow>[] = [
      {
        key: 'name',
        header: 'Extension',
        render: (ext) => (
          <div>
            <p className="font-medium text-[#29232A]">{ext.name}</p>
            <p className="font-mono text-[12px] text-[#777078]">{ext.identifier}</p>
          </div>
        ),
      },
      { key: 'description', header: 'Description' },
      { key: 'version', header: 'Version', numeric: true },
      {
        key: 'status',
        header: 'Status',
        render: (ext) => (
          <StatusBadge
            tone={ext.status === 'active' ? 'pink' : 'neutral'}
            label={ext.status === 'active' ? 'Active' : 'Disabled'}
          />
        ),
      },
    ];

    return (
      <div className="space-y-6">
        <PageHeader
          title="Extensions"
          description="Installed `.c7s.zip` extensions compiled into this Calagopus panel instance."
          metadata={[`${extensions.length} installed`]}
        />
        <Card title="Installed Extensions">
          <DataTable
            caption="Calagopus Extensions"
            columns={extColumns}
            rows={extRows}
            compact={compact}
            emptyState={
              <EmptyState
                icon={<Puzzle className="h-5 w-5" />}
                title="No extensions registered"
                description="Upload a `.c7s.zip` theme or extension archive from Calagopus admin CLI/UI."
              />
            }
          />
        </Card>
      </div>
    );
  }

  if (currentPath === '/admin/servers') {
    const filteredServers = filterRecordsByText(servers, query, (s) => [
      s.name,
      s.uuidShort,
      s.node,
      s.eggName,
    ]);
    const srvCols: readonly TableColumn<CalagopusServerSummary>[] = [
      {
        key: 'name',
        header: 'Server',
        render: (s) => (
          <div>
            <p className="font-medium text-[#29232A]">{s.name}</p>
            <p className="font-mono text-[12px] text-[#777078]">
              {s.uuidShort} · {s.eggName}
            </p>
          </div>
        ),
      },
      { key: 'node', header: 'Node' },
      { key: 'allocation', header: 'Allocation', numeric: true },
      {
        key: 'memoryLimitMb',
        header: 'RAM Quota',
        align: 'right',
        numeric: true,
        render: (s) => formatMegabytes(s.memoryLimitMb),
      },
      {
        key: 'state',
        header: 'State',
        render: (s) => (
          <StatusBadge
            tone={s.state === 'running' ? 'success' : 'neutral'}
            label={s.state.charAt(0).toUpperCase() + s.state.slice(1)}
          />
        ),
      },
    ];

    return (
      <div className="space-y-6">
        <PageHeader
          title="All Servers"
          description="Admin inventory across all Petalnodes nodes."
          metadata={[`${servers.length} servers in scope`]}
        />
        <Card
          title="Server Directory"
          headerAction={
            <div className="w-full sm:w-64">
              <SearchField
                aria-label="Filter admin servers"
                placeholder="Search servers..."
                value={query}
                onChange={setQuery}
              />
            </div>
          }
        >
          <DataTable
            caption="Admin Server Directory"
            columns={srvCols}
            rows={filteredServers}
            compact={compact}
            renderActions={(s) => (
              <Button variant="secondary" size="sm" onClick={() => onNavigate(`/server/${s.uuidShort}`)}>
                Console
              </Button>
            )}
            emptyState={
              <EmptyState
                icon={<Server className="h-5 w-5" />}
                title="No servers matched"
                description="Clear the search filter to see all servers."
              />
            }
          />
        </Card>
      </div>
    );
  }

  const routeMeta: Record<string, { title: string; desc: string; icon: React.ReactNode }> = {
    '/admin/settings': {
      title: 'Panel Settings',
      desc: 'Calagopus application configuration, branding, mail, and captcha settings.',
      icon: <Settings className="h-5 w-5" />,
    },
    '/admin/nests': {
      title: 'Nests & Eggs',
      desc: 'Container runtime definitions and egg installation scripts synced with Calagopus.',
      icon: <Layers className="h-5 w-5" />,
    },
    '/admin/users': {
      title: 'Users',
      desc: 'Panel user directory managed through the Calagopus administrative API.',
      icon: <Users className="h-5 w-5" />,
    },
    '/admin/roles': {
      title: 'Roles & Permissions',
      desc: 'RBAC role definitions enforced by the Rust/Axum authorization layer.',
      icon: <Shield className="h-5 w-5" />,
    },
  };

  const info = routeMeta[currentPath] ?? {
    title: `Admin: ${currentPath}`,
    desc: 'Managed directly by the Calagopus administrative backend.',
    icon: <Shield className="h-5 w-5" />,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={info.title}
        description={info.desc}
        actions={
          <Button variant="secondary" size="sm" onClick={() => onNavigate('/admin')}>
            Admin Overview
          </Button>
        }
      />
      <EmptyState
        icon={info.icon}
        title={`${info.title} requires live Calagopus Admin API`}
        description="Connect a running Calagopus Rust/Axum panel instance to load and edit records on this administrative endpoint without synthetic placeholder forms."
        actionLabel="Return to Admin Overview"
        onAction={() => onNavigate('/admin')}
      />
    </div>
  );
}
