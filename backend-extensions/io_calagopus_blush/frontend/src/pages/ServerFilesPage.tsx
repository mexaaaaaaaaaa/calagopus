import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  Download,
  FileCode2,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plug,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  filterFilesByQuery,
  formatBytes,
  normalizeDirectoryPath,
  paginateSlice,
  resolveDirectoryBreadcrumbs,
  sanitizeDownloadFilename,
  sortFiles,
  validateFileMode,
  validateFilename,
  type CalagopusFileEntry,
  type CalagopusServerDetail,
  type FileSortKey,
} from '../api/calagopusCore';
import { Button } from '../components/Button';
import { EmptyState } from '../components/FeedbackStates';
import { SearchField, Textarea, TextInput } from '../components/FormControls';
import { Pagination } from '../components/Navigation';
import { ConfirmDialog, DropdownMenu, ModalDialog, showToast } from '../components/Overlays';
import { Card } from '../components/Surface';
import type { SortDirection } from '../utils/themeHelpers';

export interface ServerFilesPageProps {
  server: CalagopusServerDetail;
  files: readonly CalagopusFileEntry[];
  onCreateEntry: (directory: string, name: string, isDirectory: boolean) => Promise<void> | void;
  onSaveFileContent: (fileId: string, nextContent: string) => Promise<void> | void;
  onRenameEntry: (fileId: string, nextName: string) => Promise<void> | void;
  onUpdatePermissions: (fileId: string, nextPermissions: string) => Promise<void> | void;
  onDeleteEntries: (fileIds: readonly string[]) => Promise<void> | void;
  onUploadFiles?: (directory: string, files: File[]) => Promise<void> | void;
  onDownloadFile?: (entry: CalagopusFileEntry) => Promise<void> | void;
  compact?: boolean;
  confirmDestructive?: boolean;
}

const PAGE_SIZE = 8;

export function ServerFilesPage({
  server,
  files,
  onCreateEntry,
  onSaveFileContent,
  onRenameEntry,
  onUpdatePermissions,
  onDeleteEntries,
  onUploadFiles,
  onDownloadFile,
  compact = false,
  confirmDestructive = true,
}: ServerFilesPageProps) {
  const fileUploadRef = React.useRef<HTMLInputElement | null>(null);
  const [currentDir, setCurrentDir] = React.useState('/');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortKey, setSortKey] = React.useState<FileSortKey>('name');
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('asc');
  const [page, setPage] = React.useState(1);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [createMode, setCreateMode] = React.useState<'file' | 'folder' | null>(null);
  const [createName, setCreateName] = React.useState('');
  const [createError, setCreateError] = React.useState<string | null>(null);

  const [editingFile, setEditingFile] = React.useState<CalagopusFileEntry | null>(null);
  const [editorText, setEditorText] = React.useState('');

  const [renamingEntry, setRenamingEntry] = React.useState<CalagopusFileEntry | null>(null);
  const [renameText, setRenameText] = React.useState('');
  const [renameError, setRenameError] = React.useState<string | null>(null);

  const [chmodEntry, setChmodEntry] = React.useState<CalagopusFileEntry | null>(null);
  const [chmodValue, setChmodValue] = React.useState('');
  const [chmodError, setChmodError] = React.useState<string | null>(null);

  const [deleteTargets, setDeleteTargets] = React.useState<CalagopusFileEntry[]>([]);
  const [sftpModalOpen, setSftpModalOpen] = React.useState(false);

  const dirEntries = React.useMemo(
    () => filterFilesByQuery(files, currentDir, searchQuery),
    [files, currentDir, searchQuery],
  );

  const sortedEntries = React.useMemo(
    () => sortFiles(dirEntries, sortKey, sortDirection),
    [dirEntries, sortKey, sortDirection],
  );

  const { pageItems, safePage } = React.useMemo(
    () => paginateSlice(sortedEntries, page, PAGE_SIZE),
    [sortedEntries, page],
  );

  const breadcrumbs = React.useMemo(
    () => resolveDirectoryBreadcrumbs(currentDir),
    [currentDir],
  );

  const existingNamesInDir = React.useMemo(
    () =>
      files
        .filter((f) => normalizeDirectoryPath(f.directory) === normalizeDirectoryPath(currentDir))
        .map((f) => f.name),
    [files, currentDir],
  );

  const diskUsedBytes = files.reduce((acc, f) => acc + (f.isDirectory ? 0 : f.sizeBytes), 0);
  const trashBytes = 4096;
  const totalLimitBytes = Math.max(1, server.diskLimitMb * 1024 * 1024);
  const diskPct = Math.min(100, ((diskUsedBytes + trashBytes) / totalLimitBytes) * 100);

  const changeDirectory = (nextDir: string) => {
    setCurrentDir(normalizeDirectoryPath(nextDir));
    setSelectedIds([]);
    setPage(1);
  };

  const toggleSort = (key: FileSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const allVisibleSelected =
    pageItems.length > 0 && pageItems.every((item) => selectedIds.includes(item.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const pageSet = new Set(pageItems.map((i) => i.id));
      setSelectedIds((prev) => prev.filter((id) => !pageSet.has(id)));
    } else {
      const next = new Set(selectedIds);
      for (const item of pageItems) next.add(item.id);
      setSelectedIds([...next]);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleOpenEntry = (entry: CalagopusFileEntry) => {
    if (entry.isDirectory) {
      changeDirectory(entry.path);
      return;
    }
    if (entry.content !== undefined || entry.mimeType.startsWith('text/') || entry.mimeType.includes('json') || entry.mimeType.includes('yaml')) {
      setEditingFile(entry);
      setEditorText(entry.content ?? '');
    } else {
      showToast({
        title: 'Binary file',
        message: `${entry.name} (${entry.mimeType}) cannot be edited inline. Use Download instead.`,
        tone: 'info',
      });
    }
  };

  const handleDownloadFile = async (entry: CalagopusFileEntry) => {
    if (onDownloadFile) {
      try {
        await Promise.resolve(onDownloadFile(entry));
      } catch {
        // Error surfaced by caller
      }
      return;
    }
    if (entry.content === undefined) {
      showToast({
        title: 'Live daemon required',
        message: `Binary downloads for ${entry.name} require a connected Calagopus panel node.`,
        tone: 'info',
      });
      return;
    }
    const safeName = sanitizeDownloadFilename(entry.name);
    const blob = new Blob([entry.content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast({ title: 'Download started', message: safeName, tone: 'success' });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateFilename(createName, existingNamesInDir);
    if (err) {
      setCreateError(err);
      return;
    }
    const targetName = createName.trim();
    const isDir = createMode === 'folder';
    try {
      await Promise.resolve(onCreateEntry(currentDir, targetName, isDir));
      showToast({
        title: isDir ? 'Folder created' : 'File created',
        message: `${targetName} in ${currentDir}`,
        tone: 'success',
      });
      setCreateMode(null);
      setCreateName('');
      setCreateError(null);
    } catch {
      // Error surfaced by caller
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingEntry) return;
    const otherNames = existingNamesInDir.filter(
      (n) => n.toLowerCase() !== renamingEntry.name.toLowerCase(),
    );
    const err = validateFilename(renameText, otherNames);
    if (err) {
      setRenameError(err);
      return;
    }
    const nextName = renameText.trim();
    try {
      await Promise.resolve(onRenameEntry(renamingEntry.id, nextName));
      showToast({
        title: 'Renamed successfully',
        message: `${renamingEntry.name} -> ${nextName}`,
        tone: 'success',
      });
      setRenamingEntry(null);
      setRenameError(null);
    } catch {
      // Error surfaced by caller
    }
  };

  const renderSortIcon = (key: FileSortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-55" aria-hidden="true" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-[#8E2E52]" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-[#8E2E52]" aria-hidden="true" />
    );
  };

  return (
    <div className="space-y-5">
      {/* Header Row (Screenshot 1 pattern) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[#29232A]">
            Files
          </h1>
          <p className="mt-1 text-sm text-[#777078]">
            Manage container filesystem entries, edit configuration files, and inspect storage quota.
          </p>
        </div>

        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2 sm:shrink-0">
          <input
            ref={fileUploadRef}
            type="file"
            multiple
            className="hidden"
            aria-label="Upload files to current directory"
            onChange={(e) => {
              const selected = Array.from(e.currentTarget.files ?? []);
              e.currentTarget.value = '';
              if (selected.length > 0) {
                const uploadTask = onUploadFiles
                  ? Promise.resolve(onUploadFiles(currentDir, selected))
                  : Promise.all(selected.map((file) => onCreateEntry(currentDir, file.name, false)));
                void uploadTask
                  .then(() => {
                    showToast({
                      title: 'Files uploaded',
                      message: `${selected.length} file(s) added to ${currentDir}.`,
                      tone: 'success',
                    });
                  })
                  .catch(() => {});
              }
            }}
          />

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Upload className="h-4 w-4" />}
            onClick={() => fileUploadRef.current?.click()}
          >
            Upload
          </Button>

          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plug className="h-4 w-4" />}
            onClick={() => setSftpModalOpen(true)}
          >
            SFTP Connect
          </Button>

          <Button
            variant="danger"
            size="sm"
            disabled={selectedIds.length === 0}
            leftIcon={<Trash2 className="h-4 w-4" />}
            onClick={() => {
              const selected = files.filter((f) => selectedIds.includes(f.id));
              if (confirmDestructive) {
                setDeleteTargets(selected);
              } else {
                const ids = selected.map((t) => t.id);
                void Promise.resolve(onDeleteEntries(ids))
                  .then(() => {
                    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
                    showToast({
                      title: 'Deleted',
                      message:
                        selected.length === 1
                          ? `Removed ${selected[0]?.name}`
                          : `Removed ${selected.length} entries`,
                      tone: 'success',
                    });
                  })
                  .catch(() => {});
              }
            }}
          >
            {selectedIds.length > 0 ? `Delete (${selectedIds.length})` : 'Delete'}
          </Button>

          <DropdownMenu
            label="Create in current path"
            trigger={
              <Button variant="primary" size="sm" leftIcon={<FilePlus className="h-4 w-4" />}>
                New
              </Button>
            }
            items={[
              {
                id: 'new-file',
                label: 'New File',
                icon: <FilePlus className="h-4 w-4 text-[#8E2E52]" />,
                onSelect: () => {
                  setCreateMode('file');
                  setCreateName('');
                  setCreateError(null);
                },
              },
              {
                id: 'new-folder',
                label: 'New Folder',
                icon: <FolderPlus className="h-4 w-4 text-[#8E2E52]" />,
                onSelect: () => {
                  setCreateMode('folder');
                  setCreateName('');
                  setCreateError(null);
                },
              },
            ]}
          />
        </div>
      </div>

      {/* Disk Usage Card (Screenshot 1 pattern) */}
      <Card padding="sm">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className="font-medium text-[#29232A]">Disk Usage</span>
            <span className="font-mono text-[12px] text-[#777078] tabular-nums">
              {formatBytes(diskUsedBytes + trashBytes)} of {formatBytes(totalLimitBytes)} used (
              {diskPct.toFixed(1)}%)
            </span>
          </div>

          <div
            className="h-2 w-full overflow-hidden rounded-full bg-[#FCE7EF]"
            role="progressbar"
            aria-label="Container disk usage"
            aria-valuenow={Math.round(diskPct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[#F4A6C1] blush-transition"
              style={{ width: `${Math.max(2, diskPct)}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[12px] text-[#777078] tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#F4A6C1]" aria-hidden="true" />
              Files <strong className="font-mono font-medium text-[#29232A]">{formatBytes(diskUsedBytes)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#777078]" aria-hidden="true" />
              Trash <strong className="font-mono font-medium text-[#29232A]">{formatBytes(trashBytes)}</strong>
            </span>
          </div>
        </div>
      </Card>

      {/* Path Breadcrumbs + Live Search Strip (Screenshot 1 pattern) */}
      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Directory path" className="flex flex-wrap items-center gap-1 text-[13px]">
            <span className="text-[#777078] font-mono">/home/</span>
            {breadcrumbs.map((crumb, idx) => {
              const isCurrent = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.path}>
                  {idx > 0 ? <span className="text-[#DECED5] font-mono">/</span> : null}
                  {isCurrent ? (
                    <span className="rounded-md bg-[#FCE7EF] px-2 py-0.5 font-mono font-medium text-[#8E2E52]">
                      {crumb.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => changeDirectory(crumb.path)}
                      className="blush-focus-ring rounded-md px-1.5 py-0.5 font-mono text-[#29232A] hover:bg-[#FFF5F8] cursor-pointer"
                    >
                      {crumb.label}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          <div className="w-full sm:w-64">
            <SearchField
              aria-label="Search files in current directory"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(val) => {
                setSearchQuery(val);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      {/* Sortable File Listing Table */}
      {sortedEntries.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No matching files' : 'Directory is empty'}
          description={
            searchQuery
              ? `No files or folders matched "${searchQuery}" in ${currentDir}.`
              : 'Create a new file or folder in this directory.'
          }
          actionLabel={searchQuery ? 'Clear Search' : 'New File'}
          onAction={() => {
            if (searchQuery) {
              setSearchQuery('');
            } else {
              setCreateMode('file');
            }
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="w-full overflow-x-auto rounded-xl border border-[#EEE5E9] bg-white">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <caption className="sr-only">Server Container Files</caption>
                <thead>
                  <tr className="border-b border-[#EEE5E9] bg-[#FFF5F8]">
                    <th scope="col" className={`w-10 ${compact ? 'px-3.5 py-2' : 'px-4 py-3'}`}>
                      <input
                        type="checkbox"
                        aria-label="Select all visible files"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-[#DECED5] accent-[#F4A6C1] cursor-pointer"
                      />
                    </th>
                    <th
                      scope="col"
                      className={`${compact ? 'px-3.5 py-2' : 'px-4 py-3'} text-[12px] font-medium text-[#777078]`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort('name')}
                        className="blush-focus-ring inline-flex items-center gap-1.5 hover:text-[#29232A] cursor-pointer"
                      >
                        <span>Name</span>
                        {renderSortIcon('name')}
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${compact ? 'px-3.5 py-2' : 'px-4 py-3'} text-[12px] font-medium text-[#777078]`}
                    >
                      Mode
                    </th>
                    <th
                      scope="col"
                      className={`${compact ? 'px-3.5 py-2' : 'px-4 py-3'} text-right text-[12px] font-medium text-[#777078]`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort('sizeBytes')}
                        className="blush-focus-ring inline-flex flex-row-reverse items-center gap-1.5 hover:text-[#29232A] cursor-pointer"
                      >
                        <span>Size</span>
                        {renderSortIcon('sizeBytes')}
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${compact ? 'px-3.5 py-2' : 'px-4 py-3'} text-right text-[12px] font-medium text-[#777078]`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort('modifiedEpoch')}
                        className="blush-focus-ring inline-flex flex-row-reverse items-center gap-1.5 hover:text-[#29232A] cursor-pointer"
                      >
                        <span>Modified</span>
                        {renderSortIcon('modifiedEpoch')}
                      </button>
                    </th>
                    <th
                      scope="col"
                      className={`${compact ? 'px-3.5 py-2' : 'px-4 py-3'} text-right text-[12px] font-medium text-[#777078]`}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE5E9]">
                  {pageItems.map((entry) => {
                    const checked = selectedIds.includes(entry.id);
                    const isCode =
                      entry.name.endsWith('.yml') ||
                      entry.name.endsWith('.json') ||
                      entry.name.endsWith('.properties');
                    const cellPad = compact ? 'px-3.5 py-2' : 'px-4 py-3';

                    return (
                      <tr key={entry.id} className="blush-transition hover:bg-[#FFF8FA]">
                        <td className={cellPad}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${entry.name}`}
                            checked={checked}
                            onChange={() => toggleSelectOne(entry.id)}
                            className="h-4 w-4 rounded border-[#DECED5] accent-[#F4A6C1] cursor-pointer"
                          />
                        </td>
                        <td className={cellPad}>
                          <button
                            type="button"
                            onClick={() => handleOpenEntry(entry)}
                            className="blush-focus-ring inline-flex items-center gap-2.5 text-left font-medium text-[#29232A] hover:text-[#8E2E52] cursor-pointer"
                          >
                            {entry.isDirectory ? (
                              <Folder className="h-4 w-4 text-[#E7AD55] shrink-0" aria-hidden="true" />
                            ) : isCode ? (
                              <FileCode2 className="h-4 w-4 text-[#8E2E52] shrink-0" aria-hidden="true" />
                            ) : (
                              <FileText className="h-4 w-4 text-[#777078] shrink-0" aria-hidden="true" />
                            )}
                            <span>{entry.name}</span>
                          </button>
                        </td>
                        <td className={`${cellPad} font-mono text-[12px] text-[#777078]`}>
                          {entry.permissions}
                        </td>
                        <td className={`${cellPad} text-right font-mono text-[13px] text-[#29232A] tabular-nums`}>
                          {formatBytes(entry.sizeBytes)}
                        </td>
                        <td className={`${cellPad} text-right font-mono text-[12px] text-[#777078] tabular-nums`}>
                          {entry.modifiedAt}
                        </td>
                        <td className={`${cellPad} text-right`}>
                        <DropdownMenu
                          trigger={
                            <button
                              type="button"
                              aria-label={`Actions for ${entry.name}`}
                              className="blush-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-[#777078] hover:border-[#EEE5E9] hover:bg-white hover:text-[#29232A] cursor-pointer"
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                            </button>
                          }
                          items={[
                            ...(!entry.isDirectory
                              ? [
                                  {
                                    id: 'edit',
                                    label: 'Edit Content',
                                    icon: <FileCode2 className="h-4 w-4 text-[#8E2E52]" />,
                                    onSelect: () => handleOpenEntry(entry),
                                  },
                                  {
                                    id: 'download',
                                    label: 'Download',
                                    icon: <Download className="h-4 w-4 text-[#777078]" />,
                                    onSelect: () => handleDownloadFile(entry),
                                  },
                                ]
                              : []),
                            {
                              id: 'rename',
                              label: 'Rename',
                              icon: <Pencil className="h-4 w-4 text-[#777078]" />,
                              onSelect: () => {
                                setRenamingEntry(entry);
                                setRenameText(entry.name);
                                setRenameError(null);
                              },
                            },
                            {
                              id: 'permissions',
                              label: 'Permissions',
                              icon: <Shield className="h-4 w-4 text-[#777078]" />,
                              onSelect: () => {
                                setChmodEntry(entry);
                                setChmodValue(entry.permissions);
                                setChmodError(null);
                              },
                            },
                            {
                              id: 'delete',
                              label: 'Delete',
                              icon: <Trash2 className="h-4 w-4 text-[#942B38]" />,
                              danger: true,
                              onSelect: () => {
                                if (confirmDestructive) {
                                  setDeleteTargets([entry]);
                                } else {
                                  void Promise.resolve(onDeleteEntries([entry.id]))
                                    .then(() => {
                                      setSelectedIds((prev) => prev.filter((id) => id !== entry.id));
                                      showToast({
                                        title: 'Deleted',
                                        message: `Removed ${entry.name}`,
                                        tone: 'success',
                                      });
                                    })
                                    .catch(() => {});
                                }
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={safePage}
            totalItems={sortedEntries.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* New File / Folder Modal */}
      <ModalDialog
        opened={createMode !== null}
        onClose={() => setCreateMode(null)}
        title={createMode === 'folder' ? 'Create New Folder' : 'Create New File'}
        description={`Target path: ${currentDir}`}
        size="sm"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <TextInput
            label={createMode === 'folder' ? 'Folder Name' : 'File Name'}
            placeholder={createMode === 'folder' ? 'e.g. backups-local' : 'e.g. motd.txt'}
            required
            value={createName}
            error={createError ?? undefined}
            onChange={(e) => {
              setCreateName(e.currentTarget.value);
              setCreateError(null);
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setCreateMode(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Create
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Inline File Content Editor Modal */}
      <ModalDialog
        opened={editingFile !== null}
        onClose={() => setEditingFile(null)}
        title={editingFile ? `Editing ${editingFile.name}` : 'File Editor'}
        description={editingFile?.path}
        size="lg"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editingFile) return;
            const targetFile = editingFile;
            try {
              await Promise.resolve(onSaveFileContent(targetFile.id, editorText));
              showToast({
                title: 'File saved',
                message: `${targetFile.path} updated.`,
                tone: 'success',
              });
              setEditingFile(null);
            } catch {
              // Error surfaced by caller
            }
          }}
          className="space-y-4"
        >
          <Textarea
            label="File Contents"
            rows={12}
            monospace
            value={editorText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setEditorText(e.currentTarget.value)
            }
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setEditingFile(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save File
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Rename Entry Modal */}
      <ModalDialog
        opened={renamingEntry !== null}
        onClose={() => setRenamingEntry(null)}
        title="Rename Entry"
        description={renamingEntry?.path}
        size="sm"
      >
        <form onSubmit={handleRenameSubmit} className="space-y-4">
          <TextInput
            label="New Name"
            required
            value={renameText}
            error={renameError ?? undefined}
            onChange={(e) => {
              setRenameText(e.currentTarget.value);
              setRenameError(null);
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setRenamingEntry(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Rename
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Permissions Modal */}
      <ModalDialog
        opened={chmodEntry !== null}
        onClose={() => {
          setChmodEntry(null);
          setChmodError(null);
        }}
        title="Update File Mode"
        description={chmodEntry?.path}
        size="sm"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!chmodEntry) return;
            const err = validateFileMode(chmodValue);
            if (err) {
              setChmodError(err);
              return;
            }
            const nextPerm = chmodValue.trim();
            const target = chmodEntry;
            try {
              await Promise.resolve(onUpdatePermissions(target.id, nextPerm));
              showToast({
                title: 'Permissions updated',
                message: `${target.name} mode set to ${nextPerm}`,
                tone: 'success',
              });
              setChmodEntry(null);
              setChmodError(null);
            } catch {
              // Error surfaced by caller
            }
          }}
          className="space-y-4"
        >
          <TextInput
            label="POSIX Permission String"
            required
            value={chmodValue}
            error={chmodError ?? undefined}
            onChange={(e) => {
              setChmodValue(e.currentTarget.value);
              setChmodError(null);
            }}
            description="Example: -rw-r--r-- or 644"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setChmodEntry(null);
                setChmodError(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Apply Mode
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* SFTP Connection Modal */}
      <ModalDialog
        opened={sftpModalOpen}
        onClose={() => setSftpModalOpen(false)}
        title="SFTP Connection Details"
        description="Connect using FileZilla, WinSCP, or any standard SFTP client."
        size="sm"
      >
        <div className="space-y-3 text-[13px]">
          <div className="rounded-lg border border-[#EEE5E9] bg-[#FCFAFB] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#777078]">Server Address</span>
              <span className="font-mono text-[#29232A]">{`sftp://${server.sftpHost}:${server.sftpPort}`}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#777078]">Username</span>
              <span className="font-mono text-[#29232A]">{server.sftpUsername}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              leftIcon={<Copy className="h-3.5 w-3.5" />}
              onClick={() => {
                void navigator.clipboard?.writeText(`sftp://${server.sftpHost}:${server.sftpPort}`);
                showToast({ title: 'SFTP address copied', tone: 'success' });
              }}
            >
              Copy Address
            </Button>
            <Button variant="primary" onClick={() => setSftpModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </ModalDialog>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        opened={deleteTargets.length > 0}
        onClose={() => setDeleteTargets([])}
        onConfirm={() => {
          const targets = deleteTargets;
          setDeleteTargets([]);
          if (targets.length === 0) return;
          const ids = targets.map((t) => t.id);
          void Promise.resolve(onDeleteEntries(ids))
            .then(() => {
              setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
              showToast({
                title: 'Deleted',
                message:
                  targets.length === 1
                    ? `Removed ${targets[0]?.name}`
                    : `Removed ${targets.length} entries`,
                tone: 'success',
              });
            })
            .catch(() => {});
        }}
        title={deleteTargets.length > 1 ? 'Delete Selected Files' : 'Delete Entry'}
        message={
          deleteTargets.length > 1
            ? `Permanently delete ${deleteTargets.length} selected items from ${currentDir}?`
            : `Permanently delete "${deleteTargets[0]?.name}" from ${currentDir}?`
        }
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
