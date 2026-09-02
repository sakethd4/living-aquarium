import gymnasium as gym
from gymnasium import spaces
from gymnasium.envs.registration import register
import numpy as np
import matplotlib.pyplot as plt

# These mirror the constants already tuned in frontend/src/main.js -
# keep them in sync if you retune values on the JS side.
MAX_SPEED = 2.0
MIN_SPEED = 0.2
MAX_ENERGY = 1000.0
BASE_LOSS_RATE = 0.1
HUNGER_RATE = 0.4
FOOD_SEEK_RADIUS = 150.0
CANVAS_WIDTH = 1000.0
CANVAS_HEIGHT = 1000.0
FOOD_COUNT = 1
FOOD_GROWTH_RATE = .001
OVERGRAZE_PENALTY = 0.5     
NUTRIENT_RECOVERY_RATE = 0.001  
MAX_FORCE = 0.2
FISH_SIZE = 8.0       
SATIATION = 100       
FOOD_MAX_RADIUS = 4.0
REPLENISH_FACTOR = 500.0
MAX_STEPS = 3000


class Food:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.maturity = 1.0   
        self.nutrients = 1.0  


class FoodSeekEnv(gym.Env):
    """
    A single fish learning to seek food, meant to replace the hand-coded
    seekFood() steering behavior from the JS boids sim.
    """

    def __init__(self, render_mode=None):
        super().__init__()

        self.render_mode = render_mode
        self._fig = None
        self._ax = None

        self.observation_space = spaces.Box(
            low=-1.0, high=1.0, shape=(6,), dtype=np.float32
        )

        self.action_space = spaces.Box(
            low=-1.0, high=1.0, shape=(2,), dtype=np.float32
        )

        self.fish_x = None
        self.fish_y = None
        self.fish_vx = None
        self.fish_vy = None
        self.fish_energy = None
        self.foods = None  
        self.steps_elapsed = None
        self.last_ate = None

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)

        self.fish_x = self.np_random.uniform(0, CANVAS_WIDTH)
        self.fish_y = self.np_random.uniform(0, CANVAS_HEIGHT)
        self.fish_vx = 0.0
        self.fish_vy = 0.0
        self.fish_energy = MAX_ENERGY / 2
        self.steps_elapsed = 0
        self.last_ate = 0

        self.foods = [
            Food(
                self.np_random.uniform(0, CANVAS_WIDTH),
                self.np_random.uniform(0, CANVAS_HEIGHT),
            )
            for _ in range(FOOD_COUNT)
        ]

        observation = self._get_obs()
        info = {}
        return observation, info

    def _get_obs(self):
        score = None
        max_score = None
        for food in self.foods:
            dx = food.x - self.fish_x
            dy = food.y - self.fish_y
            dist = np.hypot(dx, dy)
            score = food.maturity / (dist + 1e-6)
            if max_score is None or score > max_score:
                best_food = (food.x, food.y)
                max_score = score

        dx = best_food[0] - self.fish_x
        dy = best_food[1] - self.fish_y
        dist = max(np.hypot(dx, dy), 1e-6) 

        dir_x = dx / dist
        dir_y = dy / dist
        dist_norm = min(dist / FOOD_SEEK_RADIUS, 1.0)
        energy_norm = self.fish_energy / MAX_ENERGY
        vx_norm = self.fish_vx / MAX_SPEED
        vy_norm = self.fish_vy / MAX_SPEED

        return np.array(
            [dir_x, dir_y, dist_norm, energy_norm, vx_norm, vy_norm],
            dtype=np.float32,
        )

    def _grow_foods(self):
        """
        Called once per step, for every food patch. Should:
          1. let nutrients recover slightly (min-capped at 1.0)
          2. grow maturity, scaled by the patch's current nutrients
             (so a depleted patch grows slowly or not at all),
             capped at 1.0
        Nothing here reduces nutrients - that happens separately,
        wherever eating gets implemented, since it's triggered by an
        event (a fish eating) rather than something that happens
        every step regardless.
        """
        for food in self.foods:
            food.nutrients = min(1, food.nutrients + NUTRIENT_RECOVERY_RATE)
            food.maturity = min(1, food.maturity + FOOD_GROWTH_RATE * food.nutrients)

    def _try_eat(self):
        for food in self.foods:
            food_radius = FOOD_MAX_RADIUS * food.maturity
            dx = self.fish_x - food.x
            dy = self.fish_y - food.y
            dist = np.hypot(dx, dy)
            combined_size = FISH_SIZE + food_radius
            if dist <= combined_size:
                self.fish_energy = min(MAX_ENERGY, self.fish_energy + food.maturity * REPLENISH_FACTOR)
                self.last_ate = 0
                food.maturity = 0.0
                food.nutrients = max(0.0, food.nutrients - OVERGRAZE_PENALTY)

    def render(self):
        if self.render_mode != "human":
            return

        if self._fig is None:
            plt.ion()  # interactive mode - lets the plot update without blocking the script
            self._fig, self._ax = plt.subplots(figsize=(6, 6))

        ax = self._ax
        ax.clear()
        ax.set_xlim(0, CANVAS_WIDTH)
        ax.set_ylim(0, CANVAS_HEIGHT)
        ax.set_facecolor("#0a2a4a")

        food_x = [food.x for food in self.foods]
        food_y = [food.y for food in self.foods]
        # size scales with maturity so you can see patches grow back after being eaten;
        # color scales with nutrients so an overgrazed patch visibly looks unhealthy
        food_sizes = [30 * food.maturity + 1 for food in self.foods]
        food_colors = [food.nutrients for food in self.foods]
        ax.scatter(food_x, food_y, s=food_sizes, c=food_colors, cmap="YlGn", vmin=0, vmax=1)

        ax.scatter([self.fish_x], [self.fish_y], s=120, c="orange", marker=">")
        ax.set_title(f"energy: {self.fish_energy:.0f}  step: {self.steps_elapsed}")

        plt.pause(0.001)  # briefly hands control to matplotlib so it can redraw

    def close(self):
        if self._fig is not None:
            plt.close(self._fig)
            self._fig = None
            self._ax = None

    def step(self, action):
        steer_x = action[0] * MAX_FORCE
        steer_y = action[1] * MAX_FORCE
        self.fish_vx += steer_x
        self.fish_vy += steer_y

        speed = np.hypot(self.fish_vx, self.fish_vy)
        if speed > MAX_SPEED:
            self.fish_vx = (self.fish_vx / speed) * MAX_SPEED
            self.fish_vy = (self.fish_vy / speed) * MAX_SPEED
        elif speed > 0 and speed < MIN_SPEED:
            self.fish_vx = (self.fish_vx / speed) * MIN_SPEED
            self.fish_vy = (self.fish_vy / speed) * MIN_SPEED

        # wrap at the edges, same torus topology as the JS canvas
        self.fish_x = (self.fish_x + self.fish_vx) % CANVAS_WIDTH
        self.fish_y = (self.fish_y + self.fish_vy) % CANVAS_HEIGHT

        self._grow_foods()

        
        ramp = (2/np.pi) * np.arctan(self.last_ate / SATIATION)
        loss_rate = BASE_LOSS_RATE + HUNGER_RATE * ramp
        self.fish_energy -= loss_rate
        energy_before_eat = self.fish_energy
        self._try_eat()
        gained = self.fish_energy - energy_before_eat
        self.last_ate += 1     
        reward = -loss_rate + (gained * ramp) / 6

        self.steps_elapsed += 1

        terminated = bool(self.fish_energy <= 0)
        truncated = bool(self.steps_elapsed >= MAX_STEPS)

        observation = self._get_obs()
        info = {}
        return observation, reward, terminated, truncated, info

register (
    id="food_seek_env/fishies-v0",
    entry_point="food_seek_env:FoodSeekEnv"
)
