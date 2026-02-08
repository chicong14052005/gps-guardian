# GPS Tracker & Safe Zone Monitor

## Tổng Quan Dự Án

Đây là một dự án **giám sát GPS thời gian thực** kết hợp phần cứng (ESP32 + GPS Module) và phần mềm (Web App). Hệ thống cho phép theo dõi vị trí thiết bị trên bản đồ, thiết lập các vùng an toàn, vẽ tuyến đường, và cảnh báo khi thiết bị vi phạm các quy tắc đã đặt ra.

---

## Kiến Trúc Hệ Thống

```
┌─────────────────────┐       HTTP (REST API)       ┌──────────────────────┐
│   ESP32 + GPS       │ ◄──────── /gps ──────────►  │   Web App (Browser)  │
│   (wowwnhattran.ino)│    WiFi (cùng mạng LAN)     │   (index.html +     │
│                     │                              │    app.js + CSS)     │
│  - TinyGPSPlus      │    JSON Response:            │                     │
│  - WebServer (port80)│    {lat, lng, valid,         │  - Leaflet Map       │
│  - Nút bấm vật lý   │     alarm, system}           │  - Safe Zones        │
│                     │                              │  - Route Drawing     │
└─────────────────────┘                              │  - Email Alerts      │
                                                     │    (EmailJS)         │
                                                     └──────────────────────┘
```

---

## Thành Phần

### 1. Phần Cứng – `wowwnhattran.ino`
- **Vi điều khiển**: ESP32
- **Module GPS**: Kết nối qua UART (Serial2), sử dụng thư viện `TinyGPSPlus`
- **Kết nối WiFi**: Kết nối vào mạng LAN và khởi động Web Server ở cổng 80
- **API Endpoint**: `GET /gps` – trả về JSON chứa tọa độ GPS, trạng thái báo động, trạng thái hệ thống
- **Nút bấm vật lý**:
  - Nhấn 2 lần: Bật/Tắt chế độ báo động
  - Giữ 5 giây: Tắt hệ thống

### 2. Phần Mềm – Web App
- **`index.html`**: Giao diện đa màn hình (Loading → Xác thực thiết bị → Chọn bán kính → Bản đồ)
- **`app.js`** (~1080 dòng): Logic chính bao gồm:
  - Quản lý bản đồ Leaflet (markers, circles, polylines)
  - Vẽ tuyến đường với vùng đệm an toàn (buffer zone 100m)
  - Các bài kiểm tra mô phỏng (Test đi đúng/sai tuyến, xâm nhập, đứng lâu)
  - Kết nối ESP32 thời gian thực qua `fetch()` API
  - Giám sát đa vùng an toàn (Safe Zones)
- **`style.css`** (~1827 dòng): Giao diện hiện đại với animations, gradients, responsive
- **`notification.js`**: Gửi email cảnh báo qua EmailJS

### 3. Các Tính Năng Chính
| Tính năng | Mô tả |
|---|---|
| 🗺️ Bản đồ tương tác | Leaflet Map với OpenStreetMap tiles |
| 📍 Vùng an toàn | Tạo nhiều vòng tròn an toàn với bán kính tùy chỉnh |
| ✏️ Vẽ tuyến đường | Click trên bản đồ để tạo route + buffer zone 100m |
| 🚶 Test đi theo đường | Mô phỏng di chuyển đúng/sai tuyến |
| 🧪 Test xâm nhập | Mô phỏng xâm nhập vùng an toàn |
| ⏰ Test đứng lâu | Mô phỏng đứng yên quá 60 phút |
| 📡 Kết nối ESP32 | Lấy tọa độ GPS thực tế từ phần cứng |
| 📧 Cảnh báo Email | Gửi email tự động qua EmailJS khi có vi phạm |
| 🆘 Nút báo động | Kích hoạt từ nút vật lý trên ESP32 |

---

## Các Điểm Cần Cải Tiến

### 🎨 Giao Diện (UI/UX)

1. **Thiếu Responsive Design cho mobile**: CSS hiện tại chủ yếu tối ưu cho desktop. Cần thêm media queries và kiểm tra trên thiết bị nhỏ.

2. **Trùng lặp ID `autoFollowCheckbox`**: Trong `index.html` có 2 checkbox cùng ID `autoFollowCheckbox`, gây xung đột DOM. Cần xóa bớt 1 cái.

3. **Inline styles quá nhiều**: Nhiều phần tử trong `index.html` sử dụng `style=""` trực tiếp thay vì CSS class, gây khó bảo trì.

4. **Mix Tailwind CDN + Custom CSS**: Đang dùng cả `cdn.tailwindcss.com` (CDN) lẫn CSS thuần (`style.css`), dẫn đến xung đột style và tăng kích thước tải trang. Nên chọn một hướng duy nhất.

5. **Loading screen cần tối ưu**: Animation quá phức tạp (particle effects, 3D transforms) làm chậm tải trang trên thiết bị yếu. Nên đơn giản hóa.

6. **Control panel quá dài**: Thanh điều khiển bên trái chứa quá nhiều nút, nên nhóm thành các tabs hoặc accordion để giao diện gọn hơn.

7. **Thiếu Dark Mode**: Nên hỗ trợ theme tối cho trải nghiệm ban đêm.

8. **Popup thông báo chồng chéo**: Toast, Alert, Error Alert có 3 hệ thống riêng biệt, thiếu queue management — nhiều cảnh báo có thể chồng lên nhau.

### ⚙️ Tính Năng & Logic

9. **Biến `safeZones` không được khai báo**: Biến này được sử dụng trong `startRealTimeTracking()` và `manualIntrusionCheck()` nhưng không thấy khai báo trong code, sẽ gây lỗi runtime.

10. **Hàm `checkEspIntrusion()` không tồn tại**: HTML gọi `onclick="checkEspIntrusion()"` nhưng hàm thực tế tên là `manualIntrusionCheck()` → nút không hoạt động.

11. **Thiếu quản lý trạng thái (State Management)**: Toàn bộ state được quản lý bằng biến global, rất khó debug và mở rộng. Nên dùng framework (React/Vue) hoặc ít nhất là module pattern.

12. **Không có cơ chế retry/timeout cho fetch**: Khi ESP32 mất kết nối, `fetch()` sẽ treo vô thời hạn. Cần thêm `AbortController` với timeout.

13. **Nhập IP ESP32 bằng `prompt()`**: UX kém, nên tạo input field trên giao diện chính.

14. **Biến `esp32Ip` bị khai báo trùng**: Có biến global `esp32Ip` và biến local trong `startRealTimeTracking()`, cũng như `window.esp32Ip` trong `manualIntrusionCheck()` — 3 cách lưu IP khác nhau, dễ gây lỗi.

15. **Buffer zone tính toán chưa chính xác**: Hàm `createCirclePoints()` tạo buffer bằng cách chồng các vòng tròn tại mỗi điểm route, không tạo đúng dạng "ống" bao quanh tuyến đường. Nên dùng thư viện `turf.js` với hàm `buffer()`.

16. **Thiếu lưu trữ dữ liệu**: Không có localStorage/database để lưu cấu hình, lịch sử vị trí, hay tuyến đường đã vẽ. Mỗi lần refresh mất hết dữ liệu.

17. **Bảo mật EmailJS key**: `EMAILJS_PUBLIC_KEY`, `SERVICE_ID`, `TEMPLATE_ID` đang hard-code trong `notification.js`. Nên lưu trong biến môi trường (`.env`).

### 🏗️ Kiến Trúc & Code Quality

18. **File `app.js` quá lớn (1080+ dòng)**: Nên tách thành các module riêng biệt (map.js, route.js, esp32.js, tests.js, ui.js).

19. **Không có build system**: Trang web chạy trực tiếp bằng file HTML/JS/CSS thuần, không có bundler (Vite/Webpack), không minify, không tree-shaking.

20. **Thiếu TypeScript**: Không có type checking, dễ xảy ra lỗi runtime do sai kiểu dữ liệu.

21. **Không có linting/formatting**: Không có ESLint, Prettier — code style không nhất quán.

22. **Dependencies từ CDN**: Leaflet, Tailwind, EmailJS đều load từ CDN, không quản lý phiên bản qua package manager, có rủi ro breaking changes.

23. **Thiếu testing**: Không có unit test hay integration test nào.

---

## Công Nghệ Sử Dụng

| Thành phần | Công nghệ |
|---|---|
| Bản đồ | Leaflet.js v1.9.4 |
| Font | Google Fonts (Poppins) |
| CSS Framework | Tailwind CSS (CDN) + Custom CSS |
| Email | EmailJS |
| Phần cứng | ESP32 + TinyGPSPlus + Arduino WebServer |
| Ngôn ngữ | JavaScript (ES6+), HTML5, CSS3, C++ (Arduino) |

---

## Cách Chạy

1. **ESP32**: Nạp file `wowwnhattran.ino` vào ESP32 qua Arduino IDE. Ghi nhớ IP hiển thị trên Serial Monitor.
2. **Web App**: Mở `index.html` trên trình duyệt (cần cùng mạng WiFi với ESP32).
3. Nhập IP ESP32 khi được yêu cầu để bắt đầu giám sát thời gian thực.
