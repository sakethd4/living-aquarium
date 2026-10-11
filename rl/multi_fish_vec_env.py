"""
Adapter that lets Stable-Baselines3 train on a FishWorld.

SB3's PPO expects a *vectorized environment*: a batch of N environments that
all step together, where env k's data lives at row k of every array. We present
each fish in the shared world as one of those "sub-environments". Every fish is
driven by the same policy, and PPO pools all N fish's experience into one
training batch - that's parameter sharing. The fish aren't independent worlds,
though: they all live in one FishWorld, so they compete for the same food.
"""
import numpy as np
from gymnasium import spaces
from stable_baselines3.common.vec_env import VecEnv

from multi_fish_world import FishWorld, NUM_FISH, OBS_DIM


class FishVecEnv(VecEnv):
    def __init__(self, num_fish=NUM_FISH, seed=None):
        self.world = FishWorld(num_fish=num_fish, seed=seed)
        observation_space = spaces.Box(low=-1.0, high=1.0, shape=(OBS_DIM,), dtype=np.float32)
        action_space = spaces.Box(low=-1.0, high=1.0, shape=(2,), dtype=np.float32)
        self.render_mode = None   # silences SB3's "render_mode not defined" warning
        super().__init__(num_fish, observation_space, action_space)
        self._actions = None

    def reset(self):
        obs = self.world.reset()
        return obs

    def step_async(self, actions):
        self._actions = actions

    def step_wait(self):
        obs, rewards, terminated, truncated = self.world.step(self._actions)

        dones = terminated.copy()
        infos = [{} for _ in range(self.num_envs)]

        if truncated:
            # The whole world hit its time limit: every fish's episode ends at
            # once. This is a time-out, not a failure, so tell PPO to bootstrap
            # from the value of the final observation instead of treating the
            # episode as having ended in a "bad" terminal state.
            dones[:] = True
            for i in range(self.num_envs):
                infos[i]["TimeLimit.truncated"] = not terminated[i]
                infos[i]["terminal_observation"] = obs[i]
            obs = self.world.reset()

        return obs, rewards, dones, infos

    def close(self):
        pass

    # --- bookkeeping methods SB3's VecEnv interface requires; we don't need them ---
    def get_attr(self, attr_name, indices=None):
        return [getattr(self, attr_name)] * len(self._get_indices(indices))

    def set_attr(self, attr_name, value, indices=None):
        setattr(self, attr_name, value)

    def env_method(self, method_name, *method_args, indices=None, **method_kwargs):
        return [getattr(self, method_name)(*method_args, **method_kwargs)
                for _ in self._get_indices(indices)]

    def env_is_wrapped(self, wrapper_class, indices=None):
        return [False] * len(self._get_indices(indices))
