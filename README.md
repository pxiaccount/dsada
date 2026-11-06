# AUREUM — The Art of Value

A 3D coin showcase built with Three.js. Hand-engraved coins float in a warm,
paper-toned studio; switch between them with the arrows, dots, keyboard, drag or
scroll. Every coin is generated in code — no 3D models or image files required —
but you can also drop in your own coin photos.

The site opens with a short cinematic prologue: a close-up of tailored legs in
motion, the camera pushes in, and the coin collection is revealed. The prologue
also acts as the loader, so it never delays a page that is still preparing.

---

## เปิดเว็บ

เปิดไฟล์ `index.html` ได้เลย (ดับเบิลคลิก) ไม่ต้องติดตั้งหรือ build อะไร

ถ้าต้องการรันผ่านเซิร์ฟเวอร์ก็ได้ เช่น `npx serve` หรือ `python -m http.server`
แต่ไม่จำเป็น เพราะโปรเจกต์ใช้สคริปต์แบบธรรมดา ไม่ใช่ ES modules

> ฟอนต์ Bodoni Moda / Inter โหลดจาก Google Fonts ถ้าออฟไลน์จะใช้ฟอนต์สำรองให้อัตโนมัติ

---

## Intro / โปรล็อก

- ขาและรองเท้าเป็นภาพ SVG ที่ขยับด้วย JavaScript (`js/prologue.js`) — ไม่มีวิดีโอ
  หรือไฟล์ภาพ ทำให้โหลดเร็วและคมทุกความละเอียด
- ตัวโปรล็อกทำงานเป็นหน้าโหลดไปด้วย: แถบความคืบหน้าและข้อความจะอัปเดตตามการ
  เตรียมพื้นผิวเหรียญ เมื่อพร้อมแล้วกล้องจะซูมผ่านวงแหวนเหรียญและเปิดหน้าเว็บ
- มีปุ่ม **Skip intro** มุมขวาล่าง กดแล้วข้ามช่วงที่เหลือได้ทันที
- ถ้าเครื่องตั้งค่า `prefers-reduced-motion` ไว้ การวิ่งจะหยุดนิ่งและซูมเร็วขึ้น

ปรับความเร็ว/จังหวะได้ที่ `js/prologue.js` (`minHold`, `zoomTime`) และปรับ
สเกล/ตำแหน่งของภาพได้ที่คลาส `.prologue__*` ใน `css/style.css`

---

## เพิ่มเหรียญของตัวเอง

เหรียญทั้งหมดอยู่ในไฟล์ **`js/coins.js`** — เพิ่มออบเจ็กต์ใหม่ในอาร์เรย์
`window.AUREUM_COINS` ได้เลย ตัวเลขหน้าเว็บ, จุดนำทาง, ปุ่มลูกศร, คีย์ลัด
และสีของทั้งหน้าจะปรับตามจำนวนเหรียญให้เอง

```js
{
  id: 'aurora',
  name: 'Aurora',
  metal: 'Platinum',
  purity: '950.0 ‰',
  desc: 'A cold platinum disc with a hand-polished field.',
  price: '$3,100',
  weight: '31.10 g',
  mintage: '200',
  diameter: '38.6 mm',
  accent: '#b9c8d8',       // accent colour for the whole UI
  accentSoft: '#e6eef8',
  base: [200, 210, 222],   // RGB of the metal (0–255)
  rim: 0xdbe4ee,           // rim / edge colour (hex)
  emblem: 'star',          // sun | moon | leaf | star | eclipse
  legendTop: 'AURORA',
  legendBottom: 'AUREUM · MMXXVI',
  serial: 'N° 001 — 200',
  halo: 0.36
}
```

คัดลอกบล็อกตัวอย่างที่อยู่ในคอมเมนต์ท้ายไฟล์ `js/coins.js` แล้วแก้ค่าได้เลย
รายการจะเรียงตามลำดับในอาร์เรย์ และวนกลับไปเหรียญแรกเมื่อถึงตัวสุดท้าย

### ใช้รูปเหรียญของตัวเอง (ไม่ต้องวาดด้วยโค้ด)

วางรูปสี่เหลี่ยมจัตุรัส (แนะนำ 1024×1024 px) ไว้ใน `assets/coins/`
ให้เหรียญอยู่กลางภาพและเต็มกรอบ แล้วใส่ path ในข้อมูลเหรียญ:

```js
frontImage: 'assets/coins/aurora-front.png',
backImage:  'assets/coins/aurora-back.png',
imageRelief: 0.8   // optional — ความนูนที่สร้างจากแสงเงาในภาพ
```

รูปจะถูกใช้เป็นหน้าเหรียญ และระบบจะสร้าง normal map จากความสว่างของภาพ
เพื่อให้ผิวดูนูนขึ้นมา ถ้าไม่ใส่ `backImage` ด้านหลังจะยังใช้ลายที่สร้างจากโค้ด

### Emblem ที่มีให้เลือก

`sun` · `moon` · `leaf` · `star` · `eclipse`

---

## Controls

| Action | How |
| --- | --- |
| Next / previous coin | Arrow buttons, `←` `→`, mouse wheel, swipe / drag |
| Pick a coin | Dots under the stage, or keys `1`–`9` |
| Spin the active coin | Click it, or press `Space` |
| Camera parallax | Move the mouse |

---

## Files

```
index.html              page, prologue markup and interface
css/style.css           layout, typography, light theme, prologue animation
js/coins.js             ← your coin collection lives here
js/coin-textures.js     procedural engraving, colour and normal maps
js/prologue.js          SVG run cycle, zoom and reveal timing
js/main.js              Three.js scene, coins, animation, interaction
vendor/three.min.js     Three.js r158 (UMD, works from file://)
assets/coins/           put custom coin photos here
```

---

## ปรับแต่งเพิ่มเติม

- **สีทั้งหน้า / ธีม** — แก้ตัวแปร `--bg`, `--ink`, `--accent`, `--line` ใน
  `css/style.css` (ค่าเริ่มต้นเป็นกระดูกอ่อน `#f1eee6` + หมึก `#16140f` + ทองหม่น)
- **สีโลหะ** — แก้ `base`, `rim`, `accent` ใน `js/coins.js`
- **รายละเอียดหน้าเหรียญ** — `legendTop`, `legendBottom`, `serial`, `purity`
- **ลายสลัก** — เลือก `emblem` หรือแก้ฟังก์ชัน `emblemSun`, `emblemMoon`,
  `emblemLeaf`, `emblemStar`, `emblemEclipse` ใน `js/coin-textures.js`
- **จำนวนเหรียญ** — เพิ่ม/ลบ object ใน `AUREUM_COINS` ได้เลย ไม่ต้องแก้ที่อื่น
- **แสงและวัสดุ** — `buildEnvironment()` และ `faceMaterial()` ใน `js/main.js`

If WebGL is unavailable the page shows a short message instead of the scene.
"# dsada" 
