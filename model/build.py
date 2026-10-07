"""NEBULA planet base meshes. Deterministic. Run: Blender -b -P model/build.py
Six original planet bases, each with a tilted pivot, a surface mesh and (usually) a separate atmosphere shell, plus a star, a moon and a gas-giant ring. Names come from parts.json:
Pivot_<kind>, Planet_<kind>, Atmosphere_<kind>. Writes exports/planets.glb, renders/poster.png, source.blend."""
import bpy, bmesh, math, os, json, random
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__)); P = json.load(open(os.path.join(HERE, "parts.json")))
os.makedirs(os.path.join(HERE, "exports"), exist_ok=True); os.makedirs(os.path.join(HERE, "renders"), exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True); scene = bpy.context.scene; rnd = random.Random(55)
def mat(name, color, rough=0.8, emit=None, k=0.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]; b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough
    if emit: b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = k
    if alpha < 1: m.surface_render_method = "BLENDED"; b.inputs["Alpha"].default_value = alpha
    return m
COLORS = {"rocky": (0.45, 0.32, 0.22), "ocean": (0.1, 0.3, 0.55), "gas-giant": (0.8, 0.6, 0.4), "lava": (0.25, 0.08, 0.05), "ice": (0.7, 0.85, 0.95), "super-earth": (0.35, 0.4, 0.3)}
ATM = {"rocky": (0.9, 0.6, 0.4), "ocean": (0.4, 0.6, 1.0), "gas-giant": (0.9, 0.8, 0.6), "lava": (1.0, 0.4, 0.15), "ice": (0.7, 0.9, 1.0), "super-earth": (0.6, 0.8, 0.7)}
def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None); scene.collection.objects.link(e); e.location = loc
    if parent: e.parent = parent
    return e
def sphere(name, radius, sub, material, parent, bump=0.0, oblate=1.0, seed=0):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=radius); r = random.Random(seed)
    if bump:
        # low-frequency lumps from a few random sine waves: deterministic and cheap, stands in for terrain the shader will detail
        waves = [(Vector((r.uniform(-1, 1), r.uniform(-1, 1), r.uniform(-1, 1))).normalized(), r.uniform(2, 6), r.uniform(0, 6.28)) for _ in range(5)]
        for v in bm.verts:
            n = v.co.normalized(); h = sum(math.sin(w[1] * n.dot(w[0]) * math.pi + w[2]) for w in waves) / len(waves); v.co = n * radius * (1 + bump * h)
    for v in bm.verts: v.co.z *= oblate
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o); o.data.materials.append(material); o.parent = parent; return o
root = empty("Bodies"); X = 0
for i, b in enumerate(P["bodies"]):
    k = b["kind"]; pv = empty(f"Pivot_{k}", (X, 0, 0), root); pv.rotation_euler = (math.radians(b["tilt"]), 0, 0)
    sphere(f"Planet_{k}", b["radius"], b["subdivisions"], mat(f"Mat_{k}", COLORS[k], 0.85), pv, b["bump"], b.get("oblate", 1.0), seed=i * 7 + 1)
    if b["atmosphere"]: sphere(f"Atmosphere_{k}", b["radius"] * b["atmosphere"], b["shellSubdivisions"], mat(f"Atm_{k}", ATM[k], 0.2, alpha=0.18), pv, 0.0, b.get("oblate", 1.0))
    if "ring" in b:
        bm = bmesh.new(); n = 64; ri, ro = b["ring"]["inner"], b["ring"]["outer"]
        vs = [(bm.verts.new((ri * math.cos(2 * math.pi * j / n), ri * math.sin(2 * math.pi * j / n), 0)), bm.verts.new((ro * math.cos(2 * math.pi * j / n), ro * math.sin(2 * math.pi * j / n), 0))) for j in range(n)]
        for j in range(n): bm.faces.new((vs[j][0], vs[j][1], vs[(j + 1) % n][1], vs[(j + 1) % n][0]))
        me = bpy.data.meshes.new("GasGiant_Ring"); bm.to_mesh(me); bm.free(); ring = bpy.data.objects.new("GasGiant_Ring", me); scene.collection.objects.link(ring); ring.data.materials.append(mat("RingMat", (0.75, 0.68, 0.55), 0.9, alpha=0.8)); ring.parent = pv
    X += b["radius"] * 3.2 + 3.0
star = sphere("Star", 6.0, 4, mat("StarMat", (1.0, 0.85, 0.6), 0.5, (1.0, 0.7, 0.35), 6.0), root); star.location = (-16, 0, 0)
moon = sphere("Moon_A", 0.27, 3, mat("MoonMat", (0.55, 0.53, 0.5), 0.95), root, 0.06, seed=99); moon.location = (3.2, 2.5, 0.5)
names = [f"{pre}_{b['kind']}" for b in P["bodies"] for pre in ("Pivot", "Planet")] + [f"Atmosphere_{b['kind']}" for b in P["bodies"] if b["atmosphere"]]
bpy.ops.object.camera_add(location=(X * 0.5, -38, 6)); cam = bpy.context.active_object; scene.camera = cam; cam.data.lens = 50; cam.rotation_euler = (Vector((X * 0.38, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
for name, loc, e, col in (("Key", (-26, -20, 12), 30000, (1.0, 0.85, 0.65)), ("Fill", (30, -30, -8), 5000, (0.5, 0.4, 1.0))):
    bpy.ops.object.light_add(type="POINT", location=loc); l = bpy.context.active_object; l.name = name; l.data.energy = e; l.data.color = col
world = bpy.data.worlds.new("Void"); scene.world = world; world.use_nodes = True; world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.008, 0.02, 1)
scene.render.engine = "BLENDER_EEVEE_NEXT"; scene.render.resolution_x, scene.render.resolution_y = 1280, 720; scene.render.filepath = os.path.join(HERE, "renders", "poster.png")
bpy.ops.object.select_all(action="DESELECT")
def pick(o):
    o.select_set(True)
    for c in o.children: pick(c)
pick(root)
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, "exports", "planets.glb"), export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "source.blend"))
try: bpy.ops.render.render(write_still=True)
except Exception as e: print("poster failed", e)
print("BUILD OK", names[:2])
