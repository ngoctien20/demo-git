"""Validate the narrow, offline Messenger fixture format. Never execute a workflow."""
import json
import sys

PREFIX = "n8n-nodes-base."
ALLOWED = {PREFIX + key for key in ("manualTrigger", "noOp", "stickyNote")}


def check(graph):
    if not isinstance(graph, dict):
        return False
    nodes = graph.get("nodes")
    if graph.get("active") is not False or not isinstance(nodes, list) or not nodes:
        return False
    triggers = 0
    for node in nodes:
        if not isinstance(node, dict) or node.get("type") not in ALLOWED:
            return False
        if node.get("credentials") or node.get("parameters") not in ({}, None):
            return False
        triggers += node["type"] == PREFIX + "manualTrigger"
    return triggers == 1


if __name__ == "__main__":
    with open(sys.argv[1], encoding="utf-8") as source:
        accepted = check(json.load(source))
    print("PASS: inert node types only" if accepted else "BLOCKED: outside inert fixture profile")
    sys.exit(0 if accepted else 1)
