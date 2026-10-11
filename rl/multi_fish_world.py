"""
Multi-fish world: N fish sharing one food pool, all controlled by the same
policy (parameter sharing). This is the plain simulation - no RL API in here.
multi_fish_vec_env.FishVecEnv wraps it as an SB3 VecEnv so PPO can train on it.

Each step: policy steering + hand-coded separation (matching the JS sim) move
every fish; food grows once globally; fish eat from the shared pool; a fish that
starves is respawned so the population stays constant (parameter sharing wants
a fixed number of agents).
"""
import numpy as np

from food_seek_env import (
    Food,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    FOOD_COUNT,
    FOOD_GROWTH_RATE,
    NUTRIENT_RECOVERY_RATE,
    OVERGRAZE_PENALTY,
    REPLENISH_FACTOR,
    FOOD_MAX_RADIUS,
    FISH_SIZE,
    FOOD_SEEK_RADIUS,
    MAX_ENERGY,
    MAX_SPEED,
    MIN_SPEED,
    MAX_FORCE,
    SATIATION,
    BASE_LOSS_RATE,
    HUNGER_RATE,
    MAX_STEPS,
)

# Separation constants mirror frontend/src/main.js - keep them in sync.
SEPARATION_RADIUS = 75.0
SEPARATION_WEIGHT = 0.9
MIN_FELT_DIST = 10.0
OTHER_FISH_RADIUS = 2 * SEPARATION_RADIUS   # beyond this, "nobody close"

NUM_FISH = 8
REWARD_SCALE = 6.0   # divisor on the eating term, same as food_seek_env
OBS_DIM = 9          # 6 food/self features + 3 nearest-other-fish features


class Fish:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.vx = 0.0
        self.vy = 0.0
        self.energy = MAX_ENERGY / 2
        self.last_ate = 0


class FishWorld:
    def __init__(self, num_fish=NUM_FISH, seed=None):
        self.num_fish = num_fish
        self.rng = np.random.default_rng(seed)
        self.fish = []
        self.foods = []
        self.steps_elapsed = 0

    # ---------------------------------------------------------------- setup
    def _random_fish(self):
        return Fish(
            self.rng.uniform(0, CANVAS_WIDTH),
            self.rng.uniform(0, CANVAS_HEIGHT),
        )

    def reset(self, seed=None):
        if seed is not None:
            self.rng = np.random.default_rng(seed)
        self.steps_elapsed = 0
        self.fish = [self._random_fish() for _ in range(self.num_fish)]
        self.foods = [
            Food(
                self.rng.uniform(0, CANVAS_WIDTH),
                self.rng.uniform(0, CANVAS_HEIGHT),
            )
            for _ in range(FOOD_COUNT)
        ]
        return self._get_all_obs()

    # ---------------------------------------------------------- observation
    def _get_obs(self, i):
        """
        Observation for fish i, shape (OBS_DIM,), float32:
        [dir_x, dir_y, dist_norm, energy_norm, vx_norm, vy_norm,
         other_dir_x, other_dir_y, other_dist_norm]
        """
        fish = self.fish[i]

        # --- food part: identical to FoodSeekEnv._get_obs(), shared foods ---
        max_score = None
        best_food = None
        for food in self.foods:
            dx = food.x - fish.x
            dy = food.y - fish.y
            dist = np.hypot(dx, dy)
            score = food.maturity / (dist + 1e-6)
            if max_score is None or score > max_score:
                best_food = (food.x, food.y)
                max_score = score

        dx = best_food[0] - fish.x
        dy = best_food[1] - fish.y
        dist = max(np.hypot(dx, dy), 1e-6)

        dir_x = dx / dist
        dir_y = dy / dist
        dist_norm = min(dist / FOOD_SEEK_RADIUS, 1.0)
        energy_norm = fish.energy / MAX_ENERGY
        vx_norm = fish.vx / MAX_SPEED
        vy_norm = fish.vy / MAX_SPEED

        # --- TODO (yours): nearest other fish ---------------------------------
        # Find the closest *other* fish (skip index i) and fill in:
        #   other_dir_x, other_dir_y : unit vector from this fish toward it
        #   other_dist_norm          : distance scaled to [0, 1]
        # Things to decide: what to use as the normalizing radius, and what
        # to report when no other fish exists / none is near (the policy needs
        # a value that clearly means "nobody close").
        closest = OTHER_FISH_RADIUS
        other_dir_x = 0.0
        other_dir_y = 0.0
        other_dist_norm = 1.0

        for index, fishy in enumerate(self.fish):
            if index == i:
                continue
            odx = fishy.x - fish.x
            ody = fishy.y - fish.y
            odist = np.hypot(odx, ody)
            if odist < closest:
                closest = odist
                odist = max(odist, 1e-6)
                other_dir_x = odx / odist
                other_dir_y = ody / odist
                other_dist_norm = closest / OTHER_FISH_RADIUS

        return np.array(
            [dir_x, dir_y, dist_norm, energy_norm, vx_norm, vy_norm,
             other_dir_x, other_dir_y, other_dist_norm],
            dtype=np.float32,
        )

    def _get_all_obs(self):
        return np.stack([self._get_obs(i) for i in range(self.num_fish)])

    # ------------------------------------------------------------- physics
    def _separation(self, i):
        """
        Reynolds separation, ported from seperation() in main.js: push away
        from nearby fish, weighted by 1/surface-distance, averaged over
        neighbors, then turned into a force-limited steering vector.
        """
        fish = self.fish[i]
        avg_x = 0.0
        avg_y = 0.0
        count = 0
        for j, other in enumerate(self.fish):
            if j == i:
                continue
            dx = fish.x - other.x
            dy = fish.y - other.y
            dist = np.hypot(dx, dy)
            if dist > SEPARATION_RADIUS or dist == 0:
                continue
            sensing = max(MIN_FELT_DIST, dist - 2 * FISH_SIZE)
            avg_x += (dx / dist) / sensing
            avg_y += (dy / dist) / sensing
            count += 1

        if count == 0:
            return 0.0, 0.0
        avg_x /= count
        avg_y /= count
        avg_mag = np.hypot(avg_x, avg_y)
        if avg_mag == 0:       # pushes cancelled exactly (JS version divides by 0 here)
            return 0.0, 0.0

        steer_x = (avg_x / avg_mag) * MAX_SPEED - fish.vx
        steer_y = (avg_y / avg_mag) * MAX_SPEED - fish.vy
        mag = np.hypot(steer_x, steer_y)
        if mag > MAX_FORCE:
            steer_x = (steer_x / mag) * MAX_FORCE
            steer_y = (steer_y / mag) * MAX_FORCE
        return steer_x, steer_y

    def _move(self, fish, action, sep):
        fish.vx += action[0] * MAX_FORCE + SEPARATION_WEIGHT * sep[0]
        fish.vy += action[1] * MAX_FORCE + SEPARATION_WEIGHT * sep[1]

        speed = np.hypot(fish.vx, fish.vy)
        if speed > MAX_SPEED:
            fish.vx = (fish.vx / speed) * MAX_SPEED
            fish.vy = (fish.vy / speed) * MAX_SPEED
        elif 0 < speed < MIN_SPEED:
            fish.vx = (fish.vx / speed) * MIN_SPEED
            fish.vy = (fish.vy / speed) * MIN_SPEED

        fish.x = (fish.x + fish.vx) % CANVAS_WIDTH
        fish.y = (fish.y + fish.vy) % CANVAS_HEIGHT

    def _grow_foods(self):
        for food in self.foods:
            food.nutrients = min(1.0, food.nutrients + NUTRIENT_RECOVERY_RATE)
            food.maturity = min(1.0, food.maturity + FOOD_GROWTH_RATE * food.nutrients)

    def _try_eat(self, fish):
        """Returns the energy actually gained (after the MAX_ENERGY clamp)."""
        gained = 0.0
        for food in self.foods:
            food_radius = FOOD_MAX_RADIUS * food.maturity
            dist = np.hypot(fish.x - food.x, fish.y - food.y)
            if dist <= FISH_SIZE + food_radius:
                before = fish.energy
                fish.energy = min(MAX_ENERGY, fish.energy + food.maturity * REPLENISH_FACTOR)
                gained += fish.energy - before
                fish.last_ate = 0
                food.maturity = 0.0
                food.nutrients = max(0.0, food.nutrients - OVERGRAZE_PENALTY)
        return gained

    # ---------------------------------------------------------------- step
    def step(self, actions):
        """
        actions: array of shape (num_fish, 2), one steering action per fish.
        Returns (obs, rewards, terminated, truncated):
          obs        (num_fish, OBS_DIM) float32
          rewards    (num_fish,) float32
          terminated (num_fish,) bool  - fish starved this step (then respawned)
          truncated  bool              - world hit MAX_STEPS
        """
        # Synchronous update: everyone's separation is computed from the same
        # snapshot of positions, before anyone moves.
        seps = [self._separation(i) for i in range(self.num_fish)]
        for i, fish in enumerate(self.fish):
            self._move(fish, actions[i], seps[i])

        self._grow_foods()

        rewards = np.zeros(self.num_fish, dtype=np.float32)
        terminated = np.zeros(self.num_fish, dtype=bool)

        # Random processing order each step: when two fish reach the same patch
        # in the same step, the first one processed eats it. A fixed order would
        # permanently favor low-index fish.
        for i in self.rng.permutation(self.num_fish):
            fish = self.fish[i]
            ramp = (2 / np.pi) * np.arctan(fish.last_ate / SATIATION)
            loss_rate = BASE_LOSS_RATE + HUNGER_RATE * ramp
            fish.energy -= loss_rate
            gained = self._try_eat(fish)
            fish.last_ate += 1
            rewards[i] = -loss_rate + (gained * ramp) / REWARD_SCALE

        self.steps_elapsed += 1
        truncated = self.steps_elapsed >= MAX_STEPS

        # Starved fish are respawned *after* rewards are recorded, so the
        # terminal step's reward still belongs to the old fish. Their returned
        # observation is the new fish's first observation, which is what a
        # vectorized env's auto-reset would give PPO anyway.
        for i, fish in enumerate(self.fish):
            if fish.energy <= 0:
                terminated[i] = True
                self.fish[i] = self._random_fish()

        return self._get_all_obs(), rewards, terminated, truncated
