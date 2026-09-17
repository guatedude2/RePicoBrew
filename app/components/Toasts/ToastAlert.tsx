import type { FC } from 'react';
import { useState } from 'react';
import { MdArrowForward, MdCheckCircle, MdClose, MdError, MdInfo, MdWarning } from 'react-icons/md';
import { cn } from '~/lib/utils';
import { useTimer } from '~/utils/use-timer';

export type AlertStatus = 'success' | 'error' | 'warning' | 'info';

export interface ToastAlertProps {
  type: AlertStatus;
  title?: string;
  message: string;
  duration?: number;
  onClick?: () => void;
  onClose: () => void;
}

const STATUS_STYLES: Record<AlertStatus, { border: string; icon: string; Icon: typeof MdInfo }> = {
  success: { border: 'border-l-success-500', icon: 'text-success-500', Icon: MdCheckCircle },
  error: { border: 'border-l-danger-500', icon: 'text-danger-500', Icon: MdError },
  warning: { border: 'border-l-orange-500', icon: 'text-orange-500', Icon: MdWarning },
  info: { border: 'border-l-info-500', icon: 'text-info-500', Icon: MdInfo },
};

export const ToastAlert: FC<ToastAlertProps> = ({ type, title, message, duration = 5000, onClick, onClose }) => {
  const [hide, setHide] = useState(false);

  const close = () => setHide(true);
  const closeAndClick = () => {
    if (onClick) {
      onClick();
    }
    close();
  };
  useTimer({ delay: duration, autoStart: true, onTimerDone: close });

  const isInteractive = typeof onClick === 'function';
  const { border, icon, Icon } = STATUS_STYLES[type];

  return (
    <div
      onAnimationEnd={hide ? onClose : undefined}
      className={cn(
        'flex w-[350px] items-start gap-3 rounded-md border-l-4 bg-ink-card px-4 py-3 text-ink-text shadow-[0_12px_30px_-8px_rgba(0,0,0,0.6)]',
        border,
        hide ? 'animate-[hideToast_200ms_forwards]' : 'animate-[showToast_200ms_forwards]',
      )}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', icon)} />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-sm font-bold">{title}</p> : null}
        <p className="text-[13px] text-ink-text-secondary">{message}</p>
      </div>
      <button
        type="button"
        aria-label={isInteractive ? 'Open and dismiss' : 'Dismiss'}
        onClick={isInteractive ? closeAndClick : close}
        className="mt-0.5 shrink-0 text-ink-text-faint transition-colors hover:text-ink-text"
      >
        {isInteractive ? <MdArrowForward className="size-4" /> : <MdClose className="size-4" />}
      </button>
    </div>
  );
};
