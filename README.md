# Living Aquarium

A projected, continuously-running artificial ecosystem — boids-style fish, predators,
growing food, evolution, and eventually RL-driven behavior — built to look like digital
art on a wall, not a simulation debug view.

## Stack split

- `frontend/` — JS/Canvas (or WebGL later) for rendering, the environment loop (energy,
  food growth, reproduction, death), and eventually webcam/CV input. This is what
  actually runs on the wall display.
- `rl/` — Python (PyTorch / Stable-Baselines3 or similar) for training prey/predator
  policies. Trained policies get exported (ONNX or raw weights) and run as inference
  in the frontend, or the frontend calls out to a small Python inference server —
  TBD once we get there.

## Phases

1. Beautiful aquarium — fish render and swim, no logic yet
2. Boids — separation, alignment, cohesion
3. Food — energy, growth, seeking behavior
4. RL prey — PPO replaces hand-coded food-seeking
5. Predators — separate PPO policy
6. Reproduction — birth/death cycle
7. Evolution — mutated traits across generations
8. Environmental cycles — day/night, seasons, random events
9. Computer vision — webcam turns the viewer into part of the ecosystem
10. Persistent world — left running, evolves over time

Currently on: **Phase 1**.

## Running the frontend

```
cd frontend
npm install
npm run dev
```

## RL environment (later)

```
cd rl
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```
