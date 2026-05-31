/**
 * Bridge errors are wire-stable: the `code` field is part of the contract.
 * Consumers can switch on `code` to decide retry vs. surface-to-user vs. fail.
 *
 * Codes:
 *  - `BRIDGE_TIMEOUT`        — peer did not respond within the configured timeout
 *  - `BRIDGE_VALIDATION`     — payload failed Zod validation (input or output)
 *  - `BRIDGE_NO_HANDLER`     — peer has no handler registered for the method
 *  - `BRIDGE_HANDLER_THREW`  — handler threw; original message in `.message`
 *  - `BRIDGE_DISPOSED`       — bridge was disposed before the response arrived
 *  - `BRIDGE_ORIGIN`         — message arrived from a non-allow-listed origin
 */
export type BridgeErrorCode =
  | "BRIDGE_TIMEOUT"
  | "BRIDGE_VALIDATION"
  | "BRIDGE_NO_HANDLER"
  | "BRIDGE_HANDLER_THREW"
  | "BRIDGE_DISPOSED"
  | "BRIDGE_ORIGIN";

export class BridgeError extends Error {
  readonly code: BridgeErrorCode;
  constructor(code: BridgeErrorCode, message: string) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
  }
}
