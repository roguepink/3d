# おへや3D(repo roguepink/3d)

- ノブさんの会社(なかのインテリア)の仕事で、お客さんの部屋にカーテンや照明を置いて見せるためのアプリ。公開リポジトリ。
- **お客さんの部屋の写真・個人情報は、このリポジトリに入れない。**テストは合成画像で。
- ビルドなし・外部ライブラリは three.js(CDN, importmap)だけ。素材画像は `js/textures.js` で描く。
- 構成: `main.js`(画面と状態) / `scene3d.js`(描画) / `controls.js`(歩く操作) / `house.js`(部屋の形) / `items.js`(置くもの) / `textures.js`(素材) / `commands.js`(日本語の指示) / `photo.js`(写真の取り込み) / `plan.js`(間取り) / `store.js`(保存) / `ai.js`(Gemini 任意) / `demo.js`(見本の家)
- 座標: x 右(東)、z 手前(南)、y 上。部屋は左上(北西)の角 (x,z) と w,d,h。壁は N/E/S/W。開口の pos は壁の最小座標側からの距離。
- アイテム: floor 系は y=0(底)、wall 系は y=中心の高さ、ceiling 系は y=天井。rot は Y 回転。
- 確認: `python3 -m http.server 8765` → `/#demo`。Chrome のパネルで撮って目で見る。`_check/` は Git に入れない。
- 公開: GitHub Pages(main の直下)。URL https://roguepink.github.io/3d/
- 言葉づかい: 画面の文言はノブさん向けにやさしく(専門用語を避ける)。
