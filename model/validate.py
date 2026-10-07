"""Fresh-scene re-import of exports/planets.glb checked against parts.json. Exit 1 on failure."""
import bpy, os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__)); P = json.load(open(os.path.join(HERE, "parts.json")))
bpy.ops.wm.read_factory_settings(use_empty=True); path = os.path.join(HERE, "exports", "planets.glb"); bpy.ops.import_scene.gltf(filepath=path)
objs = {o.name.split(".")[0]: o for o in bpy.data.objects}; req = ["Bodies", "Star", "Moon_A"]
for b in P["bodies"]:
    k = b["kind"]; req += [f"Pivot_{k}", f"Planet_{k}"] + ([f"Atmosphere_{k}"] if b["atmosphere"] else []) + (["GasGiant_Ring"] if "ring" in b else [])
missing = [r for r in req if r not in objs]; bad = []
for b in P["bodies"]:
    k = b["kind"]; pl, at, pv = objs.get(f"Planet_{k}"), objs.get(f"Atmosphere_{k}"), objs.get(f"Pivot_{k}")
    if pl and pv and pl.parent != pv: bad.append(f"Planet_{k} is not under its pivot")
    if at and pv and at.parent != pv: bad.append(f"Atmosphere_{k} is not under its pivot")
    if pl:
        d = max(pl.dimensions); expect = 2 * b["radius"] * (1 + b["bump"]); 
        if d < expect * 0.85 or d > expect * 1.2 + 0.05: bad.append(f"Planet_{k} diameter {d:.2f} is far from {expect:.2f}")
    if b["atmosphere"] and b["atmosphere"] < 1 + b["bump"] + 0.005: bad.append(f"{k}: the atmosphere factor {b['atmosphere']} is inside the terrain (bump {b['bump']})")
    if pl and at and not (max(at.dimensions) > max(pl.dimensions) * 0.999): bad.append(f"Atmosphere_{k} is not outside the surface")
orphans = [o.name for o in bpy.data.objects if o.parent is None and o.name.split(".")[0] != "Bodies"]
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == "MESH"); size = os.path.getsize(path)
rep = {"tris": tris, "bytes": size, "missing": missing, "orphans": orphans, "problems": bad}; json.dump(rep, open(os.path.join(HERE, "exports", "validation.json"), "w"), indent=1); print(json.dumps(rep, indent=1))
fail = []
if missing: fail.append(f"missing {missing}")
if orphans: fail.append(f"unparented {orphans}")
if bad: fail.append("; ".join(bad[:4]))
if tris > P["budget"]["tris"]: fail.append(f"{tris} tris over budget")
if size > P["budget"]["bytes"]: fail.append(f"{size} bytes over budget")
if fail: print("VALIDATION FAILED:", fail); sys.exit(1)
print("VALIDATION OK")
