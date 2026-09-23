#!/bin/bash
# Follow-up batch: calyx/VFB MCP detail, male connectome 2026, licensing
set -u
R=/home/z/my-project/research
z-ai function -n web_search -a '{"query": "Virtual Fly Brain VFB MCP tool calyx github Drosophila LLM", "num": 8}' -o $R/09_vfb_calyx.json
sleep 3
z-ai function -n web_search -a '{"query": "male fruit fly connectome 2026 Janelia Google complete brain nerve cord neurons", "num": 8}' -o $R/10_male_connectome.json
sleep 3
z-ai function -n web_search -a '{"query": "FlyWire data license CC BY FAFB open data terms", "num": 5}' -o $R/11_license.json
sleep 3
z-ai function -n web_search -a '{"query": "mushroom body fly brain memory AI agents episodic salience", "num": 6}' -o $R/12_mushroom_memory.json
echo DONE
