# Icon Assets

Place application and tray icons in this directory. The filenames are part of the
runtime convention and should not be changed unless the Electron code is updated.

## Required files

- `icon.png`
  - Format: PNG
  - Size: 256x256
  - Use: app icon fallback, generic project icon source

- `icon.ico`
  - Format: ICO
  - Sizes inside file: 16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256
  - Use: Windows app executable, shortcuts, installer, uninstaller

- `tray/tray-light-16.png`
  - Format: PNG
  - Size: 16x16
  - Use: light tray icon at 100% scale

- `tray/tray-light-32.png`
  - Format: PNG
  - Size: 32x32
  - Use: light tray icon for higher DPI displays

- `tray/tray-dark-16.png`
  - Format: PNG
  - Size: 16x16
  - Use: dark tray icon at 100% scale

- `tray/tray-dark-32.png`
  - Format: PNG
  - Size: 32x32
  - Use: dark tray icon for higher DPI displays

## Recommendations

- Keep tray icons transparent and high-contrast.
- Simplify the `RiChessLine` source before exporting `16x16` assets, otherwise the
  outline will be too thin to read in the Windows tray.
- Keep the visible shape within about 70%-80% of the canvas to avoid excessive padding.
