import gymnasium as gym
from gymnasium import spaces
import numpy as np

# These mirror the constants already tuned in frontend/src/main.js -
# keep them in sync if you retune values on the JS side.
MAX_SPEED = 2.0
MIN_SPEED = 0.2
MAX_ENERGY = 1000.0
ENERGY_LOSS_RATE = 0.5
FOOD_SEEK_RADIUS = 150.0
CANVAS_WIDTH = 1000.0
CANVAS_HEIGHT = 1000.0
FOOD_COUNT = 20
FOOD_GROWTH_RATE = 0.002
OVERGRAZE_PENALTY = 0.3     # nutrients lost per eat event
NUTRIENT_RECOVERY_RATE = 0.001  # nutrients regained per step, regardless of eating
MAX_FORCE = 0.2
FISH_SIZE = 8.0        # fixed body size for this training fish - JS varies size per fish,
                       # but this env trains one representative fish, not a population
FOOD_MAX_RADIUS = 4.0
REPLENISH_FACTOR = 1000.0
MAX_STEPS = 1000


class Food:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.maturity = 1.0   # start fully grown, matches training simplicity
        self.nutrients = 1.0  # 1.0 = full health, 0.0 = fully overgrazed


class FoodSeekEnv(gym.Env):
    """
    A single fish learning to seek food, meant to replace the hand-coded
    seekFood() steering behavior from the JS boids sim.
    """

    def __init__(self):
        # super().__init__() runs the parent class's (gym.Env's) own setup
        # code before ours - standard practice any time you subclass something.
        super().__init__()

        # observation_space describes the shape/bounds of what _get_obs()
        # is allowed to return. Box means "a vector of continuous numbers,
        # each within [low, high]." Since we normalized every value to
        # roughly [-1, 1] (see the math from last message), that's what
        # we declare here.
        self.observation_space = spaces.Box(
            low=-1.0, high=1.0, shape=(6,), dtype=np.float32
        )

        # action_space: not designed yet - placeholder for next step.
        self.action_space = spaces.Box(
            low=-1.0, high=1.0, shape=(2,), dtype=np.float32
        )

        # Runtime state - gets filled in by reset(). Declaring these here
        # (even as None) makes it clear what fields this environment has.
        self.fish_x = None
        self.fish_y = None
        self.fish_vx = None
        self.fish_vy = None
        self.fish_energy = None
        self.foods = None  # list of Food objects
        self.steps_elapsed = None

    def reset(self, seed=None, options=None):
        # Gymnasium passes a `seed` in so runs can be made reproducible -
        # this line seeds Python/NumPy's own random number generator state.
        super().reset(seed=seed)

        self.fish_x = self.np_random.uniform(0, CANVAS_WIDTH)
        self.fish_y = self.np_random.uniform(0, CANVAS_HEIGHT)
        self.fish_vx = 0.0
        self.fish_vy = 0.0
        self.fish_energy = MAX_ENERGY / 2
        self.steps_elapsed = 0

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
        # Find the nearest food, same idea as seekFood() in JS - but since
        # this env never runs out of food, we don't need the "nothing in
        # range" fallback case that the JS version handles.
        nearest = None
        nearest_dist = None
        for food in self.foods:
            dx = food.x - self.fish_x
            dy = food.y - self.fish_y
            dist = np.hypot(dx, dy)
            if nearest_dist is None or dist < nearest_dist:
                nearest = (food.x, food.y)
                nearest_dist = dist

        dx = nearest[0] - self.fish_x
        dy = nearest[1] - self.fish_y
        dist = max(nearest_dist, 1e-6)  # avoid divide-by-zero if dist is ~0

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
        # TODO: implement using FOOD_GROWTH_RATE and NUTRIENT_RECOVERY_RATE,
        # looping over self.foods same way growFood() does in the JS version.
        for food in self.foods:
            food.nutrients = min(1, food.nutrients + NUTRIENT_RECOVERY_RATE)
            food.maturity = min(1, food.maturity + FOOD_GROWTH_RATE * food.nutrients)

    def _try_eat(self):
        # Simplified from eatFood() in JS: no mouth-size gate here since this
        # env trains one fixed-size fish rather than a population with size
        # variation - FISH_SIZE alone determines what's reachable.
        for food in self.foods:
            food_radius = FOOD_MAX_RADIUS * food.maturity
            dx = self.fish_x - food.x
            dy = self.fish_y - food.y
            dist = np.hypot(dx, dy)
            combined_size = FISH_SIZE + food_radius
            if dist <= combined_size:
                self.fish_energy = min(MAX_ENERGY, self.fish_energy + food.maturity * REPLENISH_FACTOR)
                food.maturity = 0.0
                food.nutrients = max(0.0, food.nutrients - OVERGRAZE_PENALTY)

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

        energy_before = self.fish_energy
        self.fish_energy -= ENERGY_LOSS_RATE
        self._try_eat()

        # --- RL-specific: reward is the whole reason this differs from the
        # hand-coded version. There's no "correct formula" for this like there
        # was for steering - it's a design choice about what behavior you want
        # to incentivize. Using the *change* in energy this step means eating
        # is rewarded, ordinary decay is penalized, and the policy never needs
        # a separately hand-tuned bonus - survival and reward are the same
        # signal, which is what "reward" is supposed to represent here.
        reward = self.fish_energy - energy_before

        self.steps_elapsed += 1

        # --- RL-specific: terminated vs truncated are not interchangeable.
        # `terminated` means the episode ended because of something meaningful
        # in the environment itself (the fish starved) - there's no "future"
        # after this to consider. `truncated` means we're cutting the episode
        # off for a practical reason (a time limit) that has nothing to do
        # with the simulation - the fish didn't actually reach an end state,
        # we just stopped watching. PPO/GAE treats these differently: after a
        # truncation it still bootstraps a value estimate for what *would*
        # have happened next, since the world didn't actually end.
        terminated = bool(self.fish_energy <= 0)
        truncated = bool(self.steps_elapsed >= MAX_STEPS)

        observation = self._get_obs()
        info = {}
        return observation, reward, terminated, truncated, info
