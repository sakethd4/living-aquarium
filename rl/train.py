from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import DummyVecEnv, VecNormalize
from stable_baselines3.common.monitor import Monitor
import gymnasium as gym
import food_seek_env


def make_env():
    return Monitor(gym.make("food_seek_env/fishies-v0"))


env = DummyVecEnv([make_env])
env = VecNormalize(env, norm_obs=True, norm_reward=False)

model = PPO("MlpPolicy", env, tensorboard_log="./ppo_fishies_logs", verbose=1)
model.learn(total_timesteps=300000)

model.save("models/food_seek_ppo")
env.save("models/vecnormalize.pkl")
