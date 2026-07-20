export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Seed Starter API",
    version: "0.1.0",
    description:
      "Frost-aware garden planning API. Schedules are server-owned; climate data from NOAA GHCN + PRISM PHZM.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/api/health": {
      get: {
        summary: "Health + climate coverage snapshot",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Service health",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Health" },
              },
            },
          },
        },
      },
    },
    "/api/natives": {
      get: {
        summary: "Native plants by ZIP (EPA Level III ecoregion)",
        operationId: "getNatives",
        parameters: [
          {
            name: "zip",
            in: "query",
            required: true,
            schema: { type: "string", pattern: "^\\d{5}$" },
          },
        ],
        responses: {
          "200": {
            description: "Ecoregion natives with frost-anchored sow tasks",
          },
          "400": { description: "Invalid ZIP" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/api/schedules": {
      post: {
        summary: "Build planting schedule",
        operationId: "createSchedule",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ScheduleRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Serialized schedule",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Schedule" },
              },
            },
          },
          "400": { description: "Validation or zone lookup error" },
          "429": { description: "Rate limited" },
        },
      },
    },
    "/api/schedules/compare": {
      post: {
        summary: "Compare risk profiles",
        operationId: "compareSchedules",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ScheduleRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Three schedules",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    conservative: { $ref: "#/components/schemas/Schedule" },
                    balanced: { $ref: "#/components/schemas/Schedule" },
                    aggressive: { $ref: "#/components/schemas/Schedule" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/saved-plans": {
      get: {
        summary: "List saved plans",
        operationId: "listSavedPlans",
        responses: {
          "200": {
            description: "Plans for current owner (or all when AUTH_SECRET unset)",
          },
        },
      },
      post: {
        summary: "Create saved plan",
        operationId: "createSavedPlan",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SavedPlanInput" },
            },
          },
        },
        responses: {
          "201": { description: "Created plan" },
        },
      },
    },
    "/api/saved-plans/{planId}": {
      get: {
        summary: "Get plan",
        parameters: [
          {
            name: "planId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Plan" },
          "404": { description: "Not found" },
        },
      },
      patch: {
        summary: "Update plan",
        parameters: [
          {
            name: "planId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Updated" },
          "404": { description: "Not found" },
        },
      },
      delete: {
        summary: "Delete plan",
        parameters: [
          {
            name: "planId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Deleted" },
          "404": { description: "Not found" },
        },
      },
    },
    "/api/openapi": {
      get: {
        summary: "OpenAPI 3 document",
        operationId: "getOpenApi",
        responses: { "200": { description: "OpenAPI JSON" } },
      },
    },
  },
  components: {
    schemas: {
      Health: {
        type: "object",
        properties: {
          status: { type: "string" },
          version: { type: "string" },
          commit: { type: "string" },
          crops: { type: "integer" },
          varieties: { type: "integer" },
          persistence: { type: "string", enum: ["postgres", "sqlite"] },
          auth: { type: "string" },
        },
      },
      ScheduleRequest: {
        type: "object",
        required: ["zip", "seeds"],
        properties: {
          zip: { type: "string", example: "55423" },
          seeds: {
            type: "array",
            items: { type: "string" },
            example: ["tomato", "lettuce"],
          },
          riskProfile: {
            type: "string",
            enum: ["conservative", "balanced", "aggressive"],
          },
          season: {
            type: "string",
            enum: ["spring", "fall", "summer"],
            description: "Garden season. Defaults to spring.",
          },
        },
      },
      SavedPlanInput: {
        type: "object",
        required: ["name", "zip", "crops"],
        properties: {
          name: { type: "string" },
          zip: { type: "string" },
          crops: { type: "array", items: { type: "string" } },
          riskProfile: {
            type: "string",
            enum: ["conservative", "balanced", "aggressive"],
          },
          season: {
            type: "string",
            enum: ["spring", "fall", "summer"],
          },
        },
      },
      Schedule: {
        type: "object",
        properties: {
          zone: { type: "string" },
          season: {
            type: "string",
            enum: ["spring", "fall", "summer"],
          },
          lastFrostDate: {
            type: "string",
            format: "date-time",
            description:
              "Season anchor date: last spring frost or first fall frost.",
          },
          frostSource: {
            type: "string",
            enum: ["climate", "station", "regional", "zone"],
          },
          frostProvenance: { type: "string" },
          climateConfidence: {
            type: "string",
            enum: ["high", "medium", "low"],
          },
          stationDistanceKm: { type: "number" },
          climateDataVersion: { type: "string" },
          riskProfile: { type: "string" },
          tasks: { type: "array", items: { type: "object" } },
        },
      },
    },
    securitySchemes: {
      OwnerCookie: {
        type: "apiKey",
        in: "cookie",
        name: "ss_owner",
        description:
          "HMAC-signed owner cookie when AUTH_SECRET is set. Absent locally = open access.",
      },
    },
  },
} as const;
