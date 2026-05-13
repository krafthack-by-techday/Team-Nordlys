import { Elysia } from "elysia";
import { randomUUID } from "node:crypto";
import { signObject } from "@nordlys/crypto";
import {
  EventIngestInput,
  type SignedEvent,
} from "@nordlys/contracts";
import { config } from "../config";
import { getKeypair } from "../keystore";
import { getDbInstance } from "../db";
import { publishEvent } from "../mesh-publish";
import { redisPublishEvent } from "../redis-publish";
import {
  countEventsLastHour,
  getEventById,
  insertEvent,
  listEvents,
} from "../repos/events";

export const eventRoutes = new Elysia({ prefix: "/events" })
  .post(
    "/",
    async ({ body, set }) => {
      const db = getDbInstance();

      const cap = config.scenarioRateCaps[body.severity];
      const used = await countEventsLastHour(db, body.severity);
      if (used >= cap) {
        set.status = 429;
        return {
          error: "rate_cap_exceeded",
          severity: body.severity,
          cap,
          used,
        };
      }

      const event: Omit<SignedEvent, "signature"> = {
        id: randomUUID(),
        node_id: config.nodeId,
        company: config.company,
        title: body.title,
        description: body.description ?? "",
        severity: body.severity,
        source: body.source,
        external_ref: body.external_ref ?? "",
        scenario_id: body.scenario_id ?? "",
        created_at: new Date().toISOString(),
        ...(body.recipients ? { recipients: body.recipients } : {}),
      };

      const signature = signObject(event, getKeypair().privateKey);
      const signed: SignedEvent = { ...event, signature };

      await insertEvent(db, signed);
      void publishEvent(signed);
      void redisPublishEvent({ ...signed, path: [config.nodeId] });
      set.status = 201;
      return signed;
    },
    { body: EventIngestInput },
  )
  .get("/", async () => {
    return await listEvents(getDbInstance());
  })
  .get("/:id", async ({ params, set }) => {
    const event = await getEventById(getDbInstance(), params.id);
    if (!event) {
      set.status = 404;
      return { error: "not_found" };
    }
    return event;
  });
