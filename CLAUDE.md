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
- 戻るボタン(#btnBack):歩く画面で何も開いていないとき以外(間取り・天井の図・全体・どの欄)は、左上の🏠の場所に「←戻る」。押すと欄を閉じて歩く画面へ(app.goBack / updateBack)。
- 項目の5番目が 'mm' のもの(例:ペンダントの drop 150〜1,100)は、スライド5mm刻み+mmの数字欄。天井の図で選んだ物は、幅・奥行・⟳90°・大きく/小さく、2本指でつまむと大きさが変わる(plan.resizeCeil)。

## 家をリンクで開く・Claude が家を作る(2026-10-22)
- リンク:`https://roguepink.github.io/3d/#p=<データ>`。データ = 家の JSON(assets は抜く)を deflate-raw で縮めて base64url(js/link.js)。「#」以降はサーバーに届かないので、お客さんの家でもネットに残らない。開くと今の家は「(前の家)…」として保存(app.openFromLink)。メニュー「🔗 この家をリンクで送る」(app.copyLink)。
- js/builder.js:家を書くための部品(room/link/win/niche/add/beam。910 マス)と自動チェック audit(カーテンと窓・出入り口・家具のはみ出し・部屋の重なり・すき間)。buildFromSource(書き方の文字)で家のデータを作る。
- Claude Code のスキル `~/.claude/skills/oheya-house/`(SKILL.md・scripts/build.py・examples/sample-4ldk.js):言葉・図面・写真 → house.js → build.py(ヘッドレス Chrome で公開中のアプリを開いて組み立て・チェック・画像・リンク)→ 専門家の見直し → ノブさんへリンクと画像。
- **お客さんの図面・写真・家のデータは、このリポジトリに入れない。** 作業は `~/oheya-private/<日付-名前>/`(git の外)。
- builder.js の部品・CATALOG の名前・opening の形式を変えたら、スキルの SKILL.md と examples も直す。

## アプリの中で Claude に家を作ってもらう(2026-10-22)
- js/claude.js(使うときだけ import)。鍵は localStorage 'oheya-claude-key'(端末の中だけ。リポジトリには絶対に書かない)。メニュー「AIの設定」で Claude と Gemini の鍵、「🏗 AIに家を作ってもらう(Claude)」で欄(#aihouse:言葉・図面/写真/PDF・「今の家を直す」)。
- ブラウザから直接 fetch(ヘッダー x-api-key / anthropic-version 2023-06-01 / anthropic-dangerous-direct-browser-access: true / anthropic-beta: server-side-fallback-2026-07-01、本文 fallbacks:'default')。モデル claude-opus-5-5、effort high(直しは medium)、stream で文字数を知らせる。
- 流れ:system に部品の説明+見本の家(demo.js の中身)→ Claude が builder.js の書き方の JS を返す → buildFromSource → audit → 問題があれば最大2回 Claude に直させる → 読み込み(前の家は「(前の家)」で保存)。作った書き方は project.settings.aiSource に入れ、次の「直す」で使う。料金の目安(円)を表示(yenOf)。
- three.js 以外の外部ライブラリを入れない決まりのため、Anthropic の SDK ではなく fetch で呼ぶ。

## 形・部分ごとの色・映画用(2026-10-27)
- 置くものは4つのファイルに分かれる:`items.js`(カーテン・照明など昔からの物と一覧のまとめ)/ `furniture.js`(ベッド・机・椅子・ソファ・小物)/ `wet.js`(キッチン・トイレ・洗面台)/ `film.js`(ペタル・人の目印)。共通の部品は `kit.js`(CATALOG もここ。循環 import を避けるため)。
- **形(styles)と部分ごとの色(parts)**:カタログに `styles:[{id,name,size,words,opts,parts}]` と `parts:[{key,name,pal,def}]`。保存は `it.style` と `it.parts`。1番目の部分の色は `it.color`(古い保存・「青にして」とつながる)。作るときは `pm(it,key)` で材質、`styleOf(it).id` で形。styles の1番目が既定(古い保存の物はこれになる)。
- 色見本は textures.js の `FINISHES`(id:f_ 単色 / w_ 木目 / s_ 天板 / m_ 金物 / c_ 陶器)と `PALETTES`(door / wood / top / metal / ceramic)。pal 'color' はふつうの色、'fabric' は布の色と柄。`finishMaterial(v)` は id でも '#rrggbb' でもよい。
- 画面:「置く」で形が2つ以上ある物は「N種類」→ 押すと形の一覧。編集欄の「色・素材」に、形(横にすべる)・部分のボタン・名前つきの色見本(「ほかの色」でふつうの色)。言葉「二段ベッドを置いて」は styles の words(commands.js → styleByWord)。
- **映画とのつながり(ノブさん指示)**:ペタル(映画のロボット)の見た目と、映画に出る部屋の形は、このリポジトリ(public)に置いてよい。ストーリーとは関係ないため。脚本・ストーリー・人物の設定は置かない。人物4人の見た目はまだ許可をもらっていない(人の目印はだれだか分からない人形)。詳しくは ai-film-project の docs/anime-remake.md §11。
- ペタル:白い丸い体・黒い画面の顔・紫の目と口・紫のヘッドホン・胸に光る桜(見本は ai-film-project の assets/refs/petal-v3-*)。形=座る/立つ。大きさは座って高さ 150mm(2026-10-28 ノブさん)。`opts.lift` で机やベッドの上にのせる(人の目印も同じ)。
- **アングル**(js/angles.js、メニュー「🎬 アングル」):見え方を `project.settings.angles` に保存(歩く=位置・向き・ズーム、全体=カメラと注目点)。「この部屋を5方向から」= 真上+4つの角(目の高さ1.5m)。「まとめて1枚に」= 名前つきの設定シート画像(画像生成の配置の見本)。
- 見つからない種類の物が保存にあっても止まらない(load で null を飛ばす・buildItem が null)。

## 和風の家・小物(2026-10-28)
- ノブさんの希望:映画の「祖母の家」のような、**昭和の田舎の和風の家**(続き間・縁側・掘りごたつ・格子戸の玄関)を作れるように。映える古民家ではなく、使い込んだ普通の家。
- 家の作り(house.js):`room.wa = { wood, hashira, nageshi, kamoi }` で真壁の柱・長押・木の枠。戸の style に `shoji` / `glassdoor` / `koshi`(WA_SLIDE)と、4枚以上の `fusuma`(`panels`)。`ranma` / `ranmaStyle` で欄間(となりの部屋の側も持ち主の設定で穴があく)。`toko:'left'|'right'` で床の間の口(床柱・落とし掛け。床框は sill と kamachi)。床の間は `drop:-0.1` の小さい部屋。
- 材料(textures.js):床 tatami_old・tokoita・engawa・araidashi、壁 juraku・sunakabe_g・sunakabe_b、天井 sao・sao_light・tenjo_mesukashi・tenjo_ajiro・tenjo_gou・tenjo_mokume(2026-10-28 本物の和室の写真を見て作り直し。板は杉の山形の木目を絵で、竿縁・網代の枠・格天井の格子は house.js の buildCeil3D が CEIL_3D(textures.js)から立体で付ける。天井と同じく上から見る画面では隠れる)。
- 図面の画面:ドアに「戸の種類」(開き戸・引き戸・襖・障子・ガラス戸・格子戸)と「欄間」、部屋に「和室の作り あり/なし」。
- 置くもの:`js/wafu.js`(和の家具 22種:ちゃぶ台・掘りごたつ・座布団・仏壇・茶だんす・柱時計・黒電話・家具調テレビ・石油ストーブ・扇風機・和の照明・布団・掛け軸・長靴 など)、`js/komono.js`(小物 13種:掛け時計・置き時計・本・写真立て・額とポスター・カレンダー・日用品・コート掛け・傘立て・段ボール・ラジカセ・壁のフック・卓上ライト)。
- 見本:`examples/wafu-mihon.js`(続き間・床の間・縁側・格子戸の玄関)。
- 残り:呼び名の重なり(items.js の clock・picture と komono の掛け時計・額)。濃い「あめ色」の木目はまだない。掘りごたつは床に穴をあけず、暗い絵で見せている。
- 和と洋の分け方(2026-10-28):印・判定・既定の床壁天井は `js/wayo.js` にまとめる(カタログのファイルは触らない)。家の雰囲気 `project.settings.wayo`('mix' 既定 / 'wa' / 'yo')、部屋は `room.wa` があれば和室・`room.yo` があれば洋室・どちらもなければ家の雰囲気で決まる。置く物・床/壁/天井・戸の種類は、部屋に合う物を先に、反対側は「ほかも見る」。天井専用の材料(sao・tenjo_)は壁タブに出さない。
- 和室の天井 作り直し2(2026-10-28 ノブさん「床のフローリングの柄になっている。和室の天井は見る人が多いのでちゃんと」):天井板は部屋の端から端まで続く長い薄板(継ぎ目なし)、境は羽重ね/目透かし/敷目板/V溝。木目は板目(タケノコ形が板幅いっぱいに重なる)と柾目(平行の細い筋)。色 WOOD_TONES 6色、種類 CEIL_TYPES 10種(textures.js)。天井の spec は {lib, tone, grain, dir}、古い sao_light は sao+杉白として読む。立体(竿・吹寄せ・格縁・小組・鏡板・折上げ)は house.js の buildCeil3D。天井の画面に「木の色・木目・竿の向き」。

## マンション(2026-10-28)
- ノブさんの希望:映画の憲人の家のため、マンション(いまの田の字型・角部屋・タワマン・昭和の古いマンション)を作れるように。
- 作り:builder.js に col(柱型)・soffit(下がり天井)。house.js に バルコニー(room.outdoor:ほかの部屋に面していない辺を手すり壁 concrete/glass/steel にし、上は空。sky:true で天井なし)、窓の grille(面格子)・fix(FIX)、鉄の玄関扉 style:'steel'、アルミの掃き出し style:'sash'(WA_SLIDE の中)。scene3d.js に settings.storey(住んでいる階:地面を下げ、建物の下の部分と街の四角いビルを置く)。メニュー「🏢 住んでいる階」。
- 見本:examples/mansion-*.js。

## カーテンのひだ・レース・タッセル・レール(2026-10-28)
- カーテン(items.js `curtain`)の形 = ひだの種類(styles):3つ山・2倍(基本・既定)/2つ山・1.5倍/1つ山/ウェーブ(形状記憶)/ハトメ(ポール+リング)/フラット/ギャザー。倍率と山の間隔は `PLEATS`(調べた目安)。ひだの多さのスライダーはやめた(ノブさん「基本を大事に」)。
- 布は `curtainPanel`:外の端を固定、生地の長さは一定で、開ける・しぼるほどひだが深くなる。上のつまみ(山の数)も形に出す。
- `tie`(タッセルでまとめる):ドレープは開いて `tieH`(すその上から、mm で動かせる)でしぼる。レースは閉めたまま。タッセルはカーテンと同じ生地、壁にふさかけ金具。
- `rail`:ダブル/シングル。シングルは `hang` でドレープかレース。シングルでレースだけのときは、レースを開け閉め・タッセルもレースの白い布。`railColor`:`RAIL_COLORS`。
- レースの種類 `laceType`(`LACE_TYPES`、textures.js の lace_*):ボイル<無地<ミラー<遮像(透けにくさ=灰色の濃さをアルファに)、柄はストライプ・リーフ・幾何・小花・輪。レース単体(`lace`)も同じ。
- 設定の新しい種類 `['key','名前','choice',[[id,名前],…]]`:ボタンで1つ選ぶ(main.js の params ループ)。
- 和風シーリングライト(wafu.js `waceil`、照明):角形・組子(麻の葉ふう)・薄型・丸形。わくの木の色を選べる。
- 選んだ物の「🔄 ほかの物に変える」:同じ付け方(床・壁・天井)の物の一覧を出し、場所・向きはそのままで取りかえる(`swapItem`)。窓まわり同士なら幅と丈も引きつぐ。

## コンセント・スイッチ(2026-10-28)
- `outlet` の形:2口/アース付き/3口/4口(2連)/USB付き/テレビ端子付き。`switch`:1つ/2つ/3つ/4つ(2連)。大きさは固定(1連 70×120、2連 116×120)で、`noSize: true` の物は「大きさ」のタブを出さない。
- `series`(見た目):コスモワイド(定番)/アドバンス(最近・平ら・すき間が細い)/スクエア/昔の。部品は items.js の `elecPlate`・`elecHandle`・`elecModule`。
- 色を変える範囲(全部の物):「この1つだけ/この部屋ぜんぶ/家じゅうぜんぶ」。同じ種類の物にまとめてかかる(コンセントとスイッチは同じ仲間)。`this.colorScope`。
- 見た目の確認ページ:`_check/elec.html`(git に入れない)。

## 床の白い線・収納の入り口・和室の板(2026-10-28)
- 2階の床に白い線が出ていた:1階の壁の上のふた(cap)が2階の床より2cm上に出ていた。上に2階がある壁は、ふたを床の下へ下げる(house.js)。
- 収納の中の棚・パイプは、入り口(ドア・開口)の前に付けない(`buildClosetInside` の gaps/freeU)。横の壁に入り口があれば、その奥行きの所は端から端まで通路。奥に付けられないときは、入り口のない横の壁に通路450を残して棚。押入れのように入らずに取る収納は今までどおり棚でよい(ノブさん)。
- 1つの部屋は1つの床で。WIC など続きの部屋も同じ床にする。見切りは床の種類が違うときだけ。
- 畳の部屋は、立った巾木ではなく畳寄せ(壁ぎわに見える幅35mmの木、畳と同じ高さ)。和室(wa)は和の木の色、ふつうの部屋は `room.yose`(既定 wood_natural)。
- 和室の板の部分の仕上げ(床):縁甲板(檜)・縁甲板(杉)・杉の浮造り・地板(赤松)・床板(欅の一枚板)。前からの床の間の板・縁側の板もある。
- 見本の家の和室の照明は、和風シーリングライト(角形)。
