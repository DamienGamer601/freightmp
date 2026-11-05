"""Génère les sons d'interface du launcher FreightMP — version DOUCE 2026.

Pur Python (wave + math + random), 44,1 kHz, 16 bits mono.
Objectif : sons feutrés, jamais agressifs (basses fréquences, attaques
progressives, harmoniques limitées, normalisation à faible niveau).
"""

from __future__ import annotations

import math
import os
import random
import struct
import wave

SAMPLE_RATE = 44100
OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "launcher",
    "renderer",
    "sounds",
)

# Niveau de crête global : bas = feutré.
PEAK = 0.5


def write_wav(name: str, samples: list[float]) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    peak = max(1e-9, max(abs(s) for s in samples))
    scale = PEAK / peak
    with wave.open(path, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        frames = bytearray()
        for s in samples:
            v = int(max(-1.0, min(1.0, s * scale)) * 32767)
            frames += struct.pack("<h", v)
        wav.writeframes(bytes(frames))
    print(f"  {name} ({len(samples) / SAMPLE_RATE * 1000:.0f} ms)")


def smooth_env(n: int, attack: float, decay: float) -> list[float]:
    """Attaque douce + décroissance exponentielle."""
    out = []
    attack_n = max(1, int(attack * SAMPLE_RATE))
    for i in range(n):
        if i < attack_n:
            a = 0.5 - 0.5 * math.cos(math.pi * (i / attack_n))
        else:
            a = math.exp(-(i - attack_n) / (decay * SAMPLE_RATE))
        out.append(a)
    return out


def lowpass(values: list[float], alpha: float) -> list[float]:
    out = []
    prev = 0.0
    for v in values:
        prev = prev + alpha * (v - prev)
        out.append(prev)
    return out


def click() -> list[float]:
    n = int(0.1 * SAMPLE_RATE)
    env = smooth_env(n, 0.004, 0.02)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        s = (
            0.6 * math.sin(2 * math.pi * 780 * t)
            + 0.25 * math.sin(2 * math.pi * 1170 * t)
            + 0.05 * (random.random() * 2 - 1)
        )
        out.append(s * env[i])
    return lowpass(out, 0.35)


def hover() -> list[float]:
    n = int(0.07 * SAMPLE_RATE)
    env = smooth_env(n, 0.005, 0.012)
    return [
        math.sin(2 * math.pi * 620 * (i / SAMPLE_RATE)) * env[i] * 0.55
        for i in range(n)
    ]


def success() -> list[float]:
    n = int(0.6 * SAMPLE_RATE)
    env = smooth_env(n, 0.02, 0.18)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        vib = 1.0 + 0.003 * math.sin(2 * math.pi * 4 * t)
        # Accord chaud G4-C5-E5 (plus grave = plus doux).
        s = (
            0.45 * math.sin(2 * math.pi * 392.0 * t * vib)
            + 0.3 * math.sin(2 * math.pi * 523.25 * t * vib)
            + 0.16 * math.sin(2 * math.pi * 659.25 * t * vib)
        )
        out.append(s * env[i])
    return lowpass(out, 0.3)


def error() -> list[float]:
    n = int(0.35 * SAMPLE_RATE)
    env = smooth_env(n, 0.01, 0.1)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        s = (
            0.7 * math.sin(2 * math.pi * 150 * t)
            + 0.3 * math.sin(2 * math.pi * 75 * t)
        )
        out.append(math.tanh(s * 0.9) * env[i])
    return lowpass(out, 0.18)


def notify() -> list[float]:
    n = int(0.6 * SAMPLE_RATE)
    env = smooth_env(n, 0.01, 0.22)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        s = (
            0.6 * math.sin(2 * math.pi * 660 * t)
            + 0.25 * math.sin(2 * math.pi * 990 * t)
        )
        out.append(s * env[i])
    return lowpass(out, 0.35)


def whoosh() -> list[float]:
    n = int(0.45 * SAMPLE_RATE)
    out = []
    prev = 0.0
    for i in range(n):
        progress = i / n
        alpha = 0.015 + 0.12 * progress
        noise = random.random() * 2 - 1
        prev = prev + alpha * (noise - prev)
        envelope = math.sin(math.pi * progress) ** 2
        out.append(prev * envelope * 0.6)
    return lowpass(out, 0.4)


def start() -> list[float]:
    """Démarrage : deux notes montantes douces (C4 → G4)."""
    n = int(0.9 * SAMPLE_RATE)
    env = smooth_env(n, 0.03, 0.35)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        blend = min(1.0, t / 0.35)
        freq = 261.63 * (1 - blend) + 392.0 * blend
        s = math.sin(2 * math.pi * freq * t) * 0.7 + math.sin(
            2 * math.pi * freq * 2 * t
        ) * 0.12
        out.append(s * env[i])
    return lowpass(out, 0.3)


def login() -> list[float]:
    """Connexion : petit arpège C5-E5-G5 doux."""
    n = int(0.8 * SAMPLE_RATE)
    env = smooth_env(n, 0.015, 0.25)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        stage = min(2, int(t / 0.12))
        freq = [523.25, 659.25, 783.99][stage]
        s = math.sin(2 * math.pi * freq * t) * 0.6 + math.sin(
            2 * math.pi * freq * 1.5 * t
        ) * 0.12
        out.append(s * env[i])
    return lowpass(out, 0.32)


def update() -> list[float]:
    """Mise à jour : double « ding » discret, montée douce."""
    n = int(0.7 * SAMPLE_RATE)
    env = smooth_env(n, 0.01, 0.28)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        freq = 440.0 if t < 0.22 else 587.33
        s = math.sin(2 * math.pi * freq * t) * 0.55 + math.sin(
            2 * math.pi * freq * 2 * t
        ) * 0.15
        out.append(s * env[i])
    return lowpass(out, 0.35)


def main() -> None:
    print(f"Génération des sons (doux) dans {OUT_DIR}")
    write_wav("click.wav", click())
    write_wav("hover.wav", hover())
    write_wav("success.wav", success())
    write_wav("error.wav", error())
    write_wav("notify.wav", notify())
    write_wav("whoosh.wav", whoosh())
    write_wav("start.wav", start())
    write_wav("login.wav", login())
    write_wav("update.wav", update())
    print("Terminé.")


if __name__ == "__main__":
    main()
