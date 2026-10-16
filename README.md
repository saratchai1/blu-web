# BLU — Mangrove

ฉากหลังป่าชายเลน 3D เต็มจอ ตามโทนภาพอ้างอิง: ฟ้าสว่าง ผืนน้ำสีฟ้าอมเขียว ป่าด้านขวาอยู่ใกล้ ป่าด้านซ้ายอยู่ไกล และพื้นที่กลางภาพเปิดโล่ง **ไม่มีเหรียญ โลโก้บนฉาก หรือข้อความโฆษณา**

## สิ่งที่ทำ

- ต้นโกงกางแบบ procedural 142 ต้น มีลำต้น กิ่ง รากค้ำยัน และใบโค้งแบบ instancing ประมาณ 90,275 ใบในโหมดเดสก์ท็อป
- ท้องฟ้าและเมฆจาก shader ผิวน้ำมีระลอก เงาสะท้อนของป่าที่เรนเดอร์จริง และหมอกตามระยะ
- ลากเพื่อมองรอบ ๆ, เลื่อนล้อเมาส์เพื่อเข้า/ออก, ปุ่มกลับมุมเริ่มต้น
- หยุด/เล่นการเคลื่อนไหว, เปลี่ยนแสงกลางวัน/แสงเย็น, เต็มจอ และซ่อนปุ่มควบคุม
- รองรับจอแนวตั้ง, ลดจำนวนใบและความละเอียดบนมือถือ, ปรับความละเอียดเมื่อเฟรมเรตต่ำ
- หยุด render เมื่อซ่อนแท็บ; เคารพ `prefers-reduced-motion`; มีภาพ SVG สำรองเมื่อ WebGL 2 ใช้ไม่ได้
- ไม่มี API key, analytics, รูปภาพภายนอก, ฟอนต์ภายนอก, โมเดลดาวน์โหลด หรือ runtime CDN

ฉากนี้เป็นงาน procedural ที่สร้างใหม่ ไม่ใช่การลบเหรียญออกจากรูปอ้างอิง และไม่ใช้รูปอ้างอิงเป็น texture

## เปิดในเครื่อง

ใช้ Node.js 22 LTS หรือใหม่กว่า:

```sh
npm install
npm run dev
```

สร้างเว็บสำหรับโฮสติ้งทั่วไป:

```sh
npm run build
npm run preview
```

Vite ใช้ `base: './'` จึงรองรับการวางใน subdirectory เช่น `/blu-web/` โฮสต์ไฟล์ใน `dist/` ผ่าน static hosting ได้ ไม่ต้องมี backend

## ไฟล์ HTML เดียวที่เปิดออฟไลน์ได้

ไม่ต้องติดตั้ง dependency สำหรับคำสั่งนี้:

```sh
npm run build:standalone
```

เปิด `dist/standalone.html` ในเบราว์เซอร์ที่รองรับ WebGL 2 ได้โดยตรง ไฟล์นี้รวมโค้ดและ CSS ทั้งหมด ไม่มีคำขอเครือข่ายขณะใช้งาน

## URL และปุ่มลัด

| ตัวเลือก | ผลลัพธ์ |
| --- | --- |
| `?clean=1` | ฉากหลังล้วน ไม่มี toolbar หรือคำแนะนำ |
| `?quality=low` | ลดความละเอียดและจำนวนใบ |
| `?fallback=1` | เปิดภาพสำรองเพื่อทดสอบ และมีปุ่มลองเปิด 3D |
| `H` | ซ่อน/แสดงปุ่มควบคุม |
| ลูกศร เมื่อโฟกัส canvas | เปลี่ยนมุมมอง |
| Space เมื่อโฟกัส canvas | หยุด/เล่น |
| Home เมื่อโฟกัส canvas | กลับมุมเริ่มต้น |
| `+` / `-` เมื่อโฟกัส canvas | เข้า/ออก |

## โครงสร้าง

- `src/scene.js` — WebGL 2, reflection framebuffer, camera, lifecycle และ adaptive resolution
- `src/forest.js` — สร้างราก ลำต้น กิ่ง และใบ
- `src/shaders.js` — ท้องฟ้า เมฆ น้ำ วัสดุใบและเปลือกไม้
- `src/math.js` — camera matrix และ seeded randomness
- `src/app.js` — interaction, accessibility และ fallback
- `src/art.js` — SVG foreground และ fallback ที่สร้างใหม่
- `tests/math.test.js` — unit tests
- `tests/tests.json` — manual/deployment acceptance scenarios

## ตรวจสอบ

```sh
npm test
npm run build:standalone
```

ไม่มีการเพิ่ม CI/CD หรือ workflow ที่ deploy อัตโนมัติ
