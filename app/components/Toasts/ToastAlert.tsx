import { ArrowRightIcon } from '@chakra-ui/icons';
import type { AlertStatus } from '@chakra-ui/react';
import { Alert, AlertDescription, AlertIcon, AlertTitle, Box, CloseButton } from '@chakra-ui/react';
import type { FC } from 'react';
import { useState } from 'react';
import { useTimer } from '~/utils/use-timer';

export interface ToastAlertProps {
  type: AlertStatus;
  title?: string;
  message: string;
  duration?: number;
  onClick?: () => void;
  onClose: () => void;
}

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

  return (
    <Alert
      status={type}
      width="350px"
      variant="left-accent"
      onAnimationEnd={hide ? onClose : undefined}
      sx={{
        '@keyframes showToast': {
          from: {
            transform: 'translateX(50%)',
            opacity: 0.25,
          },
          to: {
            transform: 'translateX(0%)',
            opacity: 1,
          },
        },
        '@keyframes hideToast': {
          to: { opacity: 0 },
        },
        animation: `200ms ${hide ? 'hideToast' : 'showToast'} forwards`,
      }}
    >
      <AlertIcon />
      <Box width="100%">
        {title ? <AlertTitle>{title}</AlertTitle> : null}
        <AlertDescription>{message}</AlertDescription>
      </Box>
      {isInteractive ? (
        <CloseButton alignSelf="center" position="relative" right={-1} top={-1} onClick={closeAndClick}>
          <ArrowRightIcon />
        </CloseButton>
      ) : (
        <CloseButton alignSelf="center" position="relative" right={-1} top={-1} onClick={close} />
      )}
    </Alert>
  );
};
