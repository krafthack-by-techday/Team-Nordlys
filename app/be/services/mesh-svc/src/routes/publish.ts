import { Elysia, t } from "elysia";
import {
  SignedChatMessage,
  SignedEvent,
  SignedIndicator,
} from "@nordlys/contracts";
import { manager } from "../manager";

// core-svc POSTs already-signed objects here. mesh-svc's only job is to
// fan them out across active Varde-tunnels — no signing, no DB writes.
export const publishRoutes = new Elysia({ prefix: "/publish" })
  .post(
    "/event",
    ({ body }) => {
      const result = manager.broadcast({ type: "EVENT", event: body });
      return { ...result, id: body.id };
    },
    { body: SignedEvent },
  )
  .post(
    "/indicator",
    ({ body }) => {
      const result = manager.broadcast({ type: "INDICATOR", indicator: body });
      return { ...result, id: body.id };
    },
    { body: SignedIndicator },
  )
  .post(
    "/chat",
    ({ body }) => {
      const result = manager.broadcast({ type: "CHAT", chat: body });
      return { ...result, id: body.id };
    },
    { body: SignedChatMessage },
  )
  .get("/status", () => manager.status());
