import React from 'react';
import {
  ArrowDownToLine,
  Clock,
  Download,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCw,
  Send,
  Square,
  Trash2,
  WrapText,
} from 'lucide-react';
import {
  filterConsoleLines,
  formatBytesPerSecond,
  formatUptime,
  type CalagopusConsoleLine,
  type CalagopusServerDetail,
  type ServerPowerAction,
} from '../api/calagopusCore';
import { formatMegabytes, formatPercent } from '../api/calagopusDashboard';
import { Button } from '../components/Button';
import { SearchField, SelectDropdown } from '../components/FormControls';
import { MiniSparkline } from '../components/MiniChart';
import { ConfirmDialog, showToast, Tooltip } from '../components/Overlays';
import { Card, StatusBadge } from '../components/Surface';
import { getInitials } from '../utils/themeHelpers';

export interface ServerConsolePageProps {
  server: CalagopusServerDetail;
  logs: readonly CalagopusConsoleLine[];
  onSendCommand: (command: string) => void;
  onClearLogs: () => void;
  onPowerAction: (action: ServerPowerAction) => void;
  defaultAutoScroll?: boolean;
  confirmDestructive?: boolean;
}

const QUICK_COMMANDS = ['list', 'tps', 'save-all', 'say Scheduled check complete'];

export function ServerConsolePage({
  server,
  logs,
  onSendCommand,
  onClearLogs,
  onPowerAction,
  defaultAutoScroll = true,
  confirmDestructive = true,
}: ServerConsolePageProps) {
  const [commandInput, setCommandInput] = React.useState('');
  const [commandHistory, setCommandHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState<number>(-1);

  const [logSearch, setLogSearch] = React.useState('');
  const [levelFilter, setLevelFilter] = React.useState<'ALL' | CalagopusConsoleLine['level']>('ALL');
  const [showTimestamps, setShowTimestamps] = React.useState(true);
  const [wordWrap, setWordWrap] = React.useState(true);
  const [autoScroll, setAutoScroll] = React.useState(defaultAutoScroll);
  const [fontSizePx, setFontSizePx] = React.useState(12);
  const [confirmStopOpen, setConfirmStopOpen] = React.useState(false);

  React.useEffect(() => {
    setAutoScroll(defaultAutoScroll);
  }, [defaultAutoScroll]);

  const logViewportRef = React.useRef<HTMLDivElement | null>(null);

  const filteredLogs = React.useMemo(() => {
    const textMatched = filterConsoleLines(logs, logSearch);
    return levelFilter === 'ALL'
      ? textMatched
      : textMatched.filter((line) => line.level === levelFilter);
  }, [logs, logSearch, levelFilter]);

  React.useEffect(() => {
    if (!autoScroll) return;
    const el = logViewportRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [filteredLogs.length, autoScroll]);

  const isRunning = server.state === 'running' || server.state === 'starting';

  const submitCommand = (rawCommand: string) => {
    const cmd = rawCommand.trim();
    if (!cmd) return;
    onSendCommand(cmd);
    setCommandHistory((prev) => [cmd, ...prev.slice(0, 29)]);
    setHistoryIndex(-1);
    setCommandInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' && commandHistory.length > 0) {
      e.preventDefault();
      const nextIdx = Math.min(commandHistory.length - 1, historyIndex + 1);
      setHistoryIndex(nextIdx);
      setCommandInput(commandHistory[nextIdx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex <= 0) {
        setHistoryIndex(-1);
        setCommandInput('');
      } else {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCommandInput(commandHistory[nextIdx] ?? '');
      }
    }
  };

  const handleDownloadLogs = () => {
    const content = logs
      .map((line) => `[${line.timestamp} ${line.level}] [${line.source}]: ${line.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${server.uuidShort}-console.log`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({
      title: 'Console log downloaded',
      message: `${logs.length} lines saved to ${server.uuidShort}-console.log`,
      tone: 'success',
    });
  };

  return (
    <div className="space-y-5">
      <Card padding="sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <span
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#F7BDD2] bg-[#FCE7EF] font-display text-sm font-bold text-[#8E2E52] shrink-0"
              aria-hidden="true"
            >
              {getInitials(server.name)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-semibold text-[#29232A] truncate">
                  {server.name}
                </h1>
                <StatusBadge
                  tone={
                    server.state === 'running'
                      ? 'success'
                      : server.state === 'stopping'
                        ? 'warning'
                        : 'neutral'
                  }
                  label={server.state.charAt(0).toUpperCase() + server.state.slice(1)}
                />
                {server.uptimeSeconds > 0 ? (
                  <span className="font-mono text-[12px] text-[#777078] tabular-nums">
                    Up {formatUptime(server.uptimeSeconds)}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 font-mono text-[12px] text-[#777078] tabular-nums">
                {server.node} · {server.allocation} · {server.eggName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant={isRunning ? 'secondary' : 'primary'}
              size="sm"
              disabled={isRunning}
              leftIcon={<Play className="h-3.5 w-3.5" />}
              onClick={() => onPowerAction('start')}
            >
              Start
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCw className="h-3.5 w-3.5" />}
              onClick={() => onPowerAction('restart')}
            >
              Restart
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={!isRunning}
              leftIcon={<Square className="h-3.5 w-3.5" />}
              onClick={() => {
                if (confirmDestructive) {
                  setConfirmStopOpen(true);
                } else {
                  onPowerAction('stop');
                }
              }}
            >
              Stop
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#EEE5E9] bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#777078]">Memory</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold text-[#29232A] tabular-nums">
              {formatMegabytes(server.memoryUsedMb)}
            </p>
          </div>
          <MiniSparkline values={server.telemetryHistory.map((p) => p.memoryMb)} />
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#EEE5E9] bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#777078]">Disk</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold text-[#29232A] tabular-nums">
              {formatMegabytes(server.diskUsedMb)}
            </p>
          </div>
          <MiniSparkline values={[server.diskUsedMb * 0.96, server.diskUsedMb * 0.98, server.diskUsedMb]} />
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#EEE5E9] bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#777078]">Net in</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold text-[#29232A] tabular-nums">
              {formatBytesPerSecond(server.netInBytesSec)}
            </p>
          </div>
          <MiniSparkline values={server.telemetryHistory.map((p) => p.netInKb)} />
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#EEE5E9] bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#777078]">Net out</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold text-[#29232A] tabular-nums">
              {formatBytesPerSecond(server.netOutBytesSec)}
            </p>
          </div>
          <MiniSparkline values={server.telemetryHistory.map((p) => p.netOutKb)} />
        </div>

        <div className="col-span-2 sm:col-span-1 flex items-center justify-between gap-2 rounded-xl border border-[#EEE5E9] bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#777078]">CPU</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold text-[#29232A] tabular-nums">
              {formatPercent(server.cpuPercent)}
            </p>
          </div>
          <MiniSparkline values={server.telemetryHistory.map((p) => p.cpu)} color="#8E2E52" />
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-[#EEE5E9] bg-white shadow-[0_1px_2px_rgba(41,35,42,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#EEE5E9] bg-[#FCFAFB] px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2.5 text-[12px] text-[#777078]">
            <span
              className={`h-2 w-2 rounded-full ${isRunning ? 'bg-[#65A879]' : 'bg-[#777078]'}`}
              aria-hidden="true"
            />
            <span className="font-medium text-[#29232A]">
              {isRunning ? 'Socket Connected' : 'Instance Offline'}
            </span>
            {isRunning && server.latencyMs > 0 ? (
              <span className="font-mono tabular-nums">({server.latencyMs}ms ping)</span>
            ) : null}
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {filteredLogs.length} / {logs.length} lines
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-48">
              <SearchField
                aria-label="Filter console output"
                placeholder="Search console logs..."
                value={logSearch}
                onChange={setLogSearch}
              />
            </div>

            <div className="w-full sm:w-32">
              <SelectDropdown
                aria-label="Filter by log level"
                value={levelFilter}
                onChange={(val) =>
                  setLevelFilter((val as 'ALL' | CalagopusConsoleLine['level']) ?? 'ALL')
                }
                data={[
                  { value: 'ALL', label: 'All levels' },
                  { value: 'INFO', label: 'INFO' },
                  { value: 'WARN', label: 'WARN' },
                  { value: 'ERROR', label: 'ERROR' },
                  { value: 'CMD', label: 'CMD' },
                ]}
              />
            </div>

            <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-[#EEE5E9] bg-white p-0.5">
              <Tooltip label={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}>
                <button
                  type="button"
                  aria-label={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
                  aria-pressed={autoScroll}
                  onClick={() => setAutoScroll((p) => !p)}
                  className={`blush-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md cursor-pointer ${
                    autoScroll ? 'bg-[#FCE7EF] text-[#8E2E52]' : 'text-[#777078] hover:text-[#29232A]'
                  }`}
                >
                  {autoScroll ? (
                    <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </Tooltip>

              <Tooltip label="Toggle timestamps">
                <button
                  type="button"
                  aria-label="Toggle timestamps"
                  aria-pressed={showTimestamps}
                  onClick={() => setShowTimestamps((p) => !p)}
                  className={`blush-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md cursor-pointer ${
                    showTimestamps ? 'bg-[#FCE7EF] text-[#8E2E52]' : 'text-[#777078] hover:text-[#29232A]'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </Tooltip>

              <Tooltip label="Toggle line wrap">
                <button
                  type="button"
                  aria-label="Toggle line wrap"
                  aria-pressed={wordWrap}
                  onClick={() => setWordWrap((p) => !p)}
                  className={`blush-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md cursor-pointer ${
                    wordWrap ? 'bg-[#FCE7EF] text-[#8E2E52]' : 'text-[#777078] hover:text-[#29232A]'
                  }`}
                >
                  <WrapText className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </Tooltip>

              <Tooltip label="Decrease font size">
                <button
                  type="button"
                  aria-label="Decrease console font size"
                  onClick={() => setFontSizePx((s) => Math.max(11, s - 1))}
                  className="blush-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md text-[#777078] hover:bg-[#FFF5F8] hover:text-[#29232A] cursor-pointer"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </Tooltip>

              <span className="px-1 font-mono text-[11px] text-[#777078] tabular-nums select-none">
                {fontSizePx}px
              </span>

              <Tooltip label="Increase font size">
                <button
                  type="button"
                  aria-label="Increase console font size"
                  onClick={() => setFontSizePx((s) => Math.min(16, s + 1))}
                  className="blush-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md text-[#777078] hover:bg-[#FFF5F8] hover:text-[#29232A] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </Tooltip>

              <Tooltip label="Download console log">
                <button
                  type="button"
                  aria-label="Download console log"
                  onClick={handleDownloadLogs}
                  className="blush-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md text-[#777078] hover:bg-[#FFF5F8] hover:text-[#29232A] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </Tooltip>

              <Tooltip label="Clear console view">
                <button
                  type="button"
                  aria-label="Clear console view"
                  onClick={onClearLogs}
                  className="blush-focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md text-[#777078] hover:bg-[#FDF1F2] hover:text-[#942B38] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        <div
          ref={logViewportRef}
          role="log"
          aria-live="polite"
          aria-label="Server console stream"
          style={{ fontSize: `${fontSizePx}px` }}
          className={`h-[340px] sm:h-[380px] overflow-y-auto bg-[#29232A] px-4 py-3 font-mono leading-relaxed text-[#FFF8FA] ${
            wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre overflow-x-auto'
          }`}
        >
          {filteredLogs.length === 0 ? (
            <p className="text-[#C8B9C0]">
              {logSearch || levelFilter !== 'ALL'
                ? 'No console lines matched the active log filter.'
                : 'Console buffer is empty. Start the server or enter a command below.'}
            </p>
          ) : (
            filteredLogs.map((line) => {
              const levelColor =
                line.level === 'WARN'
                  ? 'text-[#F5C57A]'
                  : line.level === 'ERROR'
                    ? 'text-[#F396A1]'
                    : line.level === 'CMD'
                      ? 'text-[#F7BDD2]'
                      : 'text-[#A6D8B4]';

              return (
                <div key={line.id} className="py-0.5">
                  {showTimestamps ? (
                    <span className="text-[#C8B9C0] mr-2">[{line.timestamp}]</span>
                  ) : null}
                  <span className={`${levelColor} font-medium mr-2`}>[{line.level}]</span>
                  <span className="text-[#E6D8DF] mr-2">[{line.source}]:</span>
                  <span>{line.message}</span>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-[#EEE5E9] bg-[#FCFAFB] px-4 py-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-[#777078] mr-1">Quick command:</span>
            {QUICK_COMMANDS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => submitCommand(preset)}
                className="blush-transition blush-focus-ring rounded-md border border-[#EEE5E9] bg-white px-2.5 py-1 font-mono text-[11px] text-[#29232A] hover:border-[#F7BDD2] hover:bg-[#FFF5F8] hover:text-[#8E2E52] cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitCommand(commandInput);
            }}
            className="flex items-center gap-2"
          >
            <label htmlFor="calagopus-console-input" className="sr-only">
              Send server console command
            </label>
            <div className="relative min-w-0 flex-1">
              <span
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-semibold text-[#8E2E52]"
                aria-hidden="true"
              >
                &gt;
              </span>
              <input
                id="calagopus-console-input"
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isRunning
                    ? 'Type a command... (ArrowUp/Down for history)'
                    : 'Server is offline — start container to execute commands'
                }
                className="blush-focus-ring h-10 w-full rounded-lg border border-[#EEE5E9] bg-white pl-8 pr-3 font-mono text-[13px] text-[#29232A] placeholder:text-[#777078]"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!commandInput.trim()}
              leftIcon={<Send className="h-3.5 w-3.5" />}
            >
              Send
            </Button>
          </form>
        </div>
      </section>

      <ConfirmDialog
        opened={confirmStopOpen}
        onClose={() => setConfirmStopOpen(false)}
        onConfirm={() => {
          onPowerAction('stop');
          setConfirmStopOpen(false);
        }}
        title="Stop Server Gracefully"
        message={`Send stop signal to ${server.name}? Connected clients will be disconnected cleanly.`}
        confirmLabel="Stop Server"
        destructive
      />
    </div>
  );
}
