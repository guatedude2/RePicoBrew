import type { AlertStatus } from '@chakra-ui/react';
import { Flex, Portal } from '@chakra-ui/react';
import { createContext, useEffect } from 'react';
import type { Dispatch, FC, PropsWithChildren } from 'react';
import type { AnyAction, PayloadAction } from '~/utils/use-tiny-reducer';
import { createTinyReducer, useTinyReducer } from '~/utils/use-tiny-reducer';
import { ToastAlert } from './ToastAlert';

export interface Toast {
  key: string;
  type: AlertStatus;
  title?: string;
  message: string;
  duration: number;
  callback?: () => void;
}

type ToastCreator = {
  type?: AlertStatus;
  title?: string;
  message: string;
  duration?: number;
  callback?: (key: string) => void;
};

export interface ToastSliceState {
  toasts: Toast[];
  nextId: number;
}

export const initialState: ToastSliceState = {
  toasts: [],
  nextId: 1,
};

const tinyReducer = createTinyReducer({
  initialState,
  reducers: {
    createToast(state, { payload }: PayloadAction<ToastCreator>) {
      const key = `toast-${state.nextId}`;
      const callback = payload.callback
        ? () => {
            if (!payload.callback) {
              return;
            }
            payload.callback(key);
          }
        : undefined;

      state.toasts.unshift({
        key,
        type: payload.type ?? 'info',
        title: payload.title,
        message: payload.message,
        duration: payload.duration ?? 3000,
        callback,
      });
      state.nextId += 1;
    },
    dismissToast(state, { payload }: PayloadAction<string>) {
      state.toasts = state.toasts.filter(({ key }) => key !== payload);
    },
  },
});

let instanceDispatch: Dispatch<AnyAction>;

export const Context = createContext<ToastSliceState>({} as ToastSliceState);

const ToastConsumer: FC = () => {
  const { state, actions, dispatch } = useTinyReducer(tinyReducer);

  useEffect(() => {
    instanceDispatch = dispatch;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Portal>
      {state.toasts.length > 0 ? (
        <Flex
          direction="column"
          gap={2}
          justifyContent="flex-end"
          sx={{
            position: 'fixed',
            top: 2,
            right: 2,
            zIndex: 300,
            transition: '100ms max-height',
            maxHeight: 'max-content',
          }}
        >
          {state.toasts.map(({ key, type, title, message, duration, callback }) => (
            <ToastAlert
              key={key}
              type={type}
              title={title}
              message={message}
              duration={duration}
              onClick={callback}
              onClose={() => actions.dismissToast(key)}
            />
          ))}
        </Flex>
      ) : null}
    </Portal>
  );
};

export const createToast = ({ type = 'info', title, message, duration, callback }: ToastCreator) =>
  instanceDispatch(tinyReducer.actions.createToast({ type, title, message, duration, callback }));

export const ToastProvider: FC<PropsWithChildren> = ({ children }) => (
  <Context.Provider value={initialState}>
    {children}
    <ToastConsumer />
  </Context.Provider>
);
