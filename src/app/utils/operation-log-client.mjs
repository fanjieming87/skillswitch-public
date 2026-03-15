export function appendLogBestEffort(appendLog, input) {
  void Promise.resolve()
    .then(() => appendLog(input))
    .catch(() => undefined);
}
