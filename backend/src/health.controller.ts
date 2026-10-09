import { Controller, Get } from "@nestjs/common";

// Health check for the deployed backend (Vercel). Thanks to the global "api"
// prefix, these map to:
//   GET /api        -> 200 {"status":"ok",...}
//   GET /api/health -> 200 {"status":"ok",...}
// Use this URL to verify the backend is live before wiring it into the frontend.
@Controller()
export class HealthController {
  @Get()
  root() {
    return this.status();
  }

  @Get("health")
  health() {
    return this.status();
  }

  private status() {
    return {
      status: "ok",
      service: "not-your-gig-backend",
      time: new Date().toISOString(),
    };
  }
}