AGENT WORKING AGREEMENT (Chaos Core)
If a requested change cannot be verified in the running build, stop and explain why before making any code changes.

- Do not claim a change is implemented unless it is wired to the running UI.
- Every feature must include a visible on-screen proof marker string: CURSOR_PROOF_<feature>.
- You must report exact files changed and where wiring occurs (menu entry + router registration + screen/component render).
- If a screen/menu exists in multiple places, identify the one actually used by runtime by tracing imports from the current entrypoint.
- Final response must include 8–12 manual test steps starting from app launch.
- Prefer a vertical slice: UI entry -> state change -> visible result.
- If uncertain which file is live, add a temporary debug breadcrumb to confirm and remove it at end.


---
alwaysApply: true
---
