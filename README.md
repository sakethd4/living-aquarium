# Living Aquarium

A living digital aquarium built to run continuously as ambient art on a wall. The project explores schooling behavior, a shared food ecosystem, and reinforcement learning, with the longer-term goal of an evolving world that responds to its surroundings.

## Current state

The JavaScript simulation has swimming fish with boids-style schooling, depth and parallax, growing food, and hunger-driven food seeking. Fish spend energy as they move and replenish it by eating.

The Python side trains fish to forage using PPO, with both single-fish and shared-world environments. In the shared world, fish compete for food, sense nearby fish and food-patch nutrients, and respawn after starvation. TensorBoard tracks training progress and ecosystem behavior.

## JavaScript simulation

<img width="638" height="456" alt="image" src="https://github.com/user-attachments/assets/70e86926-7fa6-4373-8826-eec62b5ce70a" />

## Training progress

TensorBoard includes PPO training metrics alongside ecosystem measures such as fish energy, food nutrients, and how fish spread across food patches.

<img width="635" height="334" alt="image" src="https://github.com/user-attachments/assets/7e0157d2-6976-4ddc-a72e-a6439be6373b" />

## Project layout

- **`frontend/`** — JavaScript, Vite, and Canvas 2D for the live aquarium.
- **`rl/`** — Python, Gymnasium, Stable-Baselines3, and PyTorch for training and viewing learned policies.
- **`shared/`** — Simulation settings used by both sides, including movement, energy, food, and population density. The browser and training environments are separate implementations.

## Run the aquarium

With Node.js and npm installed:

```sh
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Use `npm run build` to create a production build.

## Train and explore

Set up the Python environment from the repository root (Windows PowerShell):

```powershell
cd rl
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Train a policy and then watch it in the Python viewer:

```sh
python train_group.py
python watch_group.py
```

For the single-fish experiment, use `python train.py` and `python watch.py` instead. Training saves the policy and observation-normalization statistics under `rl/models/`.

View the group training logs in TensorBoard from `rl/`:

```sh
tensorboard --logdir ./ppo_multi_logs
```

Open the local URL printed by TensorBoard. Single-fish logs are in `ppo_fishies_logs`.

## Where it is headed

The next step is bringing learned foraging into the live aquarium. Later phases explore predators, reproduction, evolving traits, environmental cycles, webcam interaction, and a persistent ecosystem.
