#!/bin/bash
# FlyBrain MCP research batch - saves JSON results to /home/z/my-project/research/
set -u
mkdir -p /home/z/my-project/research
R=/home/z/my-project/research

z-ai function -n web_search -a '{"query": "FlyWire complete connectome adult fruit fly brain FAFB neurons synapses", "num": 8}' -o $R/01_flywire_connectome.json
z-ai function -n web_search -a '{"query": "Calyx MCP fly brain Model Context Protocol server", "num": 8}' -o $R/02_calyx_mcp.json
z-ai function -n web_search -a '{"query": "codex.flywire.ai search neurons API FlyWire codex", "num": 6}' -o $R/03_codex.json
z-ai function -n web_search -a '{"query": "CAVEclient FlyWire python API token materialization synapses", "num": 6}' -o $R/04_caveclient.json
z-ai function -n web_search -a '{"query": "opencode MCP server config model context protocol universal AI agents", "num": 6}' -o $R/05_opencode_mcp.json
z-ai function -n web_search -a '{"query": "fruit fly brain viral AI agents memory consciousness", "num": 8, "recency_days": 120}' -o $R/06_viral_recent.json
z-ai function -n web_search -a '{"query": "720575940622872870 flywire neuron", "num": 5}' -o $R/07_neuron_id.json
z-ai function -n web_search -a '{"query": "MCP server persistent memory agents SaaS hosted", "num": 6}' -o $R/08_memory_saas.json
echo "ALL SEARCHES DONE"
