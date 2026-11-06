import dgram, { type RemoteInfo } from "node:dgram";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import {
  LIMITS,
  decode,
  decodeStateBinary,
  encode,
  encodeSnapshotBinary,
  isJsonMessage,
  type ClientMessage,
  type ServerMessage,
  type StatePayload,
} from "./protocol";
import { RoomManager, type Player, type Room } from "./rooms";

export interface GameServerOptions {
  udpPort: number;
  httpPort: number;
  /** Si défini, les clients doivent fournir ce token pour rejoindre. */
  token?: string;
  /** Secret JWT partagé avec l'API FreightMP (pour vérifier les jetons MP). */
  jwtSecret?: string;
  /** Si true, un jeton MP valide est obligatoire pour rejoindre. */
  requireAuth?: boolean;
  tickRate?: number;
  /** URL de l'API FreightMP (ex. http://localhost:4000) pour la vérification des bans. */
  apiUrl?: string;
  /** Clé interne de l'API (header x-internal-key). */
  internalApiKey?: string;
}

/**
 * Serveur de jeu multijoueur FreightMP.
 *
 * - Plan de contrôle HTTP : /health, /rooms (lister/créer/détail/supprimer).
 * - Plan de données UDP : join / state / leave / ping.
 * - Boucle de tick : diffuse un snapshot des joueurs à leur salle.
 */
export class GameServer {
  private rooms = new RoomManager();
  private udp = dgram.createSocket("udp4");
  private httpServer = http.createServer((req, res) => {
    void this.handleHttp(req, res);
  });
  private tickHandle?: NodeJS.Timeout;
  private tickRate: number;
  private wss?: WebSocketServer;
  private chatCooldowns = new Map<string, number>();

  constructor(private options: GameServerOptions) {
    this.tickRate = options.tickRate ?? LIMITS.TICK_RATE_HZ;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.udp.on("message", (message, rinfo) => this.handleUdp(message, rinfo));
      this.udp.on("error", (error) => console.error("[MP] UDP error", error.message));

      this.udp.bind(this.options.udpPort, "0.0.0.0", () => {
        console.log(`[MP] UDP sur 0.0.0.0:${this.options.udpPort}`);

        this.httpServer.on("error", (error) => reject(error));
        this.httpServer.listen(this.options.httpPort, "0.0.0.0", () => {
          console.log(`[MP] HTTP sur 0.0.0.0:${this.options.httpPort}`);

          this.wss = new WebSocketServer({ server: this.httpServer, path: "/ws" });
          this.wss.on("connection", (socket) => {
            socket.send(
              JSON.stringify({ type: "hello", rooms: this.rooms.summaries() }),
            );
          });
          console.log(`[MP] WebSocket sur /ws (viewers web)`);

          this.startTick();
          resolve();
        });
      });
    });
  }

  stop(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = undefined;
    }
    this.udp.close();
    this.httpServer.close();
  }

  /* ---------- Tick ---------- */

  private startTick(): void {
    const interval = Math.max(10, Math.round(1000 / this.tickRate));
    this.tickHandle = setInterval(() => this.tick(), interval);
  }

  private tick(): void {
    const now = Date.now();

    for (const room of this.rooms.all()) {
      room.tick += 1;

      // Retire les joueurs inactifs.
      for (const [key, player] of room.players) {
        if (now - player.lastSeen > LIMITS.PLAYER_TIMEOUT_MS) {
          room.players.delete(key);
        }
      }

      if (room.players.size === 0) {
        continue;
      }

      const snapshot = encodeSnapshotBinary({
        tick: room.tick,
        serverTime: now,
        players: Array.from(room.players.values()).map((player) => ({
          numId: player.numId,
          x: player.x,
          z: player.z,
          heading: player.heading,
          speed: player.speed,
        })),
      });

      for (const player of room.players.values()) {
        this.udp.send(snapshot, player.port, player.address);
      }

      // Diffusion périodique des pseudos (pour le panneau TAB du client).
      if (room.tick % 40 === 0) {
        const infoBuffer = encode({
          t: "players",
          players: Array.from(room.players.values()).map((player) => ({
            n: player.numId,
            u: player.username ?? player.truckId,
            p: player.latencyMs ?? 0,
            g: player.tag,
            c: player.country,
            r: player.role ?? "DRIVER",
          })),
        });
        for (const player of room.players.values()) {
          this.udp.send(infoBuffer, player.port, player.address);
        }
        this.broadcastEnvironment(room);
      }
    }

    // Diffusion temps réel aux viewers web (WebSocket).
    if (this.wss && this.wss.clients.size > 0) {
      const payload = JSON.stringify({
        type: "rooms",
        rooms: this.rooms.all().map((room) => ({
          id: room.id,
          name: room.name,
          game: room.game,
          maxPlayers: room.maxPlayers,
          playerCount: room.players.size,
          players: Array.from(room.players.values()).map((player) => ({
            numId: player.numId,
            truckId: player.truckId,
            username: player.username,
            tag: player.tag,
            ping: player.latencyMs ?? 0,
            x: player.x,
            z: player.z,
            heading: player.heading,
            speed: player.speed,
          })),
        })),
      });

      for (const client of this.wss.clients) {
        if (client.readyState === 1) {
          client.send(payload);
        }
      }
    }
  }

  /* ---------- UDP ---------- */

  private handleUdp(raw: Buffer, rinfo: RemoteInfo): void {
    const key = `${rinfo.address}:${rinfo.port}`;

    // Message binaire haute fréquence (state) ?
    if (!isJsonMessage(raw)) {
      const state = decodeStateBinary(raw);
      if (state) {
        this.applyState(key, state);
        this.checkCollisions(key);
      }
      return;
    }

    const message = decode<ClientMessage>(raw);
    if (!message || typeof message.t !== "string") {
      return;
    }

    switch (message.t) {
      case "join":
        this.handleJoin(message, rinfo, key);
        break;
      case "state":
        this.applyState(key, {
          seq: message.seq,
          x: message.x,
          z: message.z,
          heading: message.heading ?? 0,
          speed: message.speed ?? 0,
        });
        this.checkCollisions(key);
        break;
      case "leave": {
        const room = this.findRoomOfPlayer(key);
        room?.players.delete(key);
        break;
      }
      case "ping":
        this.sendTo(rinfo, { t: "pong", ts: message.ts });
        break;
      case "chat":
        this.handleChat(message.message, key);
        break;
      case "latency": {
        const room = this.findRoomOfPlayer(key);
        const player = room?.players.get(key);
        if (player) {
          player.latencyMs = Math.max(0, Math.round(message.value));
        }
        break;
      }
      case "set-environment": {
        const room = this.findRoomOfPlayer(key);
        const player = room?.players.get(key);
        if (!room || !player) {
          break;
        }
        if (player.role !== "ADMIN" && player.role !== "MODERATOR") {
          this.sendTo(rinfo, { t: "error", reason: "Réservé aux admins" });
          break;
        }
        if (typeof message.weather === "string") {
          room.weather = message.weather;
        }
        if (typeof message.timeOfDay === "number") {
          room.timeOfDay =
            ((Math.round(message.timeOfDay) % 1440) + 1440) % 1440;
        }
        this.broadcastEnvironment(room);
        break;
      }
      /* ---------- Commandes admin (panneau in-game) ---------- */
      case "kick": {
        const room = this.findRoomOfPlayer(key);
        const player = room?.players.get(key);
        if (!room || !player) {
          break;
        }
        if (player.role !== "ADMIN" && player.role !== "MODERATOR") {
          this.sendTo(rinfo, { t: "error", reason: "Réservé aux admins" });
          break;
        }
        const targetNumId = Number(message.target);
        if (!Number.isFinite(targetNumId)) {
          break;
        }
        for (const [otherKey, other] of room.players) {
          if (other.numId !== targetNumId) {
            continue;
          }
          if (otherKey === key) {
            this.sendTo(rinfo, { t: "error", reason: "Impossible de s'expulser soi-même" });
            break;
          }
          if (other.role === "ADMIN" && player.role !== "ADMIN") {
            this.sendTo(rinfo, { t: "error", reason: "Un modérateur ne peut pas expulser un admin" });
            break;
          }
          const reason =
            typeof message.reason === "string" && message.reason.length > 0
              ? message.reason.slice(0, 120)
              : "Expulsé par un administrateur";
          this.udp.send(encode({ t: "kicked", reason }), other.port, other.address);
          room.players.delete(otherKey);
          this.sendTo(rinfo, {
            t: "admin-ok",
            action: "kick",
            detail: `Joueur ${targetNumId} expulsé`,
          });
          break;
        }
        break;
      }
      case "announce": {
        const room = this.findRoomOfPlayer(key);
        const player = room?.players.get(key);
        if (!room || !player) {
          break;
        }
        if (player.role !== "ADMIN" && player.role !== "MODERATOR") {
          this.sendTo(rinfo, { t: "error", reason: "Réservé aux admins" });
          break;
        }
        const text =
          typeof message.message === "string" ? message.message.trim().slice(0, 200) : "";
        if (!text) {
          break;
        }
        const packet = encode({
          t: "chat",
          numId: 0,
          name: "ADMIN",
          message: text,
          system: true,
        });
        for (const other of room.players.values()) {
          this.udp.send(packet, other.port, other.address);
        }
        this.sendTo(rinfo, { t: "admin-ok", action: "announce", detail: "Annonce diffusée" });
        break;
      }
      case "time": {
        const room = this.findRoomOfPlayer(key);
        const player = room?.players.get(key);
        if (!room || !player) {
          break;
        }
        if (player.role !== "ADMIN" && player.role !== "MODERATOR") {
          this.sendTo(rinfo, { t: "error", reason: "Réservé aux admins" });
          break;
        }
        const delta = Number(message.delta);
        if (Number.isFinite(delta)) {
          room.timeOfDay = ((room.timeOfDay + Math.round(delta)) % 1440 + 1440) % 1440;
        }
        this.broadcastEnvironment(room);
        break;
      }
      case "ban": {
        const room = this.findRoomOfPlayer(key);
        const player = room?.players.get(key);
        if (!room || !player) {
          break;
        }
        if (player.role !== "ADMIN" && player.role !== "MODERATOR") {
          this.sendTo(rinfo, { t: "error", reason: "Réservé aux admins" });
          break;
        }
        const targetNumId = Number(message.target);
        const byName =
          typeof message.username === "string" ? message.username.trim() : "";
        let target: { key: string; userId?: string; role?: string } | null = null;
        for (const [otherKey, other] of room.players) {
          const matches =
            (Number.isFinite(targetNumId) && other.numId === targetNumId) ||
            (byName.length > 0 && other.username === byName);
          if (matches) {
            target = { key: otherKey, userId: other.userId, role: other.role };
            break;
          }
        }
        if (!target) {
          this.sendTo(rinfo, { t: "error", reason: "Joueur introuvable" });
          break;
        }
        if (target.key === key) {
          this.sendTo(rinfo, { t: "error", reason: "Impossible de se bannir soi-même" });
          break;
        }
        if (target.role === "ADMIN" && player.role !== "ADMIN") {
          this.sendTo(rinfo, { t: "error", reason: "Un modérateur ne peut pas bannir un admin" });
          break;
        }
        if (!target.userId) {
          this.sendTo(rinfo, { t: "error", reason: "Joueur non authentifié (pas de compte FreightMP)" });
          break;
        }
        const reason =
          typeof message.reason === "string" && message.reason.length > 0
            ? message.reason.slice(0, 200)
            : "Banni par un administrateur";
        void this.createBan(target.userId, player.userId ?? "", reason).then((ok) => {
          if (!ok) {
            this.sendTo(rinfo, {
              t: "error",
              reason: "API FreightMP injoignable : ban non enregistré",
            });
            return;
          }
          const kickedPlayer = room.players.get(target.key);
          if (kickedPlayer) {
            this.udp.send(
              encode({ t: "kicked", reason: `Banni : ${reason}` }),
              kickedPlayer.port,
              kickedPlayer.address,
            );
            room.players.delete(target.key);
          }
          this.sendTo(rinfo, {
            t: "admin-ok",
            action: "ban",
            detail: `Joueur banni : ${reason}`,
          });
        });
        break;
      }
    }
  }

  /** Distance (unités de jeu) sous laquelle on considère une collision. */
  private static readonly COLLISION_DISTANCE = 4.0;

  /** Anti-spam des alertes de collision par joueur. */
  private collisionCooldowns = new Map<string, number>();

  /**
   * Détecte une collision (proximité) entre le joueur et les autres de la salle,
   * et envoie une alerte aux deux joueurs concernés.
   */
  private checkCollisions(key: string): void {
    const room = this.findRoomOfPlayer(key);
    if (!room) {
      return;
    }
    const player = room.players.get(key);
    if (!player) {
      return;
    }

    const now = Date.now();

    for (const [otherKey, other] of room.players) {
      if (otherKey === key) {
        continue;
      }
      const dx = other.x - player.x;
      const dz = other.z - player.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance >= GameServer.COLLISION_DISTANCE) {
        continue;
      }

      // Cooldown par paire de joueurs (évite le double envoi A->B / B->A).
      const pairKey = key < otherKey ? `${key}|${otherKey}` : `${otherKey}|${key}`;
      const last = this.collisionCooldowns.get(pairKey) ?? 0;
      if (now - last < 1500) {
        continue;
      }
      this.collisionCooldowns.set(pairKey, now);

      this.sendToPlayer(player, {
        t: "collision",
        other: other.numId,
        x: player.x,
        z: player.z,
        at: now,
      });
      this.sendToPlayer(other, {
        t: "collision",
        other: player.numId,
        x: other.x,
        z: other.z,
        at: now,
      });
      return;
    }
  }

  private sendToPlayer(player: Player, message: ServerMessage): void {
    this.udp.send(encode(message), player.port, player.address);
  }

  /** Diffuse la météo + l'heure du jour à tous les joueurs de la salle. */
  private broadcastEnvironment(room: Room): void {
    const message = encode({
      t: "environment",
      weather: room.weather,
      timeOfDay: room.timeOfDay,
      at: Date.now(),
    });
    for (const player of room.players.values()) {
      this.udp.send(message, player.port, player.address);
    }
  }

  private handleChat(rawMessage: string, key: string): void {    const room = this.findRoomOfPlayer(key);
    if (!room) {
      return;
    }
    const player = room.players.get(key);
    if (!player) {
      return;
    }

    // Limite anti-spam basique : 200 caractères, 1 message / 500 ms.
    const now = Date.now();
    const last = this.chatCooldowns.get(key) ?? 0;
    if (now - last < 500) {
      return;
    }
    this.chatCooldowns.set(key, now);

    const text = String(rawMessage ?? "").trim().slice(0, 200);
    if (!text) {
      return;
    }

    const chat = encode({
      t: "chat",
      numId: player.numId,
      name: player.username ?? player.truckId,
      message: text,
      at: now,
    });
    for (const other of room.players.values()) {
      this.udp.send(chat, other.port, other.address);
    }
  }

  private handleJoin(
    message: Extract<ClientMessage, { t: "join" }>,
    rinfo: RemoteInfo,
    key: string,
  ): void {
    void this.handleJoinAsync(message, rinfo, key);
  }

  private async handleJoinAsync(
    message: Extract<ClientMessage, { t: "join" }>,
    rinfo: RemoteInfo,
    key: string,
  ): Promise<void> {
    // Jeton MP (JWT signé par l'API FreightMP).
    const auth = this.verifyMpToken(message.token);
    if (message.token && !auth) {
      this.sendTo(rinfo, { t: "join-err", reason: "Jeton MP invalide ou expiré" });
      return;
    }
    if (this.options.requireAuth && !auth) {
      this.sendTo(rinfo, { t: "join-err", reason: "Authentification requise" });
      return;
    }

    // Bannissement : vérifié auprès de l'API FreightMP (si configurée).
    if (auth?.userId) {
      const ban = await this.checkBan(auth.userId);
      if (ban.banned) {
        this.sendTo(rinfo, {
          t: "join-err",
          reason: `Compte banni : ${ban.reason ?? "sanction active"}`,
        });
        return;
      }
    }

    // Token partagé simple (optionnel, pour du LAN privé).
    if (this.options.token && message.token !== this.options.token && !auth) {
      this.sendTo(rinfo, { t: "join-err", reason: "Token invalide" });
      return;
    }

    const room = this.rooms.find(message.roomId);
    if (!room) {
      this.sendTo(rinfo, { t: "join-err", reason: "Salle introuvable" });
      return;
    }

    if (!room.players.has(key) && room.players.size >= room.maxPlayers) {
      this.sendTo(rinfo, { t: "join-err", reason: "Salle pleine" });
      return;
    }

    const existing = room.players.get(key);
    const player = existing ?? {
      key,
      id: key,
      numId: room.nextNumId++,
      address: rinfo.address,
      port: rinfo.port,
      truckId: message.truckId ?? auth?.username ?? key,
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      lastSeen: Date.now(),
      lastSeq: -1,
    };
    player.truckId = message.truckId ?? auth?.username ?? player.truckId;
    if (auth) {
      player.username = auth.username;
      player.userId = auth.userId;
      player.role = auth.role;
      player.tag = auth.tag;
      player.country = auth.country;
    }
    player.lastSeen = Date.now();
    room.players.set(key, player);

    this.sendTo(rinfo, {
      t: "join-ok",
      playerId: player.id,
      numId: player.numId,
      roomId: room.id,
      tick: room.tick,
      role: player.role ?? "DRIVER",
    });
  }

  private applyState(key: string, message: StatePayload): void {
    const room = this.findRoomOfPlayer(key);
    if (!room) {
      return;
    }
    const player = room.players.get(key);
    if (!player) {
      return;
    }

    // Anti-rejeu : séquence strictement croissante.
    if (message.seq <= player.lastSeq) {
      return;
    }

    const firstUpdate = player.lastSeq < 0;
    if (!firstUpdate) {
      const step = Math.hypot(message.x - player.x, message.z - player.z);
      if (step > LIMITS.MAX_STEP_PER_UPDATE) {
        // Déplacement anormal (téléportation) : on ignore la mise à jour.
        return;
      }
    }

    player.lastSeq = message.seq;
    player.x = message.x;
    player.z = message.z;
    if (typeof message.heading === "number") {
      player.heading = message.heading;
    }
    if (typeof message.speed === "number") {
      player.speed = Math.min(Math.max(message.speed, 0), LIMITS.MAX_SPEED_KMH);
    }
    player.lastSeen = Date.now();
  }

  private findRoomOfPlayer(key: string): Room | undefined {
    return this.rooms.all().find((room) => room.players.has(key));
  }

  /** Vérifie un jeton MP (JWT signé par l'API FreightMP). */
  private verifyMpToken(
    token?: string,
  ): {
    username: string;
    role: string;
    userId: string;
    tag?: string;
    country?: string;
  } | null {
    if (!token || !this.options.jwtSecret) {
      return null;
    }
    try {
      const decoded = jwt.verify(token, this.options.jwtSecret);
      if (typeof decoded === "string") {
        return null;
      }
      const payload = decoded as jwt.JwtPayload;
      if (payload.kind !== "mp") {
        return null;
      }
      return {
        username:
          typeof payload.username === "string" ? payload.username : "joueur",
        role: typeof payload.role === "string" ? payload.role : "DRIVER",
        userId: String(payload.sub ?? ""),
        tag: typeof payload.tag === "string" ? payload.tag : undefined,
        country:
          typeof payload.country === "string" ? payload.country : undefined,
      };
    } catch {
      return null;
    }
  }

  private sendTo(rinfo: RemoteInfo, message: ServerMessage): void {
    this.udp.send(encode(message), rinfo.port, rinfo.address);
  }

  /* ---------- Bans (via l'API FreightMP) ---------- */

  /** Appelle l'API interne avec la clé partagée. */
  private async callApi(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<unknown | null> {
    if (!this.options.apiUrl || !this.options.internalApiKey) {
      return null;
    }
    try {
      const res = await fetch(`${this.options.apiUrl}${path}`, {
        method: init?.method ?? "GET",
        headers: {
          "x-internal-key": this.options.internalApiKey,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init?.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as unknown;
    } catch {
      return null;
    }
  }

  /** Vrai si le compte FreightMP est banni (actif et non expiré). */
  private async checkBan(
    userId: string,
  ): Promise<{ banned: boolean; reason?: string }> {
    const data = (await this.callApi(
      `/api/v1/internal/bans/check?userId=${encodeURIComponent(userId)}`,
    )) as { banned?: boolean; reason?: string } | null;
    if (!data || !data.banned) {
      return { banned: false };
    }
    return { banned: true, reason: data.reason };
  }

  /** Crée un ban via l'API interne (panneau admin in-game). */
  private async createBan(
    userId: string,
    issuerId: string,
    reason: string,
  ): Promise<boolean> {
    const data = (await this.callApi("/api/v1/internal/bans", {
      method: "POST",
      body: { userId, issuerId, reason, type: "PERMANENT" },
    })) as { ok?: boolean } | null;
    return data?.ok === true;
  }

  /* ---------- HTTP (plan de contrôle) ---------- */

  private async handleHttp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }

    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json", ...cors });
      res.end(JSON.stringify(body));
    };

    // GET /health
    if (req.method === "GET" && url.pathname === "/health") {
      json(200, { ok: true, rooms: this.rooms.summaries().length });
      return;
    }

    // GET /rooms
    if (req.method === "GET" && url.pathname === "/rooms") {
      json(200, { rooms: this.rooms.summaries() });
      return;
    }

    // POST /rooms
    if (req.method === "POST" && url.pathname === "/rooms") {
      const body = await readJsonBody(req);
      const name =
        typeof body?.name === "string" && body.name.trim()
          ? body.name.trim()
          : `Salle ${this.rooms.summaries().length + 1}`;
      const game = body?.game === "ATS" ? "ATS" : "ETS2";
      const maxPlayers =
        typeof body?.maxPlayers === "number" && body.maxPlayers > 0
          ? Math.min(body.maxPlayers, 1000)
          : 100;
      const room = this.rooms.create({ name, game, maxPlayers });
      json(200, { id: room.id, name: room.name, game: room.game, maxPlayers: room.maxPlayers });
      return;
    }

    // GET /rooms/:id  ou DELETE /rooms/:id
    const match = url.pathname.match(/^\/rooms\/([^/]+)$/);
    if (match) {
      const id = decodeURIComponent(match[1]);
      const room = this.rooms.get(id);
      if (!room) {
        json(404, { error: "Salle introuvable" });
        return;
      }
      if (req.method === "GET") {
        json(200, {
          id: room.id,
          name: room.name,
          game: room.game,
          maxPlayers: room.maxPlayers,
          playerCount: room.players.size,
          tick: room.tick,
          weather: room.weather,
          timeOfDay: room.timeOfDay,
          players: Array.from(room.players.values()).map((player) => ({
            id: player.id,
            numId: player.numId,
            truckId: player.truckId,
            username: player.username,
            role: player.role,
            x: player.x,
            z: player.z,
            heading: player.heading,
            speed: player.speed,
          })),
        });
        return;
      }
      if (req.method === "DELETE") {
        this.rooms.delete(id);
        json(200, { ok: true });
        return;
      }
    }

    // POST /rooms/:id/environment  (météo + heure partagées)
    const envMatch = url.pathname.match(/^\/rooms\/([^/]+)\/environment$/);
    if (envMatch && req.method === "POST") {
      const id = decodeURIComponent(envMatch[1]);
      const room = this.rooms.get(id);
      if (!room) {
        json(404, { error: "Salle introuvable" });
        return;
      }
      const body = await readJsonBody(req);
      if (typeof body?.weather === "string") {
        room.weather = body.weather;
      }
      if (typeof body?.timeOfDay === "number") {
        room.timeOfDay =
          ((Math.round(body.timeOfDay) % 1440) + 1440) % 1440;
      }
      this.broadcastEnvironment(room);
      json(200, {
        ok: true,
        weather: room.weather,
        timeOfDay: room.timeOfDay,
      });
      return;
    }

    json(404, { error: "Route introuvable" });
  }
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
      if (raw.length > 1_000_000) {
        req.destroy();
        resolve(null);
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : null);
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}
