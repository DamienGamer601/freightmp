/**
 * Spécification OpenAPI 3.1 de l'API publique FreightMP.
 * Servie sur `GET /api/v1/openapi.json`.
 */
export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "FreightMP Public API",
    version: "1.0.0",
    description:
      "API publique de FreightMP (FMP) — plateforme multijoueur pour Euro Truck Simulator 2 et American Truck Simulator. Authentification par clé API `fmp_...` (Bearer).",
    contact: { name: "FR | Industries Corporation" },
    license: { name: "Proprietary" },
  },
  servers: [
    { url: "http://localhost:4000/api/v1", description: "Développement local" },
  ],
  tags: [
    { name: "Système", description: "Santé et métadonnées" },
    { name: "Serveurs", description: "État des serveurs de jeu" },
    { name: "Joueurs", description: "Profils et classement" },
    { name: "Événements", description: "Convois et événements" },
    { name: "Clés API", description: "Gestion des clés (session web)" },
    { name: "Webhooks", description: "Abonnements aux événements" },
  ],
  components: {
    securitySchemes: {
      apiKey: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "fmp_...",
        description: "Clé API FreightMP, sous la forme `Authorization: Bearer fmp_...`.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "UNAUTHORIZED" },
              message: { type: "string", example: "Clé API requise" },
            },
          },
        },
      },
      Server: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          slug: { type: "string" },
          game: { type: "string", enum: ["ETS2", "ATS"] },
          status: {
            type: "string",
            enum: ["ONLINE", "OFFLINE", "MAINTENANCE"],
          },
          maxPlayers: { type: "integer" },
          onlinePlayers: { type: "integer" },
        },
      },
      Player: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          username: { type: "string" },
          country: { type: "string", nullable: true, example: "FR" },
          avatarUrl: { type: "string", nullable: true },
          kilometersDriven: { type: "number" },
          deliveriesCompleted: { type: "integer" },
        },
      },
      Event: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          description: { type: "string", nullable: true },
          startsAt: { type: "string", format: "date-time" },
          location: { type: "string", nullable: true },
          game: { type: "string", enum: ["ETS2", "ATS"] },
        },
      },
      ApiKey: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          prefix: { type: "string", example: "fmp_ab12cd34" },
          scopes: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" },
          lastUsedAt: { type: "string", format: "date-time", nullable: true },
          revokedAt: { type: "string", format: "date-time", nullable: true },
        },
      },
      Webhook: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          url: { type: "string", format: "uri" },
          events: { type: "array", items: { type: "string" } },
          active: { type: "boolean" },
          lastStatus: { type: "integer", nullable: true },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Système"],
        summary: "Santé de l'API",
        security: [],
        responses: {
          "200": {
            description: "L'API répond.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    service: { type: "string" },
                    time: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/public/servers": {
      get: {
        tags: ["Serveurs"],
        summary: "Liste des serveurs et leur état",
        security: [{ apiKey: [] }],
        responses: {
          "200": {
            description: "Liste des serveurs.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    servers: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Server" },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Clé API manquante ou invalide.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/public/leaderboard": {
      get: {
        tags: ["Joueurs"],
        summary: "Classement des joueurs (kilomètres)",
        security: [{ apiKey: [] }],
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 25, maximum: 100 },
          },
        ],
        responses: {
          "200": {
            description: "Classement.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    players: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Player" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/public/events": {
      get: {
        tags: ["Événements"],
        summary: "Événements à venir",
        security: [{ apiKey: [] }],
        responses: {
          "200": {
            description: "Événements à venir.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    events: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Event" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/public/me": {
      get: {
        tags: ["Système"],
        summary: "Informations de la clé API utilisée",
        security: [{ apiKey: [] }],
        responses: {
          "200": {
            description: "Propriétaire et scopes de la clé.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    keyId: { type: "string" },
                    keyName: { type: "string" },
                    scopes: { type: "array", items: { type: "string" } },
                    owner: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        username: { type: "string" },
                        role: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/keys": {
      get: {
        tags: ["Clés API"],
        summary: "Liste mes clés API (session web)",
        security: [{ apiKey: [] }],
        responses: {
          "200": {
            description: "Clés de l'utilisateur.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    keys: {
                      type: "array",
                      items: { $ref: "#/components/schemas/ApiKey" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Clés API"],
        summary: "Crée une clé API",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", maxLength: 60 },
                  scopes: {
                    type: "array",
                    items: { type: "string" },
                    example: ["servers:read", "players:read"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description:
              "Clé créée. Le champ `key` n'est renvoyé qu'à ce moment-là.",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/ApiKey" },
                    {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        warning: { type: "string" },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    "/keys/{id}": {
      delete: {
        tags: ["Clés API"],
        summary: "Révoque une clé API",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: {
          "200": { description: "Clé révoquée." },
          "404": { description: "Clé introuvable." },
        },
      },
    },
    "/webhooks": {
      get: {
        tags: ["Webhooks"],
        summary: "Liste mes webhooks",
        responses: {
          "200": {
            description: "Webhooks de l'utilisateur.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    webhooks: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Webhook" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Webhooks"],
        summary: "Crée un webhook",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: {
                  url: { type: "string", format: "uri" },
                  events: {
                    type: "array",
                    items: {
                      type: "string",
                      enum: [
                        "event.created",
                        "event.updated",
                        "announcement.created",
                        "player.joined",
                        "delivery.completed",
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Webhook créé (secret affiché une fois)." },
        },
      },
    },
    "/webhooks/{id}": {
      delete: {
        tags: ["Webhooks"],
        summary: "Supprime un webhook",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: { "200": { description: "Webhook supprimé." } },
      },
    },
    "/webhooks/{id}/test": {
      post: {
        tags: ["Webhooks"],
        summary: "Envoie un événement de test",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        ],
        responses: { "200": { description: "Résultat de la livraison." } },
      },
    },
  },
} as const;
