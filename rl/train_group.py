from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import VecMonitor, VecNormalize
from multi_fish_vec_env import FishVecEnv


env = FishVecEnv()
env = VecMonitor(env)
env = VecNormalize(env, norm_obs=True, norm_reward=False)

model = PPO("MlpPolicy", env, tensorboard_log="./ppo_multi_logs", verbose=1)
model.learn(total_timesteps=900000)

model.save("models/multi_fish_ppo")
env.save("models/multi_vecnormalize.pkl")
