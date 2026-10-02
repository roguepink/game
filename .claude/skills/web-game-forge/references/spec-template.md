# Request template (user side) / spec (Claude side)
Minimum the user needs to say: **"<genre> のゲームを web-game-forge で作って"**. Everything else is defaulted. Optional knobs:

- Genre / reference: e.g. マリオカート風, ローグライク, 横スクロールアクション
- Theme / setting / hero: e.g. 林道を走るオフロードバイク
- Camera: chase / top-down / side
- Style: pop / realistic / retro pixel
- Platform: PC keyboard (default) / touch too
- Delivery: repo file only / + Artifact / + draft PR
- Screenshots of the feel you want (attach them)

Spec Claude fixes before coding (write 10 lines, then build):
1. One-sentence pitch  2. Controls  3. Core loop & win/lose  4. 3-5 mechanics  5. Items/enemies
6. Content scale (1 course/level, laps/waves)  7. Characters (original names)  8. Art palette
9. Demo scenes (3-4 showpiece moments)  10. Quality targets (fps, triangles)
