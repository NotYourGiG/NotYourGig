import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "./app.factory";
import type { INestApplication } from "@nestjs/common";

// Vercel serverless entry. Builds the same NestJS app once and serves every
// request through its Express adapter (all routes, including /api/*). The
// local dev server keeps using src/main.ts.
let cachedApp: INestApplication | undefined;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = cachedApp ?? (await createApp());
  cachedApp = app;
  const expressInstance = app.getHttpAdapter().getInstance();
  return expressInstance(req, res);
}