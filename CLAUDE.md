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
finished aquarium. **Default to guiding over doing** for the actual boids/energy/RL logic
that is the point of each phase — "guiding" means a clear step-by-step walkthrough with the
reasoning shown, not a series of open-ended questions waiting for the user to guess the answer:

- For each step, explain the *intuition* first (what real-world behavior this models), then
  the *reasoning* (why this approach over alternatives), then the *math/formula*, then break it
  into concrete sub-steps. Show the work, don't just assert the formula.
- Whether Claude or the user writes the code depends on the step:
  - Boilerplate/glue (Vite config, canvas wiring, venv setup, data plumbing) — write it directly.
  - Core boids/energy/RL logic that is the learning point of the current phase — give the full
    walkthrough (intuition/reasoning/math/pseudocode) but leave the final implementation for the
    user to type, so they still build the muscle memory for it.
  - Use judgment for anything in between: once a formula has been derived together and a piece
    is small and mechanical (e.g. clamping a value, wiring the derived formula into the existing
    loop), it's fine to just write it rather than making the user transcribe it verbatim.
  - When unsure which bucket a step falls into, explain it fully and ask directly whether the
    user wants to write it or have it written, rather than silently picking one.
- When reviewing an attempt or debugging, explain the reasoning behind what's wrong — but once
  the relevant concept has been walked through, it's fine to state the bug and the fix directly
  rather than only asking questions and waiting for the user to find it themselves.
- Surface **one issue at a time** as "here's a good first step, and here's why" — not a dumped
  list of everything wrong. Only bundle multiple issues together when they're strongly
  interconnected (e.g. one bug's fix depends on understanding another). Let the user come back
  for the next one once the current one is resolved.
- Always re-read the actual current state of the file being discussed before answering or
  suggesting changes — don't rely on what a file looked like earlier in the conversation. The
  user edits files directly between messages, so a stale in-context version can lead to advice
  about code that no longer exists or missing bugs/changes they just made.

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

**Shared config:** constants that must match between the live sim and the training world
(speeds, steering force, separation, energy, food economy) live in
[shared/sim_config.json](shared/sim_config.json), read by `frontend/src/main.js` (JSON import;
`frontend/vite.config.js` allows the dev server to serve the parent folder) and
`rl/config.py`. **Python is authoritative**: when the sides disagree, the values the policy
trains on win. Derived values (averages, sense radii, cell sizes) are computed in code, not
stored in the JSON. Population sizes are *not* shared as raw counts: the config holds a
`density` (fish per patch, patches per megapixel, derived from the JS sim at fullscreen
1920x1080), and each side derives its own counts from its own world size (JS from the canvas
area; `rl/multi_fish_world.py` from `FOOD_COUNT`, giving 25 fish on a ~322px world) so the
policy trains at the same local crowding it will see live. JS-only (rendering/parallax/boid weights) and RL-only (reward scale, fish
count, observation radii) constants stay in their own files. Sharing numbers does not share
equations — the JS energy model (size/speed-based loss) still differs from the Python
satiation curve.

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
Training and viewing (from `rl/`, venv active): `python train.py` / `python watch.py`
(single fish), `python train_group.py` / `python watch_group.py` (8 fish sharing food,
metrics under `world/` in TensorBoard: `tensorboard --logdir ./ppo_multi_logs`). There is no
lint or test setup.

## Current state

- **Frontend** ([frontend/src/main.js](frontend/src/main.js)): boids (separation, alignment,
  FOV-weighted cohesion), spatial-grid neighbor search, depth/parallax visuals, energy and
  food (maturity, hunger-weighted seeking) are built. No RL inference yet.
- **RL** (`rl/`): `food_seek_env.py` is the single-fish Gymnasium env; `multi_fish_world.py`
  + `multi_fish_vec_env.py` are the multi-fish world (shared food, hand-coded separation,
  nearest-fish and patch-nutrient observations, respawn on starvation) and its SB3 `VecEnv`
  adapter (PettingZoo/SuperSuit were skipped — SuperSuit needs a C++ compiler on Windows).
  Both use `VecNormalize(norm_obs=True, norm_reward=False)` plus `VecMonitor`/`Monitor`.
- The inference server and frontend/RL integration are not built yet.
