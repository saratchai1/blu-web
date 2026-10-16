# BLU — Mangrove

ฉากหลังป่าชายเลน 3D เต็มจอ ตามโทนภาพอ้างอิง: ฟ้าสว่าง ผืนน้ำสีฟ้าอมเขียว ป่าด้านขวาอยู่ใกล้ ป่าด้านซ้ายอยู่ไกล และพื้นที่กลางภาพเปิดโล่ง **ไม่มีเหรียญ โลโก้บนฉาก หรือข้อความโฆษณา**

## เปิดดูเว็บ

- [เปิดเว็บพร้อมปุ่มควบคุม](https://blu-mangrove-sfomiv.v2.appdeploy.ai/)
- [เปิดเฉพาะฉากหลัง ไม่มีปุ่มควบคุม](https://blu-mangrove-sfomiv.v2.appdeploy.ai/?clean=1)

Preview นี้ deploy แบบ manual จาก implementation commit `db6c32f` ไม่ได้เชื่อม auto-deploy เมื่อ push GitHub

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

ผลตรวจในสภาพแวดล้อมพัฒนา:

- Unit tests: ผ่าน 8/8
- JavaScript syntax checks: ผ่าน
- Standalone HTML build: ผ่าน (51,394 bytes)
- Shader/geometry validation: เรนเดอร์ผ่าน EGL / OpenGL ES 3.2; shaders ทั้ง 6 compile ผ่าน, programs ทั้ง 3 link ผ่าน, reflection framebuffer complete และไม่มี GL error
- Chromium fallback/UI: ตรวจที่ 1440×900 และ 375×667 — ภาพสำรอง, ปิดปุ่ม 3D ที่ใช้ไม่ได้, retry, ซ่อน/แสดง toolbar, ปุ่ม H และไม่มี page overflow ผ่าน
- Chromium ในสภาพแวดล้อมพัฒนาไม่อนุญาต WebGL จึงยังไม่ใช่การยืนยัน browser 3D end-to-end หรือประสิทธิภาพบนอุปกรณ์จริงทุกชนิด
- AppDeploy รายงานสถานะ ready และไม่มี frontend/backend errors ใน status response; status ไม่ได้ส่งผล e2e แยกรายกรณี

ไม่มีการเพิ่ม CI/CD หรือ workflow ที่ deploy อัตโนมัติ
