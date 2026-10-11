"""
Watch the group-trained policy: N fish in one FishWorld, all driven by the same
model, sharing one food pool. Fish are colored by energy; a fish that starves is
respawned (same rule as in training) and counted in the title.
"""
import numpy as np
import matplotlib.pyplot as plt
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import VecNormalize

from food_seek_env import MAX_ENERGY
from multi_fish_world import FishWorld, WORLD_WIDTH, WORLD_HEIGHT
from multi_fish_vec_env import FishVecEnv

NUM_STEPS = 3000


def main():
    model = PPO.load("models/multi_fish_ppo")

    # Load the saved normalization stats. FishVecEnv is only here to satisfy
    # VecNormalize.load(); we use the loaded object purely to normalize obs.
    vecnorm = VecNormalize.load("models/multi_vecnormalize.pkl", FishVecEnv())
    vecnorm.training = False
    vecnorm.norm_reward = False

    world = FishWorld()
    obs = world.reset()
    deaths = 0

    plt.ion()
    fig, ax = plt.subplots(figsize=(6, 6))

    for step in range(NUM_STEPS):
        norm_obs = vecnorm.normalize_obs(obs)          # (num_fish, OBS_DIM), whole batch
        actions, _ = model.predict(norm_obs, deterministic=True)
        obs, rewards, terminated, truncated = world.step(actions)
        deaths += int(terminated.sum())
        if truncated:
            obs = world.reset()

        ax.clear()
        ax.set_xlim(0, WORLD_WIDTH)
        ax.set_ylim(0, WORLD_HEIGHT)
        ax.set_facecolor("#0a2a4a")

        ax.scatter(
            [f.x for f in world.foods],
            [f.y for f in world.foods],
            s=[30 * f.maturity + 1 for f in world.foods],
            c=[f.nutrients for f in world.foods],
            cmap="YlGn", vmin=0, vmax=1,
        )
        ax.scatter(
            [f.x for f in world.fish],
            [f.y for f in world.fish],
            s=80,
            c=[f.energy / MAX_ENERGY for f in world.fish],
            cmap="autumn", vmin=0, vmax=1, marker=">",
        )
        m = world.metrics()
        ax.set_title(
            f"step {step}  starved {deaths}  nutrients {m['mean_nutrients']:.2f}\n"
            f"spread {m['patch_spread']:.2f}  on-patch {m['frac_on_patch']:.2f}  "
            f"energy {m['mean_energy']:.0f}",
            fontsize=9,
        )

        plt.pause(0.001)

    plt.close(fig)


if __name__ == "__main__":
    main()
