// Decodes the numeric error codes a Pico/Pico C reports to /API/pico/error (see api.pico.error.ts).
// The firmware only ever sends the bare number; PicoBrew's own troubleshooting guides are the
// source of truth for what each one means. Only add a code here once its meaning is confirmed —
// a wrong guess is worse than the generic fallback below.

export type PicoErrorCodeInfo = {
  summary: string;
  cause: string;
  action: string;
};

export const PICO_ERROR_CODES: Record<number, PicoErrorCodeInfo> = {
  20: {
    summary: 'Reservoir empty / shuttle pump issue',
    cause:
      'The machine ran out of water in the reservoir (or the shuttle pump otherwise lost prime) partway through the step.',
    action:
      'Refill the reservoir and check the shuttle pump and tubing for airlocks or blockages before restarting the brew.',
  },
};

export function describePicoErrorCode(code: number): PicoErrorCodeInfo {
  return (
    PICO_ERROR_CODES[code] ?? {
      summary: `Unrecognized error code ${code}`,
      cause: 'This code is not yet documented in RePicoBrew.',
      action: 'Check the official PicoBrew troubleshooting guide for this code.',
    }
  );
}
