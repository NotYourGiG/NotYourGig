import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

// Shared bootstrap used by main.ts (local dev / Node host) and by the Vercel
// serverless handler. Keeps global prefix, CORS and pipes in one place.
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  // On Vercel the frontend and backend are separate projects, so the backend
  // must allow the deployed frontend origins. The allowlist is the
  // FRONTEND_URL env var (comma-separated; typically set in the Vercel
  // dashboard for the backend project) MERGED with the known origins baked
  // in below — so a dashboard var that only knows the original Vercel
  // domain still works, and new domains can't be missed if the var is ever
  // unset. Unset FRONTEND_URL + empty defaults => allow all (local dev).
  const DEFAULT_FRONTEND_URLS = [
    "https://not-your-gig-p5ga.vercel.app",
    "https://notyourgig.runs-on.dev",
    "https://www.notyourgig.runs-on.dev",
  ];
  const frontendUrls = [
    ...(process.env.FRONTEND_URL ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    ...DEFAULT_FRONTEND_URLS,
  ].filter((url, index, all) => all.indexOf(url) === index);
  app.enableCors(
    frontendUrls.length > 0
      ? { origin: frontendUrls, credentials: true }
      : { origin: true, credentials: true },
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}