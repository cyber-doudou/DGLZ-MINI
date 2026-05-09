# Project Structure Analysis: DGLZ (打拐路子)

This document provides a comprehensive overview of the files and directories in the DGLZ project. Each file has been analyzed for its purpose within the game's architecture.

## 1. Project Overview
**DGLZ** is a digital implementation of the traditional Chinese card game "Da Guai Lu Zi" (打拐路子). 
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js (Express) + Socket.io (Real-time communication)
- **AI**: Integrated via Google Gemini API with a "Solidification" mechanism to turn AI insights into local rules.

---

## 2. File & Directory Inventory

### 📂 Root Directory
| File | Purpose | Status |
| :--- | :--- | :--- |
| `server.ts` | The main backend entry point. Manages game state, socket rooms, and AI autoplay logic. | **Core** |
| `index.html` | Entry point for the frontend web application. | **Core** |
| `package.json` | Project metadata, scripts, and dependencies. | **Core** |
| `tsconfig.json` | TypeScript compiler configuration. | **Core** |
| `vite.config.ts` | Configuration for the Vite build tool. | **Core** |
| `ai.config` | Local configuration for AI services (API keys, proxies). | **Core** |
| `AI_INTEGRATION_DESIGN.md` | Technical design document for the AI reasoning and solidification path. | Documentation |
| `README.md` | Basic project documentation. | Documentation |
| `build.sh` | Shell script for project deployment. | Utility |
| `restart.ps1` | PowerShell script to restart the server on Windows. | Utility |
| `server.crt` / `server.key` | SSL certificates for HTTPS development. | Utility |
| `list-models.ts` | Script to list available Gemini models. | <font color="red">**Useless (Dev ONLY)**</font> |
| `test-proxy.ts` | Connectivity test script for AI API proxies. | <font color="red">**Useless (Dev ONLY)**</font> |
| `test-candidate-menu.ts`| Unit test script for game move generation logic. | <font color="orange">**Test / Dev**</font> |
| `metadata.json` | Environment/IDE metadata. | <font color="red">**Useless**</font> |
| `.env.example` | Template for environment variables. | Secondary |
| `项目概述.md` | Chinese project overview. | Documentation |
| `玩法规则.md` | Detailed rules for the Da Guai Lu Zi game. | Documentation |
| `打包和运行说明.md` | Instructions for building the standalone executable. | Documentation |

### 📂 `src/` (Frontend Source)
| File/Dir | Purpose |
| :--- | :--- |
| `main.tsx` | React initialization and DOM mounting. |
| `App.tsx` | The root component; handles view switching (Lobby -> Game -> Results). |
| `index.css` | Global styles (Tailwind base). |
| `types.ts` | Shared TypeScript interfaces for the whole project. |
| `components/` | React UI components (GameBoard, Lobby, CardView, etc.). |
| `hooks/` | Custom hooks, primarily `useGameSocket.ts` for socket event handling. |
| `rules/` | **DaGuaiLuZiRule.ts**: The brain of the game. Shuffles, deals, and validates card combos. |
| `services/` | **AIPlayerService.ts** (Gemini API) and **ExperienceLogger.ts** (logging decisions). |
| `lib/` | Shared utility functions (`utils.ts`). |

### 📂 `logs/` (Data & AI)
| File | Purpose |
| :--- | :--- |
| `experience.jsonl` | Sequential log of every AI decision, including its reasoning. Used for tuning. |
| `tactics.json` | JSON weights for the scripted (rule-based) AI logic. |

---

## 3. Recommended Cleanup
The following files are identified as non-essential for the production or runtime environment of the game:

1.  **`list-models.ts`**: One-off diagnostic script.
2.  **`test-proxy.ts`**: One-off networking test.
3.  **`metadata.json`**: Redundant IDE-generated file.
4.  **`test-candidate-menu.ts`**: Should be moved to a dedicated `tests/` folder if retained.

---
*Created by Antigravity AI Assistant.*
