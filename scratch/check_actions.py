import json

with open("src/config/ui/lib.operational-module-registry.json", "r") as f:
    data = json.load(f)

modules_without_actions = []
modules_missing_create = []

for mod in data.get("modules", []):
    actions = mod.get("actions", [])
    if not actions:
        modules_without_actions.append(mod["id"])
    else:
        # Check if they have at least something like 'Create' or 'Add' or 'Request'
        has_create = any("create" in a.lower() or "add" in a.lower() or "request" in a.lower() or "generate" in a.lower() or "claim" in a.lower() for a in actions)
        if not has_create:
            modules_missing_create.append((mod["id"], actions))

print("Modules without any actions:")
for m in modules_without_actions:
    print(f" - {m}")

print("\nModules missing a creation action:")
for m, acts in modules_missing_create:
    print(f" - {m}: {acts}")
