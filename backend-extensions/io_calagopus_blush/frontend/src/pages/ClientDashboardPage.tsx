import React from 'react';
import {
  Activity,
  ArrowUpRight,
  Cpu,
  HardDrive,
  Key,
  Power,
  Server,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  computeServerOverviewMetrics,
  filterServersByQuery,
  formatMegabytes,
  formatPercent,
  type CalagopusActivityEntry,
  type CalagopusServerSummary,
  type ClientDashboardPayload,
} from '../api/calagopusDashboard';
import { Button } from '../components/Button';
import { DataTable, type TableColumn } from '../components/DataTable';
import { EmptyState, ErrorState, SkeletonBlock } from '../components/FeedbackStates';
import { SearchField, SelectDropdown } from '../components/FormControls';
import { Pagination } from '../components/Navigation';
import { PetalIslandShowcaseCard } from '../components/PetalIslandShowcaseCard';
import { StatCard } from '../components/StatCard';
import { Card, PageHeader, ProfileBadge, StatusBadge } from '../components/Surface';
import { paginateSlice } from '../api/calagopusCore';
import type { CalagopusUserContext } from '../navigation/calagopusRoutes';
import { sortRowsByKey, type SortDirection } from '../utils/themeHelpers';

export interface ClientDashboardPageProps {
  user: CalagopusUserContext;
  data: ClientDashboardPayload | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onNavigate: (path: string) => void;
  dataSourceLabel?: string;
  compact?: boolean;
}

function getServerStatusTone(state: CalagopusServerSummary['state']) {
  if (state === 'running') return 'success' as const;
  if (state === 'starting' || state === 'stopping') return 'warning' as const;
  if (state === 'suspended') return 'danger' as const;
  return 'neutral' as const;
}

export function ClientDashboardPage({
  user,
  data,
  loading,
  error,
  onRetry,
  onNavigate,
  dataSourceLabel,
  compact = false,
}: ClientDashboardPageProps) {
  const [serverQuery, setServerQuery] = React.useState('');
  const [stateFilter, setStateFilter] = React.useState<'all' | 'running' | 'offline'>('all');
  const [sortKey, setSortKey] = React.useState<keyof CalagopusServerSummary & string>('name');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');
  const [serverPage, setServerPage] = React.useState(1);

  const servers = data?.servers ?? [];
  const activity = data?.activity ?? [];
  const metrics = React.useMemo(() => computeServerOverviewMetrics(servers), [servers]);

  const filteredServers = React.useMemo(() => {
    const byQuery = filterServersByQuery(servers, serverQuery);
    const byState =
      stateFilter === 'all'
        ? byQuery
        : byQuery.filter((srv) =>
            stateFilter === 'running'
              ? srv.state === 'running' || srv.state === 'starting'
              : srv.state !== 'running' && srv.state !== 'starting',
          );
    return sortRowsByKey(byState, sortKey, sortDirection);
  }, [servers, serverQuery, stateFilter, sortKey, sortDirection]);

  const { pageItems: pagedServers, safePage: safeServerPage } = React.useMemo(
    () => paginateSlice(filteredServers, serverPage, 4),
    [filteredServers, serverPage],
  );

  const handleSort = (key: keyof CalagopusServerSummary & string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setServerPage(1);
  };

  const canAccessAdmin =
    user.isAdmin || user.permissions.some((p) => p.startsWith('admin.'));

  const serverColumns: readonly TableColumn<CalagopusServerSummary>[] = [
    {
      key: 'name',
      header: 'Server',
      sortable: true,
      render: (srv) => (
        <div className="min-w-0">
          <p className="font-medium text-[#29232A] truncate">{srv.name}</p>
          <p className="font-mono text-[12px] text-[#777078] tabular-nums">
            {srv.uuidShort} · {srv.eggName}
          </p>
        </div>
      ),
    },
    {
      key: 'node',
      header: 'Node & Address',
      sortable: true,
      render: (srv) => (
        <div className="min-w-0">
          <p className="text-[13px] text-[#29232A]">{srv.node}</p>
          <p className="font-mono text-[12px] text-[#777078] tabular-nums">
            {srv.allocation}
          </p>
        </div>
      ),
    },
    {
      key: 'cpuPercent',
      header: 'CPU',
      align: 'right',
      numeric: true,
      sortable: true,
      render: (srv) => formatPercent(srv.cpuPercent),
    },
    {
      key: 'memoryUsedMb',
      header: 'Memory',
      align: 'right',
      numeric: true,
      sortable: true,
      render: (srv) =>
        `${formatMegabytes(srv.memoryUsedMb)} / ${formatMegabytes(srv.memoryLimitMb)}`,
    },
    {
      key: 'state',
      header: 'Status',
      sortable: true,
      render: (srv) => (
        <StatusBadge
          tone={getServerStatusTone(srv.state)}
          label={srv.state.charAt(0).toUpperCase() + srv.state.slice(1)}
        />
      ),
    },
  ];

  const activityColumns: readonly TableColumn<CalagopusActivityEntry>[] = [
    {
      key: 'description',
      header: 'Event',
      render: (entry) => (
        <div>
          <p className="font-medium text-[#29232A]">{entry.description}</p>
          <p className="font-mono text-[12px] text-[#777078]">{entry.event}</p>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
    },
    {
      key: 'ipAddress',
      header: 'Source IP',
      numeric: true,
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      numeric: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (entry) => (
        <StatusBadge
          tone={
            entry.status === 'completed'
              ? 'success'
              : entry.status === 'warning'
                ? 'warning'
                : 'danger'
          }
          label={entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user.username}`}
        description="Overview of your Petalnodes server instances, resource allocations, and recent account activity."
        metadata={
          dataSourceLabel
            ? [user.email, user.isAdmin ? 'Administrator' : 'Member', dataSourceLabel]
            : [user.email, user.isAdmin ? 'Administrator' : 'Member']
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Key className="h-4 w-4" />}
              onClick={() => onNavigate('/account/api-keys')}
            >
              API Keys
            </Button>
            {canAccessAdmin ? (
              <Button
                variant="soft"
                size="sm"
                leftIcon={<ShieldCheck className="h-4 w-4" />}
                onClick={() => onNavigate('/admin')}
              >
                Admin Overview
              </Button>
            ) : null}
          </>
        }
      />

      {error ? (
        <ErrorState
          title="Unable to load dashboard data"
          description={error}
          onRetry={onRetry}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Accessible Servers"
          value={metrics.total}
          helper="Provisioned in current scope"
          icon={<Server className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Running Instances"
          value={metrics.running}
          helper={
            metrics.total > 0
              ? `${Math.round((metrics.running / metrics.total) * 100)}% active`
              : 'No active instances'
          }
          progressPercent={metrics.total > 0 ? (metrics.running / metrics.total) * 100 : 0}
          icon={<Power className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Offline Instances"
          value={metrics.offline}
          helper="Stopped or idle containers"
          icon={<Cpu className="h-4 w-4" />}
          loading={loading}
        />
        <StatCard
          label="Allocated Memory"
          value={formatMegabytes(metrics.allocatedMemoryMb)}
          helper="Combined container RAM quota"
          icon={<HardDrive className="h-4 w-4" />}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card
          title="Account Summary"
          description="Authenticated identity and security status."
          headerAction={
            <StatusBadge
              tone={user.isAdmin ? 'pink' : 'success'}
              label={user.isAdmin ? 'Admin Role' : 'Active'}
            />
          }
        >
          <div className="space-y-4">
            <ProfileBadge name={user.username} subtitle={user.email} />
            <div className="flex items-center justify-between border-t border-[#EEE5E9] pt-3 text-[13px]">
              <span className="text-[#777078]">Access Scope</span>
              <span className="font-medium text-[#29232A]">
                {user.isAdmin ? 'Full Panel & Admin' : `${user.permissions.length} Scoped Grants`}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<User className="h-3.5 w-3.5" />}
                onClick={() => onNavigate('/account')}
              >
                Profile
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Shield className="h-3.5 w-3.5" />}
                onClick={() => onNavigate('/account/security')}
              >
                Security
              </Button>
            </div>
          </div>
        </Card>

        <Card
          className="lg:col-span-2"
          title="Quick Actions"
          description="Direct shortcuts to Petalnodes account and server management routes."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onNavigate('/account/api-keys')}
              className="blush-transition blush-focus-ring flex items-center justify-between rounded-lg border border-[#EEE5E9] bg-[#FCFAFB] p-3.5 text-left hover:border-[#F7BDD2] hover:bg-[#FFF5F8] cursor-pointer"
            >
              <span className="block min-w-0">
                <span className="block text-sm font-medium text-[#29232A]">Manage API Keys</span>
                <span className="block text-[12px] text-[#777078] truncate">
                  Create or revoke client API tokens
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-[#8E2E52] shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/account/ssh-keys')}
              className="blush-transition blush-focus-ring flex items-center justify-between rounded-lg border border-[#EEE5E9] bg-[#FCFAFB] p-3.5 text-left hover:border-[#F7BDD2] hover:bg-[#FFF5F8] cursor-pointer"
            >
              <span className="block min-w-0">
                <span className="block text-sm font-medium text-[#29232A]">SSH Public Keys</span>
                <span className="block text-[12px] text-[#777078] truncate">
                  Configure SFTP &amp; SSH credentials
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-[#8E2E52] shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/account/activity')}
              className="blush-transition blush-focus-ring flex items-center justify-between rounded-lg border border-[#EEE5E9] bg-[#FCFAFB] p-3.5 text-left hover:border-[#F7BDD2] hover:bg-[#FFF5F8] cursor-pointer"
            >
              <span className="block min-w-0">
                <span className="block text-sm font-medium text-[#29232A]">Account Activity</span>
                <span className="block text-[12px] text-[#777078] truncate">
                  Inspect login and key audit history
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-[#8E2E52] shrink-0" aria-hidden="true" />
            </button>

            {canAccessAdmin ? (
              <button
                type="button"
                onClick={() => onNavigate('/admin')}
                className="blush-transition blush-focus-ring flex items-center justify-between rounded-lg border border-[#F7BDD2] bg-[#FFF5F8] p-3.5 text-left hover:bg-[#FCE7EF] cursor-pointer"
              >
                <span className="block min-w-0">
                  <span className="block text-sm font-medium text-[#8E2E52]">Administration Panel</span>
                  <span className="block text-[12px] text-[#777078] truncate">
                    Nodes, locations, nests, users &amp; extensions
                  </span>
                </span>
                <ArrowUpRight className="h-4 w-4 text-[#8E2E52] shrink-0" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </Card>
      </div>

      <PetalIslandShowcaseCard
        onNavigate={onNavigate}
        primaryServerPath={servers[0] ? `/server/${servers[0].uuidShort}` : undefined}
        primaryServerName={servers[0] ? `${servers[0].name} Console` : undefined}
      />

      <Card
        title="Your Servers"
        description="Live container inventory, node allocations, and resource utilization."
        headerAction={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-64">
              <SearchField
                aria-label="Filter servers"
                placeholder="Search name, node, or egg..."
                value={serverQuery}
                onChange={(val) => {
                  setServerQuery(val);
                  setServerPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-36">
              <SelectDropdown
                aria-label="Filter by status"
                value={stateFilter}
                onChange={(val: string | null) => {
                  setStateFilter((val as 'all' | 'running' | 'offline') ?? 'all');
                  setServerPage(1);
                }}
                data={[
                  { value: 'all', label: 'All states' },
                  { value: 'running', label: 'Running' },
                  { value: 'offline', label: 'Offline' },
                ]}
              />
            </div>
          </div>
        }
      >
        {loading ? (
          <SkeletonBlock lines={4} />
        ) : (
          <div className="space-y-4">
            <DataTable
              caption="Accessible Calagopus Servers"
              columns={serverColumns}
              rows={pagedServers}
              compact={compact}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              renderActions={(srv) => (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onNavigate(`/server/${srv.uuidShort}`)}
                >
                  Manage
                </Button>
              )}
              emptyState={
                <EmptyState
                  title={serverQuery || stateFilter !== 'all' ? 'No matching servers' : 'No servers assigned'}
                  description={
                    serverQuery || stateFilter !== 'all'
                      ? 'Reset the search or status filter to see all servers in your account.'
                      : 'Servers assigned to your account or subuser permissions will appear here.'
                  }
                  actionLabel={serverQuery || stateFilter !== 'all' ? 'Reset Filters' : undefined}
                  onAction={
                    serverQuery || stateFilter !== 'all'
                      ? () => {
                          setServerQuery('');
                          setStateFilter('all');
                          setServerPage(1);
                        }
                      : undefined
                  }
                />
              }
            />
            {filteredServers.length > 0 ? (
              <Pagination
                currentPage={safeServerPage}
                totalItems={filteredServers.length}
                pageSize={4}
                onPageChange={setServerPage}
              />
            ) : null}
          </div>
        )}
      </Card>

      <Card
        title="Recent Activity"
        description="Recent authentication and container lifecycle actions."
        headerAction={
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Activity className="h-3.5 w-3.5" />}
            onClick={() => onNavigate('/account/activity')}
          >
            View All
          </Button>
        }
      >
        {loading ? (
          <SkeletonBlock lines={4} />
        ) : (
          <DataTable
            caption="Recent Account Activity"
            columns={activityColumns}
            rows={activity}
            compact={compact}
            emptyState={
              <EmptyState
                title="No recent activity"
                description="Account and server actions will be logged here automatically."
              />
            }
          />
        )}
      </Card>
    </div>
  );
}
