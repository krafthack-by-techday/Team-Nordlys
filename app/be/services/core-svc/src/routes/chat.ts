import { Elysia } from "elysia";
import { randomUUID } from "node:crypto";
import { signObject } from "@nordlys/crypto";
import {
  ChatMessageInput,
  type SignedChatMessage,
} from "@nordlys/contracts";
import { config } from "../config";
import { getKeypair } from "../keystore";
import { getDbInstance } from "../db";
import { publishChat } from "../mesh-publish";
import { redisPublishChat } from "../redis-publish";
import { insertChat, listChatForEvent } from "../repos/chat";

export const chatRoutes = new Elysia({ prefix: "/chat" })
  .post(
    "/",
    async ({ body, set }) => {
      const message: Omit<SignedChatMessage, "signature"> = {
        id: randomUUID(),
        event_id: body.event_id,
        node_id: config.nodeId,
        company: config.company,
        author: body.author ?? "",
        message: body.message,
        created_at: new Date().toISOString(),
      };

      const signature = signObject(message, getKeypair().privateKey);
      const signed: SignedChatMessage = { ...message, signature };

      await insertChat(getDbInstance(), signed);
      void publishChat(signed);
      void redisPublishChat(signed);
      set.status = 201;
      return signed;
    },
    { body: ChatMessageInput },
  )
  .get("/:eventId", async ({ params }) => {
    return await listChatForEvent(getDbInstance(), params.eventId);
  });
