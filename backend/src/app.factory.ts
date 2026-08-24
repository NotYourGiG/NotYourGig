import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

// Shared bootstrap used by main.ts (local dev / Node host) and by the Vercel
// serverless handler. Keeps global prefix, CORS and pipes in one place.
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);

  // DIAGNOSTIC: log every request the moment it reaches the serverless
  // function, before any guard/middleware runs. If this line does NOT appear
  // in Vercel logs for a given request, the request died in Vercel's own
  // routing/SSR layer and never reached the backend function at all.
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(
      `[req] ${req.method} ${req.url} auth=${req.headers.authorization ? "present" : "none"}`,
    );
    next();
  });

  app.setGlobalPrefix("api");

  // On Vercel the frontend and backend are separate projects, so the backend
  // must allow the deployed frontend origin. Configurable via FRONTEND_URL
  // (comma-separated list). Unset => allow all (local dev).
  const frontendUrls = (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors(
    frontendUrls.length > 0
      ? { origin: frontendUrls }
      : { origin: true, credentials: true },
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}