import React from 'react';
import { Activity } from 'lucide-react';
import { paginateSlice } from '../api/calagopusCore';
import type { CalagopusActivityEntry } from '../api/calagopusDashboard';
import { DataTable, type TableColumn } from '../components/DataTable';
import { EmptyState } from '../components/FeedbackStates';
import { SearchField, SelectDropdown } from '../components/FormControls';
import { Pagination } from '../components/Navigation';
import { Card, PageHeader, StatusBadge } from '../components/Surface';

export interface ActivityLogPageProps {
  title: string;
  description: string;
  entries: readonly CalagopusActivityEntry[];
  compact?: boolean;
}

const PAGE_SIZE = 6;

export function ActivityLogPage({ title, description, entries, compact = false }: ActivityLogPageProps) {
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'completed' | 'warning' | 'failed'>('all');
  const [page, setPage] = React.useState(1);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!q) return true;
      return (
        entry.event.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.actor.toLowerCase().includes(q) ||
        entry.ipAddress.toLowerCase().includes(q)
      );
    });
  }, [entries, query, statusFilter]);

  const { pageItems, safePage } = React.useMemo(
    () => paginateSlice(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  const columns: readonly TableColumn<CalagopusActivityEntry>[] = [
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
    { key: 'actor', header: 'Actor' },
    { key: 'ipAddress', header: 'Source IP', numeric: true },
    { key: 'timestamp', header: 'Timestamp', numeric: true },
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
      <PageHeader title={title} description={description} metadata={[`${entries.length} logged events`]} />

      <Card
        title="Audit Trail"
        description="Search events by action, actor, or IP address."
        headerAction={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-56">
              <SearchField
                aria-label="Filter activity logs"
                placeholder="Search event, actor, or IP..."
                value={query}
                onChange={(val) => {
                  setQuery(val);
                  setPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-36">
              <SelectDropdown
                aria-label="Filter by outcome"
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter((val as 'all' | 'completed' | 'warning' | 'failed') ?? 'all');
                  setPage(1);
                }}
                data={[
                  { value: 'all', label: 'All events' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'warning', label: 'Warning' },
                  { value: 'failed', label: 'Failed' },
                ]}
              />
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <DataTable
            caption="Activity Log"
            columns={columns}
            rows={pageItems}
            compact={compact}
            emptyState={
              <EmptyState
                icon={<Activity className="h-5 w-5" />}
                title="No activity records found"
                description="Try clearing the search query or status filter."
                actionLabel={query || statusFilter !== 'all' ? 'Reset Filters' : undefined}
                onAction={
                  query || statusFilter !== 'all'
                    ? () => {
                        setQuery('');
                        setStatusFilter('all');
                        setPage(1);
                      }
                    : undefined
                }
              />
            }
          />
          {filtered.length > 0 ? (
            <Pagination
              currentPage={safePage}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </Card>
    </div>
  );
}
