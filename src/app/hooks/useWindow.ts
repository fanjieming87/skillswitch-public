import { useEffect, useState } from "react";

export function useWindow() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    const handleMaximized = (nextValue: boolean) => {
      setIsMaximized(Boolean(nextValue));
    };

    window.electronAPI.on("window:maximized", handleMaximized);
    void window.electronAPI.window.isMaximized().then(setIsMaximized);

    return () => {
      window.electronAPI?.off("window:maximized", handleMaximized);
    };
  }, []);

  return {
    isMaximized,
    minimize: async () => {
      await window.electronAPI?.window.minimize();
    },
    toggleMaximize: async () => {
      const nextValue = await window.electronAPI?.window.maximize();
      if (typeof nextValue === "boolean") {
        setIsMaximized(nextValue);
      }
    },
    close: async () => {
      await window.electronAPI?.window.close();
    },
  };
}
