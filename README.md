# Arcane Life v4 — MTG life counter

Mobile-first static website for GitHub Pages, with Firebase Realtime Database and Authentication.

## Preview locally

Run a local web server (for example VS Code Live Server) and open `index.html`. Click **Preview without Firebase** to test life, counters, partner slots, mana themes, animations, and artwork search. Scryfall search needs internet access.

## Live multiplayer and Google sign-in

1. Create a Firebase project and a web app. Paste its settings into `firebase-config.js`.
2. Enable **Realtime Database** and paste `database.rules.json` into its Rules tab.
3. Enable **Authentication > Sign-in method > Anonymous** and **Google**. Set a project support email.
4. Under **Authentication > Settings > Authorized domains**, add the actual GitHub Pages domain (e.g. `username.github.io`).
5. Publish the folder to GitHub Pages. Use HTTPS for Google sign-in.
6. Create a game and join from another device. Google sign-in is optional; it links an existing anonymous guest session when possible.

## v4: Turns, chance, activity and history

- Host-controlled shared turn number and active-player indicator (join order)
- Cryptographically random D4, D6, D8, D10, D12, D20, D100 and coin flip
- Room activity log (up to 80 recent events displayed) with all/mine filter; demo clear only
- Logged life changes, turn changes, dice and coin results, and game completion
- Google profile past-results list (up to 30 displayed)

**Important:** Activity logging is best-effort and is not atomic with life changes; it is not an audit-proof anti-cheat system. Event records can be spoofed by a room participant; authoritative enforcement needs a trusted backend. Older rooms may have no turnNumber or events; the UI defaults to turn 1.

## New features

- Personal mana themes, animated life totals and shimmering wallpaper cards
- Scryfall legendary-card artwork search (search button; no automatic deck tracking)
- Poison, experience, energy, rad, tickets, and up to 12 named custom counters per player
- Separate incoming commander damage from each opposing commander, with a partner toggle for two commander sources
- Host game completion and winner selection; optional signed-in profile history and wins/losses

## Important limits

This is a prototype, not a competition-grade scoring service. Results are user-maintained and are **not independently verified or tamper-proof**. A host may select a winner. Firebase database rules should receive a dedicated security review before broad public launch. The room reset is host controlled. Counter values are not automatic MTG rules adjudication; e.g. rad and commander damage have game-specific interactions. Google login requires a correctly configured Firebase project and authorized domain. Scryfall image availability depends on its API; follow its API rate limits and image attribution/usage policies. MTG is a trademark of Wizards of the Coast. This is an unofficial fan utility.


## v5 compact dashboard
The turn tracker has been removed from the interface and its controls. The main life totals stay visible; secondary features are organized into six switchable tabs: Counters, Commander, Appearance, Tools, Activity, and Finish game. All original multiplayer, Scryfall, Google login, dice and counters features remain. This version is not yet end-to-end tested with Firebase.
