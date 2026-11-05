"use client";

import { useEffect, useRef } from "react";

interface MpPlayerLive {
  numId: number;
  truckId: string;
  username?: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
}

interface MpRoomLive {
  id: string;
  name: string;
  players: MpPlayerLive[];
}

/**
 * Mini-carte temps réel : se connecte au WebSocket du serveur MP et dessine
 * les camions (position, cap, vitesse) sur un canvas.
 */
export default function MpLiveMap({ wsUrl }: { wsUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomsRef = useRef<MpRoomLive[]>([]);

  useEffect(() => {
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: string;
          rooms?: MpRoomLive[];
        };
        if (data.type === "rooms" && data.rooms) {
          roomsRef.current = data.rooms;
        }
      } catch {
        /* message non JSON ignoré */
      }
    };

    return () => {
      socket.close();
    };
  }, [wsUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let frame = 0;
    const draw = () => {
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);

      const players = roomsRef.current.flatMap((room) => room.players);

      if (players.length === 0) {
        context.fillStyle = "#71717a";
        context.font = "14px sans-serif";
        context.textAlign = "center";
        context.fillText("Aucun joueur connecté", width / 2, height / 2);
        frame = requestAnimationFrame(draw);
        return;
      }

      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const player of players) {
        minX = Math.min(minX, player.x);
        maxX = Math.max(maxX, player.x);
        minZ = Math.min(minZ, player.z);
        maxZ = Math.max(maxZ, player.z);
      }

      const padding = 70;
      const spanX = Math.max(1, maxX - minX);
      const spanZ = Math.max(1, maxZ - minZ);
      const scale = Math.min(
        (width - padding * 2) / spanX,
        (height - padding * 2) / spanZ,
        2.5,
      );
      const offsetX = (width - spanX * scale) / 2 - minX * scale;
      const offsetY = (height - spanZ * scale) / 2 - minZ * scale;
      const toX = (x: number) => x * scale + offsetX;
      const toY = (z: number) => z * scale + offsetY;

      // Grille discrète.
      context.strokeStyle = "rgba(255,255,255,0.04)";
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 60) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y < height; y += 60) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }

      for (const player of players) {
        const cx = toX(player.x);
        const cy = toY(player.z);
        const angle = (player.heading * Math.PI) / 180;

        // Marqueur directionnel.
        context.save();
        context.translate(cx, cy);
        context.rotate(angle);
        context.fillStyle = "#E23A3A";
        context.beginPath();
        context.moveTo(0, -11);
        context.lineTo(7, 7);
        context.lineTo(-7, 7);
        context.closePath();
        context.fill();
        context.restore();

        // Halo.
        context.beginPath();
        context.arc(cx, cy, 14, 0, Math.PI * 2);
        context.fillStyle = "rgba(226,58,58,0.12)";
        context.fill();

        // Libellés.
        context.textAlign = "center";
        context.fillStyle = "#e4e4e7";
        context.font = "12px sans-serif";
        context.fillText(player.username ?? player.truckId, cx, cy - 20);
        context.fillStyle = "#a1a1aa";
        context.font = "10px sans-serif";
        context.fillText(`${Math.round(player.speed)} km/h`, cx, cy + 24);
      }

      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={900}
      height={420}
      className="h-[320px] w-full rounded-2xl border border-white/5 bg-charbon-900 sm:h-[420px]"
    />
  );
}
