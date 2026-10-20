# おへや3D(repo roguepink/3d)

- ノブさんの会社(なかのインテリア)の仕事で、お客さんの部屋にカーテンや照明を置いて見せるためのアプリ。公開リポジトリ。
- **お客さんの部屋の写真・個人情報は、このリポジトリに入れない。**テストは合成画像で。
- ビルドなし・外部ライブラリは three.js(CDN, importmap)だけ。素材画像は `js/textures.js` で描く。
- 構成: `main.js`(画面と状態) / `scene3d.js`(描画) / `controls.js`(歩く操作) / `house.js`(部屋の形) / `items.js`(置くもの) / `textures.js`(素材) / `commands.js`(日本語の指示) / `photo.js`(写真の取り込み) / `plan.js`(間取り) / `store.js`(保存) / `ai.js`(Gemini 任意) / `demo.js`(見本の家)
- 座標: x 右(東)、z 手前(南)、y 上。部屋は多角形 `poly:[[x,z],...]`(時計回り、絶対座標)。x,z,w,d は外接する長方形(syncBounds で自動)。壁は多角形の辺 `edge`(番号)、開口は `edge` と `u`(辺の始点=内側から見て左 からの距離)。古い N/E/S/W・pos 形式は normalizeRoom が変換する。
- 柱型・袖壁・梁は `room.parts`:`{type:'column',x,z,w,d}` / `{type:'wall',x1,z1,x2,z2,h,t}` / `{type:'beam',x,z,w,d,drop}`。歩ける判定(walkable)は多角形+ドアの通り道−柱・袖壁。
- 寸法: 画面は mm 表示。部屋の多角形は内法。芯々 = 内法 + WALL_T(120)。モジュールは `settings.module`('shaku' 910 / 'meter' 1000、localStorage 'oheya-module' が既定)。芯グリッドは k*g − 0.06 の位置。帖数は壁芯面積(内法+周囲×0.06)÷1.62。吸いつき(snap)は plan.js(tolM = 12px)。
- 仕上げ: `room.trim = {crown:{on,h(mm),finish}, base:{...}, casing:{on,w,finish}, door:{finish}}`(roomTrim で既定を補う)。finish は textures.js の TRIM_FINISHES。窓の枠なし=ジャンブに壁材(クロス巻き込み)。
- 設備: items.js で `equip:true`、`attachY`(数値 or 'top')が標準の取付高さ、`range` が寸法の範囲。「🔌設備」は openCatalog(true)。
- つかむ: 選んでいない物は長押し 0.4 秒でつかむ(controls.js の lp)、選んである物はすぐ引っぱれる。hitTest は point を返す(drag の起点)。つかんでいる間は updateInset を止める(_dragging)。
- 操作: ダブルタップ(controls.js の onTap で判定 → main.onDoubleTap)。縁・枠のメッシュは userData.kind='trim' + mergeKey で部位ごとに結合。もどす/進むは snapshot() 単位(矢印1押し・引っぱり開始・スライダー1回の操作・色変更 = 1段階)。
- ドア: opening に `swing`('in'=その部屋側へ開く/'out')・`hinge`('left'/'right'、部屋の内側から見て)・`open`(0〜1)。共有ドアの片側(twin)から選んだときは plan.doorOwner で持ち主に読みかえ、左右・内外を反転して表示。
- 編集欄: タブ(色・素材/大きさ/位置)、高さ low/high(つまみ)、👁 押している間だけ消す。開いている間は scene3d.setInset で見えている部分の中心に描き(setViewOffset)、frameItem で選んだ物に寄る(低い小物はしゃがむ、高い物は見上げすぎない距離、ふさがれていたら斜めから)。閉じると restoreView で元の視点へ。
- テストの注意: ブラウザが古い js を覚えることがある。確認用サーバーは no-store(scratchpad の nocache_server.py)、sw.js は no-cache で取り直す。
- アイテム: floor 系は y=0(底)、wall 系は y=中心の高さ、ceiling 系は y=天井。rot は Y 回転。
- 確認: `python3 -m http.server 8765` → `/#demo`。Chrome のパネルで撮って目で見る。`_check/` は Git に入れない。
- 公開: GitHub Pages(main の直下)。URL https://roguepink.github.io/3d/
- 言葉づかい: 画面の文言はノブさん向けにやさしく(専門用語を避ける)。
