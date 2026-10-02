# Architecture notes from the kart-racer build
- Track: closed centripetal CatmullRom from a control-point DSL; sample every 2 units with tangent/curvature/bank/width; features (ramps, boost pads, mud, item rows, bridge, tunnel) attached by arc length.
- Terrain: heightfield from IDW of road heights + noise; carve under the road; separate physics/visual arrays; chunked meshes.
- Scenery: InstancedMesh per type, chunk-culled by frustum+distance.
- Vehicles: merged primitives, vertex colours; arcade physics (speed scalar, heading, slip, drift charge levels, boosts, ballistic jumps, tricks).
- AI: pure pursuit + curvature speed profile + drift decisions + item use + rubber banding.
- FX: ShaderMaterial points (normal + additive); WebAudio engine/loops/SFX/sequenced BGM.
- Demo director: scripted scenes with teleports, cinematic cameras, slow-mo, wipes.
- Game states: title, starting, countdown, race, finish, results; adaptive quality levels; best time in localStorage.
- Reuse for other genres: keep util/render/fx/audio/ui/main; replace track+sim+entities.
