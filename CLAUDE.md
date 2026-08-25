# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A continuously-running artificial ecosystem (boids-style fish, predators, growing food,
evolution, eventually RL-driven behavior) meant to be projected on a wall as ambient
digital art — not a simulation debug view. See [README.md](README.md) for the full
phase roadmap and visual intent.

The project is being built in ordered phases (1: static rendering → ... → 10: persistent
world with CV input). **Check the "Currently on" line in README.md before adding
functionality from a later phase** — e.g. don't wire up RL policies or reproduction/death
before boids and energy/food are in place, since each phase is meant to build cleanly on
the last.

## This is a learning project, not a delivery task

The person building this is a student using it to learn JS/Canvas visual programming and RL
(Gymnasium, Stable-Baselines3, PPO, multi-agent RL) — the goal is understanding, not just a
finished aquarium. **Default to teaching over doing** for the actual boids/energy/RL logic
that is the point of each phase:

- Don't hand over a full working implementation when the user is trying to learn the concept
  behind it. Break the step into a small, well-scoped piece, explain the *interface/contract*
  (what it should take in, what it should produce, what invariant it must hold) without writing
  the body, and let them attempt it first.
- Ask questions that make them reason about the next step rather than stating the answer —
  e.g. "what should happen to a fish's velocity if it's both attracted to the school and
  repelled by a predator?" rather than supplying the blending formula.
- When they share an attempt, check it by asking what it does in edge cases (empty inputs,
  zero neighbors, energy at 0) rather than immediately rewriting it.
- It's fine to just write code directly for boilerplate/glue the project needs but isn't the
  learning point (Vite config, venv setup, wiring up a canvas element) — the Socratic approach
  applies to the boids/food/energy/RL logic itself, not scaffolding.
- The `guide-me` and `quiz-me` skills (in `.claude/skills/`) implement this concretely: `guide-me`
  walks through a spec/plan step by step without writing code for the user, `quiz-me` verifies
  understanding of a diff/spec/plan via questions before moving on. Use this mode as the default
  posture on this repo even outside their exact trigger phrases.

## Stack split (important architectural boundary)

- `frontend/` — JS + Vite + Canvas2D (WebGL later). Owns rendering, the live environment
  loop (energy, food growth, reproduction, death, day/night, eventually webcam/CV input).
  **This is the process that actually runs on the wall display**, continuously.
- `rl/` — Python (Gymnasium + Stable-Baselines3 + PyTorch). Owns training prey/predator
  policies offline. Trained policies get exported (ONNX or raw weights) and are expected
  to run as inference inside the frontend, or the frontend calls out to a small Python
  inference server — this boundary is explicitly TBD and should be decided when Phase 4
  (RL prey) starts, not assumed in advance.

Do not blur this split by, e.g., putting simulation/environment rules inside the RL
training code, or training loops inside the frontend. The environment (physics, energy,
growth, spawning) is meant to stay conventional/rule-based; only the fish/predator
policies themselves are learned.

## Commands

Frontend (from `frontend/`):
```
npm install
npm run dev       # vite dev server
npm run build     # vite build
npm run preview   # preview production build
```
There is no lint or test setup yet in `frontend/`.

RL (from `rl/`):
```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```
There is no training entrypoint, environment implementation, or test setup yet in `rl/`
— it currently contains only `requirements.txt` (gymnasium, stable-baselines3, torch,
numpy). This will need a Gymnasium-compatible env before any training code is useful.

## Current state

[frontend/src/main.js](frontend/src/main.js) is a bare scaffold — canvas sizing/resize and
an empty `requestAnimationFrame` loop, no fish/boids/energy/food/RL logic yet. That's
intentional: Phase 1 (and beyond) is meant to be implemented by the user as a learning
exercise, not pre-built. Treat anything described in the README as roadmap, not
implemented behavior.
