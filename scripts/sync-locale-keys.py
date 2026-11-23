"""Collect t(`${NS}.key`, "English") / t("ns.key", "English") calls from the given files and add any missing
keys (English source text) to every src/locales/<lang>/interface.json. Existing translations are never changed."""
import glob, json, re, sys

def keys_in(path):
    src = open(path, encoding="utf-8").read()
    ns = re.search(r'const NS = "([^"]+)"', src)
    found = {}
    for key, text in re.findall(r't\(`\$\{NS\}\.([A-Za-z0-9_]+)`,\s*"((?:[^"\\]|\\.)*)"', src):
        if ns: found.setdefault(ns.group(1), {})[key] = text
    for full, text in re.findall(r't\("((?:components|common)\.[A-Za-z0-9_.]+\.[A-Za-z0-9_]+)",\s*"((?:[^"\\]|\\.)*)"', src):
        namespace, key = full.rsplit(".", 1)
        found.setdefault(namespace, {})[key] = text
    return found

collected = {}
for path in sys.argv[1:]:
    for namespace, entries in keys_in(path).items():
        collected.setdefault(namespace, {}).update(entries)
added = 0
for locale_file in glob.glob("src/locales/*/interface.json"):
    data = json.load(open(locale_file, encoding="utf-8"))
    for namespace, entries in collected.items():
        node = data.setdefault(namespace, {})
        for key, text in entries.items():
            if key not in node:
                node[key] = text; added += 1
    with open(locale_file, "w", encoding="utf-8") as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2); handle.write("\n")
print(f"{sum(len(v) for v in collected.values())} keys found, {added} locale entries added")
