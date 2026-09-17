import type { ActionArgs } from '@remix-run/node';
import { action as iSpindelAction } from './api.ispindel';

/**
 * POST /API/iSpindle
 *
 * Real iSpindel firmware historically ships with this typo'd path alongside the correct
 * /API/iSpindel — bind both to the same handler.
 */
export const action = (args: ActionArgs) => iSpindelAction(args);
