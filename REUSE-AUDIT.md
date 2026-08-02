# studiq — holisdk Reuse Audit & Alignment Plan

Audit of studiq against the Holistic **SDK / reuse** axioms — _Reuse before Build_,
_Keine Redundanz_, _Zugangspunkt wiederverwenden_, _Keine ähnlichen Geschwister_,
_Geteilter Core_, _Gespiegelte UI-API_, _Nur Render-Schicht doppelt_.

**Finding (one line):** studiq's *internal* architecture is clean, but the app is a
**standalone SPA that re-implements the shared SDK** (`@holisdk/ui`) instead of consuming it
as a service-UI plugin — the pattern every other Holistic service follows. The fix is a
structural migration that is **blocked in the autonomous/preview build** (holisdk is not
reachable there); it is recorded here as a tracked work item with an exact checklist.

---

## 1. The canonical pattern studiq diverges from

A Holistic service UI is **not** a standalone app. It is a `@holisdk/ui` **plugin**: a `ui/`
folder whose default export is a `ServicePlugin` (`@holisdk/ui` → `plugin/contract.ts`),
mounted by the holistic host shell. This is uniform across the codebase:

- `holistic-service-template/ui/` is the reference; **all** peers match it — contax, mail,
  prizm, hosuto, hostek, icaly, presentr, remshel each ship `ui/{index.tsx, Dashboard.tsx,
  i18n.ts, types.ts, tsconfig.json}`, depend on `"@holisdk/ui": "workspace:*"`, and import
  **only `@holisdk/ui` + react** (enforced by holistic's `eslint.services.cjs`).
- The host provides everything studiq rebuilt: shell/tabs/theme (`AppShell`, `Sidebar`,
  `TopBar`, `useTheme`), an authenticated data client (`ServiceContextProps.api` /
  `apiFor(serviceId)` — *"services never construct their own fetch/axios"*), imperative
  `ui.toast`/`ui.confirm`, navigation + cross-service tabs (`nav.openService`), and i18n.

studiq instead has its own `index.html`, `main.tsx`, `App.tsx`, a hand-built shell, a local
SSO/fetch client, and local copies of SDK primitives, tokens, and fonts.

## 2. Redundancy ledger — local module → SDK counterpart

| studiq local | `@holisdk/ui` counterpart | Class | Action on migration |
|---|---|---|---|
| `src/lib/cn.ts` | `cn` | identical impl | delete → import |
| `src/theme/tokens.css` | `@holisdk/ui/tokens.css` | **drifted** copy (187 vs 211 lines) | delete → import SDK css |
| `src/theme/tailwind-preset.ts` | `@holisdk/ui/tailwind-preset` | **drifted** copy | delete → use SDK preset |
| `src/theme/fonts/*.woff2` | shipped by the SDK | **byte-identical** copy | delete (SDK provides) |
| `src/ui/Button.tsx` | `Button`, `IconButton` | drop-in | replace (variant/size deltas) |
| `src/ui/Modal.tsx` | `Modal`, `Sheet` | drop-in | replace (`onClose`→`onOpenChange`) |
| `src/ui/Toast.tsx` | `toast`, `Toaster`, `dismissToast` **and** shell `ui.toast` | drifted copy | replace (variant names `default/danger`→`info/error`) |
| `src/ui/Tooltip.tsx` | `Tooltip` | drifted copy | replace (Radix, portal) |
| `src/ui/Toggle.tsx` | `Switch` | drop-in | replace (rename) |
| `src/ui/Segmented.tsx` | `SegmentedControl` | drop-in | replace (`ariaLabel`→`aria-label`) |
| `src/ui/Dropdown.tsx` | `DropdownMenu`, `ContextMenu` | SDK superset | replace |
| `src/ui/icons.tsx` (21 of ~53) | `@holisdk/ui` icons | duplicate set | import the 21 shared; keep/contribute the 32 domain icons |
| `src/shell/*` | `AppShell`, `Sidebar`, `TopBar`, `useTheme` | service composition **on** SDK primitives | host shell provides; drop local shell |
| `src/data/httpSource.ts` (SSO: `csrfToken`, `refreshSession`, `request`, `withFreshCsrf`, `post`) | shell `api` / `apiFor('scrapr')` | **parallel access point** | delete → call scrapr via `apiFor('scrapr')` |
| i18n (**none**) | `i18n` (`useT`, `registerMessages`, `LOCALES`) | unused SDK capability | adopt (also satisfies _Mehrsprachigkeit_) |

The `tokens.css` / `tailwind-preset` / fonts / `cn` copies are the most acute _Keine
Redundanz_ smell: they are copies of SDK building blocks, two of which have already **drifted**
from the source of truth.

## 3. Axiom-by-axiom verdict

| Axiom | Verdict | Note |
|---|---|---|
| Reuse before Build | **Violated** | SDK exists (`@holisdk/ui`); studiq rebuilt its blocks locally. |
| Keine Redundanz | **Violated** | drifted/identical copies of SDK tokens, preset, fonts, `cn`, UI atoms. |
| Keine ähnliche Geschwister | **Violated** | each local UI atom is a sibling of the SDK component of the same purpose. |
| Zugangspunkt wiederverwenden | **Violated at the host boundary** | `httpSource` is a second authenticated path to backend entities; the shell's `api`/`apiFor` is the mandated single access point. **Internally compliant** (see §5). |
| Geteilter Core | Precondition met | studiq's logic (`types.ts`, `lib/organize.ts`, `lib/methods.ts`, `data/`) is pure and DOM-free — ready to sit in a shared/plugin core. No separate core split yet. |
| Gespiegelte UI-API | N/A (no native pkg) | mirroring lives in the SDK; consuming `@holisdk/ui` is the precondition. |
| Nur Render-Schicht doppelt | N/A (no native pkg) | studiq's duplication is **not** the sanctioned render-layer kind. |

## 4. Migration checklist (the actual fix)

1. Reshape to a plugin: `ui/index.tsx` default-exports a `ServicePlugin` (`id: 'studiq'`,
   `displayName`, SDK `icon`, `Component: Dashboard`); move Fuse/Note/Learn under it.
2. Delete `index.html`, `main.tsx`, `App.tsx`, `src/shell/*`, `src/theme/*` (SDK provides).
3. Replace every `@/ui/*` and `@/lib/cn` import with the `@holisdk/ui` export (table §2).
   Move the 32 domain icons into the plugin (or contribute them to the SDK if reusable).
4. Delete `src/data/httpSource.ts`; back Fuse via `ctx.apiFor('scrapr')`; keep the
   `mockSource` behind the existing `DataSource` seam for offline/dev.
5. Add `ui/i18n.ts` (`registerMessages`) and route the German strings through `useT`.
6. Add `ui/package.json` (`"@holisdk/ui": "workspace:*"`) + `ui/tsconfig.json`
   (`extends ../../holisdk/tsconfig.base.json`, `paths` → `../../holisdk/ui/src/index.ts`),
   mirroring the peers, and register studiq in the holistic host's external plugins.

**Unblock preconditions** (why this is not landed autonomously — see §6): steps 3–6 require
`@holisdk/ui` to resolve at build time, i.e. studiq must build **inside the holistic pnpm
workspace** (or against a build host with holisdk as a sibling, or a published `@holisdk/ui`).
The current sxgate **static** preview builds studiq in an isolated worktree with **no holisdk
sibling and no workspace membership**, so importing the SDK there breaks the only verifiable
deliverable. Landing the migration and switching the preview to the host-built plugin path
must happen together.

## 5. Already compliant — do not re-litigate

- **Single source of truth / Zugangspunkt (internal):** all network access funnels through
  `src/data/`; only `state/studiq.tsx` reads it, via `getDataSource()`. No parallel data
  paths, no direct `mockSource`/`httpSource` imports elsewhere. The `DataSource` seam +
  passive-snapshot/atomic contract is exactly right — it becomes the swap-point to `apiFor`.
- **No intra-repo redundancy:** one `uid()` generator; pure, testable `organize.ts`.

_Generated by the autonomous Holistic reuse run. Update the ledger as items land._
