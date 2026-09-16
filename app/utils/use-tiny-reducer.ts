/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Draft } from 'immer';
import { produce } from 'immer';
import type { Dispatch } from 'react';
import { useMemo, useReducer } from 'react';

export type ActionCreator<P> = P extends void
  ? () => PayloadAction<void>
  : P extends boolean
  ? (payload: boolean) => PayloadAction<boolean>
  : (payload: P) => PayloadAction<P>;
export interface PayloadAction<P = any, T extends string = string> extends Action<T> {
  payload: P;
}
export type Action<T extends string = string> = {
  type: T;
};
export interface AnyAction extends Action {
  [extraProps: string]: any;
}
export type Actions<T extends keyof any = string> = Record<T, Action>;
export type Reducer<S = any, A extends Action = AnyAction, PreloadedState = S> = (
  state: S | PreloadedState | undefined,
  action: A,
) => S;
export type CaseReducer<S = any, A extends Action = AnyAction> = (state: Draft<S>, action: A) => S | void;
export type CaseReducers<S, AS extends Actions> = {
  [T in keyof AS]: AS[T] extends Action ? CaseReducer<S, AS[T]> : void;
};
export interface TinyReducer<S = any, AP extends { [key: string]: any } = { [key: string]: any }> {
  reducer: Reducer<S>;
  actions: { [type in keyof AP]: ActionCreator<AP[type]> };
  initialState: S;
}
export interface UseTinyReducer<S = any, AP extends { [key: string]: any } = { [key: string]: any }> {
  actions: { [type in keyof AP]: ActionCreator<AP[type]> };
  state: S;
  dispatch: Dispatch<AnyAction>;
}
type CaseReducerActionPayloads<CR extends CaseReducers<any, any>> = {
  [T in keyof CR]: CR[T] extends (state: any) => any
    ? void
    : CR[T] extends (state: any, action: PayloadAction<infer P>) => any
    ? P
    : void;
};

export interface CreateReducerOptions<S, CR extends CaseReducers<S, any> = CaseReducers<S, any>> {
  initialState: S;
  reducers: CR;
}

const createAction =
  <P = any, T extends string = string>(type: T) =>
  (payload?: P) => ({ type, payload });

export const createTinyReducer = <S, CR extends CaseReducers<S, any>>({
  reducers,
  initialState,
}: CreateReducerOptions<S, CR>): TinyReducer<S, CaseReducerActionPayloads<CR>> => {
  const actionKeys = Object.keys(reducers);

  const reducerMap = actionKeys.reduce((map, actionKey) => {
    map[actionKey] = reducers[actionKey];
    return map;
  }, {} as any);

  const actionMap = actionKeys.reduce((map, actionKey) => {
    map[actionKey] = createAction(actionKey);
    return map;
  }, {} as any);

  const reducer = produce((draft = initialState, action: { type: string; payload: any }) => {
    reducerMap[action.type](draft, action);
  }) as any;

  return { actions: actionMap, reducer, initialState };
};

export const useTinyReducer = <S, CR extends CaseReducers<S, any>>({
  actions,
  reducer,
  initialState,
}: TinyReducer<S, CaseReducerActionPayloads<CR>>): UseTinyReducer<S, CaseReducerActionPayloads<CR>> => {
  const [state, dispatch] = useReducer(reducer, initialState as any);
  const dispatchActions = useMemo(() => {
    const actionKeys = Object.keys(actions);
    return actionKeys.reduce((map, actionKey) => {
      map[actionKey] = (payload: any) => dispatch(actions[actionKey](payload));
      return map;
    }, {} as any);
  }, [actions]);
  return { state, actions: dispatchActions, dispatch };
};
