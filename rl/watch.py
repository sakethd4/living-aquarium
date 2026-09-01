"""
Runs one episode with rendering on, so you can visually watch behavior.
Uses random actions until a trained model exists - swap in a loaded
PPO model here once training is set up.
"""
from food_seek_env import FoodSeekEnv

env = FoodSeekEnv(render_mode="human")
obs, info = env.reset()

terminated = False
truncated = False
while not (terminated or truncated):
    action = env.action_space.sample()  # TODO: replace with a trained model's action once training exists
    obs, reward, terminated, truncated, info = env.step(action)
    env.render()

env.close()
