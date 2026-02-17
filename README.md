# Baryogenesis 2D Simulator

A **toy, bitset-based baryogenesis simulator** in a 2D lattice world, with you as the **3D operator**. Go ahead and work your magic on the **Cosmic Sheet**.

Open [`https://nishanth-murthy-kottapalli.github.io/Baryogenesis-2D-Simulator/`](https://nishanth-murthy-kottapalli.github.io/Baryogenesis-2D-Simulator/) in a browser.

> Inspired from this paper on [Baryogenesis: A Symmetry Breaking in the Primordial Universe Revisited](https://www.mdpi.com/2073-8994/16/1/13) by [David S. Pereira](https://scholar.google.com/citations?user=7ZCdyUcAAAAJ&hl=en&oi=ao), [João Ferraz](https://sciprofiles.com/profile/author/NS9XZ1ZNMGhNSUg4SlBRMml6UUo4UEpJV1pWK1BuWkhNVC9oK3hWRjA2VT0=), [Francisco S. N. Lobo](https://scholar.google.com/citations?user=5rlS6_8AAAAJ&hl=en&oi=ao) and [José Mimoso](https://scholar.google.com/citations?user=Ly6vzwgAAAAJ&hl=en&oi=ao)

## Run it Locally:
- VS Code: "Live Server" extension
- Python: `python -m http.server` then open `http://localhost:8000/`

## Controls
- **Mouse**: interact with tools (click / drag)
- **Wheel**: tool radius
- **Ctrl + {1..4}**: select tool
- **Shift + G**: show/hide grid
- **Shift + O**: show/hide overlays
- **H**: help
- **Space**: play/pause simulation
- **Enter**: initiate bounce
- **R**: reset run

## What you're seeing (toy physics)
- **Matter bitset** (M) and **Antimatter bitset** (A) live on the same lattice.
- **Pair creation** happens mostly when temperature is high (and during bounces).
- **Annihilation** happens when M and A overlap > injects heat/energy.
- A tiny **epsilon field ε(x,y)** biases outcomes slightly (paint it with the Bias Brush).
- The universe cycles through **Expansion > Contraction > Bounce** (operator can force bounce).

## Replay
- Export replay JSON (seed + operator events) and re-import to reproduce the run.
