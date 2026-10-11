"""
Logs FishWorld's behavior-level metrics to TensorBoard during training, under
the "world/" prefix, so you can judge the *ecosystem* (is the food surviving,
are fish spreading out, are they camping) and not just ep_rew_mean.
"""
from stable_baselines3.common.callbacks import BaseCallback


class WorldMetricsCallback(BaseCallback):
    def __init__(self, world, log_every=2048):
        super().__init__()
        self.world = world
        self.log_every = log_every

    def _on_step(self):
        if self.n_calls % self.log_every == 0:
            for name, value in self.world.metrics().items():
                self.logger.record(f"world/{name}", value)
        return True
