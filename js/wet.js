// 水まわり(キッチン・トイレ・洗面台)。形(styles)と部分ごとの色(parts:扉・天板・取っ手など)を選べる
// 作り方の決まりは kit.js の「形と部分ごとの色」を見る。向き:正面(人が立つ側)が +z、壁側が -z
import * as THREE from 'three';
import { box, cyl, std, pm, styleOf, emissive, light, METAL } from './kit.js';

export const WET = {};
