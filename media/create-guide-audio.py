#!/usr/bin/env python3
"""Render original music and scene cues for the 45-second usage guide.

Requires Python 3 and NumPy. Writes a stereo PCM WAV; see README.md for muxing.
All tones and percussion are synthesized here, without external samples.
"""

import argparse
import wave
from pathlib import Path

import numpy as np


RATE = 48_000
DURATION = 45
BPM = 112
BEAT = 60 / BPM


def render(destination: Path) -> None:
    rng = np.random.default_rng(20261002)
    music = np.zeros((RATE * DURATION, 2), dtype=np.float64)
    cues = np.zeros_like(music)

    def add(track, sound, start, gain, pan=0):
        first = round(start * RATE)
        count = min(len(sound), len(track) - first)
        if first < 0 or count <= 0:
            return
        angle = (pan + 1) * np.pi / 4
        track[first:first + count, 0] += sound[:count] * gain * np.cos(angle)
        track[first:first + count, 1] += sound[:count] * gain * np.sin(angle)

    def tone(note, duration, voice="pluck"):
        t = np.arange(round(duration * RATE)) / RATE
        hz = 440 * 2 ** ((note - 69) / 12)
        attack = 1 - np.exp(-t / 0.005)
        if voice == "bass":
            signal = np.sin(2 * np.pi * hz * t)
            signal += 0.16 * np.sin(2 * np.pi * hz * 2 * t)
            decay = np.exp(-t / 0.3)
        elif voice == "bell":
            signal = np.sin(2 * np.pi * hz * t) * np.exp(-t / 0.35)
            signal += 0.32 * np.sin(2 * np.pi * hz * 2.006 * t) * np.exp(-t / 0.12)
            signal += 0.09 * np.sin(2 * np.pi * hz * 3.96 * t) * np.exp(-t / 0.065)
            decay = np.ones_like(t)
        else:
            signal = np.sin(2 * np.pi * hz * t)
            signal += 0.38 * np.sin(2 * np.pi * hz * 2 * t)
            signal += 0.16 * np.sin(2 * np.pi * hz * 3 * t)
            signal += 0.05 * np.sin(2 * np.pi * hz * 4 * t)
            decay = np.exp(-t / 0.17)
        release = np.clip((duration - t) / 0.045, 0, 1)
        return signal * attack * decay * release

    def kick():
        t = np.arange(round(0.23 * RATE)) / RATE
        phase = 2 * np.pi * (48 * t + 22 * 0.025 * (1 - np.exp(-t / 0.025)))
        return np.sin(phase) * np.exp(-t / 0.065) * (1 - np.exp(-t / 0.003))

    def shaker():
        t = np.arange(round(0.07 * RATE)) / RATE
        noise = rng.normal(0, 1, len(t))
        # A softened noise transient, not a sharp click.
        noise = np.convolve(noise, np.ones(4) / 4, mode="same")
        return noise * np.exp(-t / 0.015) * (1 - np.exp(-t / 0.002))

    chords = [
        (48, [60, 64, 67, 71]),  # Cmaj7
        (45, [57, 60, 64, 67]),  # Am7
        (41, [57, 60, 64, 65]),  # Fmaj7
        (43, [55, 59, 62, 67]),  # G
    ]
    melody = [
        [(76, .5), (79, .5), (81, 1), (79, .5), (76, .5), (74, .5), (72, .5)],
        [(76, .5), (79, .5), (76, .5), (72, .5), (69, 1), (72, .5), (76, .5)],
        [(77, .5), (81, .5), (79, 1), (76, .5), (74, .5), (72, 1)],
        [(74, .5), (79, .5), (81, .5), (79, .5), (74, 1), (76, .5), (79, .5)],
        [(79, .5), (76, .5), (72, 1), (74, .5), (76, .5), (79, .5), (76, .5)],
        [(76, .5), (74, .5), (72, .5), (69, .5), (72, 1), (76, 1)],
        [(77, 1), (76, .5), (74, .5), (72, 1), (74, .5), (76, .5)],
        [(79, .5), (74, .5), (71, 1), (74, .5), (76, .5), (72, 1)],
    ]

    # Leave room for a gentle closing cadence instead of cutting a phrase off.
    for bar in range(20):
        start = bar * 4 * BEAT
        root, chord = chords[bar % len(chords)]
        for beat in range(4):
            at = start + beat * BEAT
            add(music, tone(root if beat % 2 == 0 else root + 7, .65, "bass"), at, .10)
            if beat % 2 == 0:
                add(music, kick(), at, .065)
            for off in (0, .5):
                add(music, shaker(), at + off * BEAT, .014, .25 if off else -.25)
            for string, note in enumerate(chord):
                add(music, tone(note, .55), at + .022 * string, .031, -.23)
        cursor = start
        for index, (note, beats) in enumerate(melody[bar % len(melody)]):
            # Small deterministic variations keep repeated phrases relaxed.
            add(music, tone(note, max(.3, beats * BEAT + .18), "bell"),
                cursor + .015, .083 if index % 2 == 0 else .072, .2)
            cursor += beats * BEAT

    # Resolve into C for the final screen, with no percussion under the ending.
    cadence = 20 * 4 * BEAT
    for i, note in enumerate([60, 64, 67, 72]):
        add(music, tone(note, 1.75, "bell"), cadence + i * .06, .09, (i - 1.5) * .12)
    add(music, tone(48, 1.5, "bass"), cadence, .1)

    # Major chapter changes: a restrained ascending two-note cue.
    for at in (4, 11, 17, 25, 32, 39):
        add(cues, tone(79, .45, "bell"), at, .14, -.15)
        add(cues, tone(84, .5, "bell"), at + .11, .12, .15)
    # Intermediate actions: one small wooden pluck.
    for at in (7.5, 14, 21, 28.5, 35.5):
        add(cues, tone(76, .17), at, .11)

    time = np.arange(len(music)) / RATE
    # Briefly lower the accompaniment around cues so they stay soft but clear.
    duck = np.ones(len(music))
    for at in (4, 7.5, 11, 14, 17, 21, 25, 28.5, 32, 35.5, 39):
        duck -= .2 * np.exp(-((time - (at + .08)) / .16) ** 2)
    mix = music * duck[:, None] + cues
    fade = np.minimum(np.clip(time / .6, 0, 1), np.clip((DURATION - time) / 1.8, 0, 1))
    mix *= fade[:, None]
    peak = np.max(np.abs(mix))
    mix *= .78 / max(peak, .78)
    pcm = np.round(mix * 32767).astype("<i2")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destination), "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(pcm.tobytes())
    print(f"Rendered {DURATION}s original stereo music and scene cues: {destination}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="destination PCM WAV file")
    render(parser.parse_args().output)
