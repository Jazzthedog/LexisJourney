const STRIDE_DISTANCE_PX = 46; // roughly one paw-step per this much ground covered

// Distance-based step timing (not fixed-interval) so cadence naturally
// scales with how fast Lexi's actually moving, rather than firing on a
// clock regardless of speed. A room calls update() every frame and plays a
// footstep sound whenever it returns true.
export class FootstepCadence {
  private distanceSinceLastStep = 0;
  private lastX: number | null = null;

  update(x: number, grounded: boolean, running: boolean): boolean {
    if (!grounded || !running) {
      this.lastX = null;
      this.distanceSinceLastStep = 0;
      return false;
    }

    if (this.lastX === null) {
      this.lastX = x;
      return false;
    }

    this.distanceSinceLastStep += Math.abs(x - this.lastX);
    this.lastX = x;

    if (this.distanceSinceLastStep >= STRIDE_DISTANCE_PX) {
      this.distanceSinceLastStep = 0;
      return true;
    }
    return false;
  }
}
