export class DashboardError extends Error {
  constructor(public message: string) {
    super(message);
    this.name = "DashboardError";
  }
}
