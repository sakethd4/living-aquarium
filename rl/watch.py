"""
Runs one episode with rendering on, so you can visually watch behavior.
"""
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv, VecNormalize
from food_seek_env import FoodSeekEnv


def make_env():
    return FoodSeekEnv(render_mode="human")


model = PPO.load("models/food_seek_ppo")

env = DummyVecEnv([make_env])
env = VecNormalize.load("models/vecnormalize.pkl", env)
env.training = False
env.norm_reward = False

obs = env.reset()
done = False
while not done:
    action, _states = model.predict(obs, deterministic=True)
    obs, reward, dones, info = env.step(action)
    done = dones[0]
    env.envs[0].render()

env.envs[0].close()
