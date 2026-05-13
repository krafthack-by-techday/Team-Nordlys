/**
 * Singleton HealthScoreTracker instance for mesh-svc.
 */

import { HealthScoreTracker } from "@nordlys/health-score";
import { config } from "./config";

export const healthTracker = new HealthScoreTracker(config.healthDbPath);
