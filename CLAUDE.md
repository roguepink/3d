# おへや3D(repo roguepink/3d)

- ノブさんの会社(なかのインテリア)の仕事で、お客さんの部屋にカーテンや照明を置いて見せるためのアプリ。公開リポジトリ。
- **お客さんの部屋の写真・個人情報は、このリポジトリに入れない。**テストは合成画像で。
- ビルドなし・外部ライブラリは three.js(CDN, importmap)だけ。素材画像は `js/textures.js` で描く。
- 構成: `main.js`(画面と状態) / `scene3d.js`(描画) / `controls.js`(歩く操作) / `house.js`(部屋の形) / `items.js`(置くもの) / `textures.js`(素材) / `commands.js`(日本語の指示) / `photo.js`(写真の取り込み) / `plan.js`(間取り) / `store.js`(保存) / `ai.js`(Gemini 任意) / `demo.js`(見本の家)
- 座標: x 右(東)、z 手前(南)、y 上。部屋は多角形 `poly:[[x,z],...]`(時計回り、絶対座標)。x,z,w,d は外接する長方形(syncBounds で自動)。壁は多角形の辺 `edge`(番号)、開口は `edge` と `u`(辺の始点=内側から見て左 からの距離)。古い N/E/S/W・pos 形式は normalizeRoom が変換する。
- 柱型・袖壁・梁は `room.parts`:`{type:'column',x,z,w,d}` / `{type:'wall',x1,z1,x2,z2,h,t}` / `{type:'beam',x,z,w,d,drop,finish:'cross'|'wood',wood,cross}`(梁:既定はクロス巻き込み=天井と同じ。cross に壁紙、wood に TRIM_FINISHES の木目)。歩ける判定(walkable)は多角形+ドアの通り道−柱・袖壁。
- 寸法: 画面は mm 表示。部屋の多角形は内法。芯々 = 内法 + WALL_T(120)。モジュールは `settings.module`('shaku' 910 / 'meter' 1000、localStorage 'oheya-module' が既定)。芯グリッドは k*g − 0.06 の位置。帖数は壁芯面積(内法+周囲×0.06)÷1.62。吸いつき(snap)は plan.js(tolM = 12px)。
- 仕上げ: `room.trim = {crown:{on,h(mm),finish}, base:{...}, casing:{on,w,finish}, door:{finish}}`(roomTrim で既定を補う)。finish は textures.js の TRIM_FINISHES。窓の枠なし=ジャンブに壁材(クロス巻き込み)。
- 窓の枠: 既定は見付 20mm の四方枠(下も上と同じ)。枠なし=クロス巻き込み+窓台だけ左右 20mm・室内側 20mm 出す。出窓は opening.bay='trap'|'box'、bayDepth(台形の既定 230 = 斜め窓 約325mm、箱型 450)。下の板(天板)は厚み30mm、左右は枠(なければ開口)から20mm出す。house.js の buildBay が天板(左右20mm出し)・天井板・外の腰と屋根を作る。台形=左右に斜めのはめ殺し窓+正面は引き違い2枚(計4枚)、角(箱型)=枠なしで左右と上の三方クロス巻き込み(部屋の枠設定に関係なく)+正面は引き違い2枚、下は30mmの板だけ。部屋の形「出窓つき」は長方形+奥の壁に台形出窓。
- 設備: items.js で `equip:true`、`attachY`(数値 or 'top')が標準の取付高さ、`range` が寸法の範囲。「🔌設備」は openCatalog(true)。
- つかむ: 選んでいない物は長押し 0.4 秒でつかむ(controls.js の lp)、選んである物はすぐ引っぱれる。hitTest は point を返す(drag の起点)。つかんでいる間は updateInset を止める(_dragging)。 ただし左下(幅45%・下55%)は歩くボタン優先。物が映っていても歩く(物の判定より先に見る)。
- 操作: ダブルタップ(controls.js の onTap で判定 → main.onDoubleTap)。縁・枠のメッシュは userData.kind='trim' + mergeKey で部位ごとに結合。もどす/進むは snapshot() 単位(矢印1押し・引っぱり開始・スライダー1回の操作・色変更 = 1段階)。
- ドア: opening に `swing`('in'=その部屋側へ開く/'out')・`hinge`('left'/'right'、部屋の内側から見て)・`open`(0〜1)。共有ドアの片側(twin)から選んだときは plan.doorOwner で持ち主に読みかえ、左右・内外を反転して表示。
- 編集欄: タブ(色・素材/大きさ/位置)、高さ low/high(つまみ)、👁 押している間だけ消す。開いている間は scene3d.setInset で見えている部分の中心に描き(setViewOffset)、frameItem で選んだ物に寄る(低い小物はしゃがむ、高い物は見上げすぎない距離、ふさがれていたら斜めから)。閉じると restoreView で元の視点へ。
- テストの注意: ブラウザが古い js を覚えることがある。確認用サーバーは no-store(scratchpad の nocache_server.py)、sw.js は no-cache で取り直す。
- アイテム: floor 系は y=0(底)、wall 系は y=中心の高さ、ceiling 系は y=天井。rot は Y 回転。
- 確認: `python3 -m http.server 8765` → `/#demo`。Chrome のパネルで撮って目で見る。`_check/` は Git に入れない。
- 公開: GitHub Pages(main の直下)。URL https://roguepink.github.io/3d/
- 言葉づかい: 画面の文言はノブさん向けにやさしく(専門用語を避ける)。

## 更新と起動(開けなくなる対策)
- index.html の起動係が、毎回 `version.json?t=…` を見てから、全部の js を `?v=版` 付きで読む(import map で ./js/*.js を ?v= に置きかえ)。古い部品と新しい部品が混ざらない。
- `version.json` はコミットのたびに `.githooks/pre-commit` が書きかえる(`git config core.hooksPath .githooks` が必要。新しく clone したら設定する)。
- js ファイルを足したら、index.html の起動係の FILES と sw.js の SHELL の両方に足す。
- 起動に失敗したら、1回だけ自動で控え(caches と sw)を捨てて開きなおす。だめなら「最新にして開きなおす」ボタン。保存した部屋(IndexedDB)は消さない。
- 開いている間に新しい版が出たら「🆕 新しい版があります」ボタン。押すと保存して開きなおし、続きから戻る。
- sw.js はネット優先。控えは ?v= を外した名前で1つだけ。オフラインは控えで開く(headless Chrome+CDP で確認済み)。

## 2階建て・階段(2026-10-21)
- 部屋の `level`(0=1階, 1=2階)。階高は `settings.floorH`(既定 2.9m)。house.js の `baseOf(room)` = level×階高。部屋のグループは y をその高さに上げる。
- アイテムの y・ヒットの point は「その部屋の床から」の高さ(2階でも床=0)。hitAt は point(部屋の床から)と world を返す。setPin・addItemMesh・updateItemPose で baseOf を足す。
- 歩く:controls の `floorY`(足もとの高さ、家全体)。`groundAt(p, rooms, gy)` が次の足もと(±0.3m まで、届く中でいちばん高い面)。目の高さは floorY+eye をなめらかに追う。
- 階段は部屋に `stair:{kind, style, dir, flip, finish}`(js/stairs.js)。1階の床から2階の天井までの吹き抜け(h = 階高+2.4 を normalizeRoom が入れる)。kind: u_winder(折り返し回り段・いちばん多い) / u_landing / l_winder / l_landing / straight / spiral。style: box / open。段数 = round(階高/0.205)(2.9m なら14段・207mm)。折り返し回り段は前後の踏面をそろえるため15段(193mm)。U字・L字は段の内側に壁(cores、建築基準法25条)。
- 階段の出入り口は type:'open'(枠だけ)。2階の出口は sill = 階高。`neighborAcross(..., {y})` で相手の階を決める。`app.regenStairOpenings` が ports から作り直す(前に部屋がある所だけ)。`app.addStair()` は階段+1階ホール+2階ホールを作る。
- 間取り:上の「1階/2階」で切りかえ(階段は両方に出る)。ほかの階は点線。階段を選ぶと形・つくり・向き・左右・階高を変えられる。
- 全体表示:左上の「2階/1階/全部」。歩くときは今の階の照明だけ点ける(applyLevels)。「2階へ」と言うと上がる。
- 家具:closet(作りつけクローゼット)・washer(洗濯機)も items にある。
- ユニットバス:items の `unitbath`。壁・天井・床は部屋の素材(ub_white など浴室パネル・ub_floor_*)。浴室のドアは opening.style='bath'。
- 見本の家(demo.js)は 3LDK・2階建て(9×7マス)。merge.js は材質が配列のメッシュをまとめない(階段の段)。
- 構文チェック:`jsc` の checkModuleSyntax で全 js を確認できる(書きまちがいで起動できなくなるのを防ぐ)。

## 収納・ニッチ・玄関・床のつなぎ(2026-10-21)
- 収納は「部屋」:`room.closet` = cl(枕棚1,800+パイプ1,700)/ wic(L字)/ oshiire(中段780+枕棚1,800)/ sic(可動棚)/ storage(棚)。中身は house.js の buildClosetInside。cl・oshiire は歩いて入れない。間取りの部屋の欄「部屋の使い方」で切りかえ(app.setRoomType)。
- 収納の戸は opening.type='closet'、style = fold(折れ戸)/ slide(引き違い)/ fusuma(襖)、open 0/1。持ち主は収納の部屋で、戸は部屋側の面。歩く・全体でタップすると開け閉め(app.toggleCloset)。
- ニッチは opening.type='niche'(u, w, h, sill, depth≦0.105)。外側の面には穴をあけない。間取りの「▭ニッチ」か「置く」の niche(c.opening)で付ける。
- 玄関の土間は `room.drop`(0.15)。baseOf から drop を引く(部屋の床=0 のまま)。h は 2.4+drop。ホールへの開口は sill=drop → 上がり框が自動で付く。
- ドアの下(sill≦0.02)は壁の厚みにも床を張る。となりと床が違うときはフローリング色の見切り(6mm)。地面は -0.45(基礎)。
- 置いたトイレにはペーパーホルダー・タオルリング、洗面台にはタオル掛けが自動で付く(app.addAccessories)。
- 観葉植物は js/plants.js(10種類、高さ・広がり・鉢の色)。
- 見本の家:専門家(設計士・IC)の案 → 自動チェック(カーテンと窓・開口の通り抜け・家具のはみ出し)。_check の audit 用スクリプトは scratchpad。

## 梁・天井の図・そろい線ほか(2026-10-21 夜)
- 梁:`core`(木の実寸 既定150)、`finish` cross(見付 = core + 両側に下地13+石膏ボード12 → 200)/ wood(見付 = core)、`drop` 既定100(梁の大部分は天井の中)。plan.beamResize が見付を直す。
- 天井の図(天井伏図):間取りの「☐天井」、または天井の物を選んで「位置」・引っぱり → app.openCeilingPlan。天井の物だけを記号で出し、部屋の真ん中(赤い十字)・ほかの物(水色)にそろうと吸いつき+線。
- 壁の物(コンセント・スイッチ等):同じ壁のほかの物と高さ/縦がそろう所で、引っぱりは25mm以内で吸いつき、十字ボタンは途中で1回止まる。そろうと水色の線(app.updateGuides)。
- 選んだ物は黄色の枠+うすい黄色の箱(depthTest なし)で、カーテンの裏でも見える。
- 便器は出入り口から遠い壁に背を付けて置く(app.toiletPose)。座って右の壁にペーパーホルダー(床700・便座の先+100)、左の壁にタオルリング(1,100)。
- エアコン・天井エアコンは色を「白・グレー・黒」だけ出し、「その他」で全部(catalog の palette:true)。天井エアコンは cassette1(1,200×460)/ cassette2(1,050×560)。
- 床はいつもフラット(ドアの下の見切りも床と同じ高さ)。収納の戸は枠・取っ手も含めてタップで開け閉め(closetdoor、keep で結合しない)。
- 服:Tシャツ・ワイシャツ・ジャケット・ワンピースの形+ハンガー(house.js の garment)。
- 👁(押している間だけ欄を消す)は全部の欄にある(.peek)。
