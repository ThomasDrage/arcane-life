# Arcane Life v6 — Mobile Experience

Static site for GitHub Pages. Firebase configuration is retained from v5.

## Changes
- Compact two-column player cards and primary life controls on the main battlefield.
- Six quick-tool buttons open full-screen accessible modal panels (counters, Commander, style, dice, activity, finish).
- Animated floating life deltas, particle bursts, healing/damage glows and optional vibration.
- Live Firebase `.info/connected` connection status; offline/reconnecting indicator.
- Scryfall wallpapers remain on player cards; Google sign-in and career history accessible using the Profile button.
- Reduced-motion support.

## Deploy
Upload the contents of this folder to the root of your existing `arcane-life` GitHub repository. No Firebase rule changes are needed for these UI features. Keep your currently working Realtime Database rules in Firebase.

## Test
Try the local demo first, then open the live game on two phones. Check reconnect, wallpaper, modal menus, Google sign-in, and counter synchronization.

## Notes
This version has not been tested on physical devices. Existing Firebase permissions, profile stats integrity, and host reset behavior still need independent testing.
