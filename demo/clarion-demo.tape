# Clarion Demo — Terminal Recording (GIF teaser)
# Record with: vhs demo/clarion-demo.tape
# Produces: demo/clarion-demo.gif
#
# This is a SILENT GIF teaser for the README — it shows the CLI workflow.
# For the real demo with audio, see demo/RECORDING-GUIDE.md.

Output demo/clarion-demo.gif

Set Shell "zsh"
Set FontSize 14
Set Width 1000
Set Height 500
Set Theme "Catppuccin Mocha"
Set Padding 20

# ─── Scene 1: Check server + agents (5s) ──────────────────────────

Type "clarion-status"
Enter
Sleep 3s

# ─── Scene 2: One-shot speak (8s) ─────────────────────────────────

Type "echo 'The pattern holds. Every node in the system is behaving exactly as the doctrine predicts.' | clarion-speak --agent my-agent"
Enter
Sleep 4s

Type "# ▶ Audio plays through your speakers"
Enter
Sleep 3s

# ─── Scene 3: Pipe a live agent session (12s) ─────────────────────

Type "claude 'Explain the architecture.' | clarion-stream --agent my-agent"
Enter
Sleep 2s

Type "# ▶ Each sentence speaks as it arrives — voice starts while the agent is still working"
Enter
Sleep 4s

# Simulate stream output appearing
Sleep 4s

# ─── Scene 4: List agents (5s) ────────────────────────────────────

Type "clarion-speak --list-agents"
Enter
Sleep 3s

Type "# For the full demo with audio: github.com/celanthe/clarion"
Enter
Sleep 2s
