import { randomUUID } from "node:crypto";
import { config } from "./config";
import type { RawWS } from "./connections";

// Tracks HELLOs from unknown nodes that arrived with an invite_token.
// The Varde holds the candidate's WS open while it forwards a
// INVITE_VALIDATION_FORWARD to a KraftCERT-tagged session and waits for
// the matching INVITE_VALIDATION_RESPONSE. After `inviteValidationTtlMs`
// the entry is reaped and the candidate gets REJECTED.

interface Pending {
  corrId: string;
  candidateWs: RawWS;
  candidateNodeId: string;
  candidateCompany: string;
  candidatePublicKey: string;
  inviteToken: string;
  helloAt: number;
  timer: ReturnType<typeof setTimeout>;
}

const byCorrId = new Map<string, Pending>();

export interface ParkParams {
  candidateWs: RawWS;
  candidateNodeId: string;
  candidateCompany: string;
  candidatePublicKey: string;
  inviteToken: string;
  onTimeout: (pending: Pending) => void;
}

export function parkInvite(params: ParkParams): Pending {
  const corrId = randomUUID();
  const timer = setTimeout(() => {
    const entry = byCorrId.get(corrId);
    if (!entry) return;
    byCorrId.delete(corrId);
    params.onTimeout(entry);
  }, config.inviteValidationTtlMs);

  const pending: Pending = {
    corrId,
    candidateWs: params.candidateWs,
    candidateNodeId: params.candidateNodeId,
    candidateCompany: params.candidateCompany,
    candidatePublicKey: params.candidatePublicKey,
    inviteToken: params.inviteToken,
    helloAt: Date.now(),
    timer,
  };
  byCorrId.set(corrId, pending);
  return pending;
}

export function takePending(corrId: string): Pending | undefined {
  const entry = byCorrId.get(corrId);
  if (!entry) return undefined;
  clearTimeout(entry.timer);
  byCorrId.delete(corrId);
  return entry;
}

export function pendingCount(): number {
  return byCorrId.size;
}

export type { Pending };
