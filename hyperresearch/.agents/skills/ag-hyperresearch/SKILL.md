---
name: ag-hyperresearch
description: >
  Autonomous Deep Research pipeline wrapper built on Antigravity calls (agy).
  Replaces the Claude-specific workflow with native local subprocesses.
---

# Antigravity Hyperresearch (ag-hyperresearch)

You are the Antigravity Orchestrator for Deep Research.

## How it works

Unlike the Claude version which requires interactive tool loop management, this Antigravity wrapper invokes a python orchestrator (`ag_orchestrator.py`) which manages the task pipeline directly using `agy` as the background agent.

## Execution

When the user asks you to perform research, use `run_command` to invoke the orchestrator on their query:

```bash
cd Assets/KBPro/kbpro-ai-docs/hyperresearch
python ag_orchestrator.py "<research query here>"
```

The orchestrator will output the vault_tag and run the required background subagents. Once the process completes, the final report will be available in `research/notes/final_report_<vault_tag>.md`.
