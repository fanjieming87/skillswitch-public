import { app } from "electron";

export function ensureSingleInstance(onSecondInstance: () => void): boolean {
  const hasLock = app.requestSingleInstanceLock();
  if (!hasLock) {
    app.quit();
    return false;
  }

  app.on("second-instance", () => {
    onSecondInstance();
  });

  return true;
}
