import { Elysia } from "elysia";
import { randomUUID } from "node:crypto";
import { signObject } from "@nordlys/crypto";
import {
  IndicatorIngestInput,
  type SignedIndicator,
} from "@nordlys/contracts";
import { config } from "../config";
import { getKeypair } from "../keystore";
import { getDbInstance } from "../db";
import { publishIndicator } from "../mesh-publish";
import { redisPublishIndicator } from "../redis-publish";
import { insertIndicator, listIndicators } from "../repos/indicators";

export const indicatorRoutes = new Elysia({ prefix: "/indicators" })
  .post(
    "/",
    async ({ body, set }) => {
      const indicator: Omit<SignedIndicator, "signature"> = {
        id: randomUUID(),
        node_id: config.nodeId,
        company: config.company,
        type: body.type,
        value: body.value,
        tlp: body.tlp,
        description: body.description ?? "",
        severity: body.severity,
        created_at: new Date().toISOString(),
        ...(body.recipients ? { recipients: body.recipients } : {}),
      };

      const signature = signObject(indicator, getKeypair().privateKey);
      const signed: SignedIndicator = { ...indicator, signature };

      await insertIndicator(getDbInstance(), signed);
      void publishIndicator(signed);
      void redisPublishIndicator(signed);
      set.status = 201;
      return signed;
    },
    { body: IndicatorIngestInput },
  )
  .get("/", async () => {
    return await listIndicators(getDbInstance());
  });
