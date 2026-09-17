import type { LoaderFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { MdScience, MdHistory } from 'react-icons/md';
import { Card } from '~/components/ui/card';
import { SessionRepository } from '~/repositories/session.server';
import { SessionState } from '~/types';
import { serializeDates } from '~/utils/serialize.server';

export async function loader(_args: LoaderFunctionArgs) {
  const sessions = await SessionRepository.listSessions({ limit: 100 });
  const fermentationSessions = sessions.filter((s) => s.type === 3 && s.state === SessionState.COMPLETED);

  return serializeDates({ sessions: fermentationSessions });
}

const columns = '1.4fr 1.4fr 1.4fr 1fr 1fr 1fr';

const formatDuration = (startTime: string, endTime: string): string => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const diff = end - start;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h`;
};

export default function FermentationHistoryRoute() {
  const { sessions } = useLoaderData<typeof loader>();

  return (
    <>
      <div>
        <p className="text-[26px] font-bold tracking-[-0.3px]">Fermentation History</p>
        <p className="mt-1 text-sm text-ink-text-dim">Review past fermentation sessions</p>
      </div>

      <Card className="overflow-hidden p-0">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-3.5 py-12">
            <MdScience className="size-10 text-ink-text-faint" />
            <p className="text-ink-text-faint">No completed fermentation sessions yet</p>
          </div>
        ) : (
          <>
            <div
              className="grid border-b border-ink-divider px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.5px] text-ink-text-faint"
              style={{ gridTemplateColumns: columns }}
            >
              <span>Device</span>
              <span>Started</span>
              <span>Completed</span>
              <span>Duration</span>
              <span>Readings</span>
              <span>Status</span>
            </div>
            {sessions.map((session) => (
              <div
                key={session.id}
                className="grid items-center border-b border-ink-divider px-5 py-4"
                style={{ gridTemplateColumns: columns }}
              >
                <Link to={`/sessions/${session.id}`}>
                  <div className="flex items-center gap-2">
                    <MdHistory className="size-3.5 text-brand-500" />
                    <p className="text-[13px] font-bold">{session.device.name}</p>
                    {session.device.color && <p className="text-xs text-ink-text-faint">{session.device.color}</p>}
                  </div>
                </Link>
                <p className="text-[13px] text-ink-text-secondary">{new Date(session.createdAt).toLocaleString()}</p>
                <p className="text-[13px] text-ink-text-secondary">{new Date(session.updatedAt).toLocaleString()}</p>
                <p className="text-[13px] text-ink-text-secondary">
                  {formatDuration(session.createdAt, session.updatedAt)}
                </p>
                <p className="text-xs text-ink-text-faint">{session._count.logs} points</p>
                <p className="text-[11px] font-bold text-success-500">{session.statusText}</p>
              </div>
            ))}
          </>
        )}
      </Card>
    </>
  );
}
