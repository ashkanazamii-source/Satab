// ml/stateMachine.ts
type State = "ON_ROUTE" | "OFF_ROUTE";
type Snapshot = {
  driver_id: string;
  state: State;
  confidence: number;
  distToCorridorM: number;
  reason?: string;
  ts: number;
};

export class RouteHysteresis {
  private state: State = "OFF_ROUTE";
  private enterTicks = 0;
  private exitTicks = 0;

  constructor(
    private onThreshold = 0.7,  // اگر onRouteProb بالاتر از این مدتی بماند → ON_ROUTE
    private offThreshold = 0.4, // اگر پایین‌تر از این مدتی بماند → OFF_ROUTE
    private enterHold = 5,      // تعداد نمونه‌های پی‌درپی (مثلا 5 ثانیه)
    private exitHold = 10
  ) {}

  update(driver_id: string, prob: number, dist: number, reason: string | undefined, ts: number): Snapshot {
    if (this.state === "OFF_ROUTE") {
      if (prob >= this.onThreshold) this.enterTicks++; else this.enterTicks = 0;
      if (this.enterTicks >= this.enterHold) { this.state = "ON_ROUTE"; this.enterTicks = 0; }
    } else {
      if (prob <= this.offThreshold) this.exitTicks++; else this.exitTicks = 0;
      if (this.exitTicks >= this.exitHold) { this.state = "OFF_ROUTE"; this.exitTicks = 0; }
    }

    return {
      driver_id,
      state: this.state,
      confidence: prob,
      distToCorridorM: dist,
      reason,
      ts
    };
  }
}
