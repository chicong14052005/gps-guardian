# 🛡️ GPS Guardian

Hệ thống giám sát GPS thời gian thực với ESP32 và Web App.

![GPS Guardian Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## 📋 Mô tả

GPS Guardian là ứng dụng giám sát vị trí GPS theo thời gian thực, hỗ trợ:

- 📍 **Theo dõi vị trí** từ module GPS NEO-6M qua ESP32
- 🔒 **Vùng an toàn** (Safe Zones) - cảnh báo khi ra khỏi vùng
- 🛣️ **Nhiều tuyến đường** - theo dõi và cảnh báo lệch tuyến
- 📧 **Gửi email cảnh báo** khi phát hiện vi phạm
- 🎮 **Mô phỏng** di chuyển để test hệ thống

## 🏗️ Kiến trúc

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ESP32 + GPS   │────▶│   Server API    │◀───▶│    Web Client   │
│  (wowwnhattran  │     │   (Express.js)  │     │   (React+Vite)  │
│      .ino)      │     │   Port: 3001    │     │   Port: 5173    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 🔧 Yêu cầu

- **Node.js** >= 18.x
- **npm** >= 9.x
- **ESP32** với module GPS NEO-6M (tùy chọn, có thể dùng mô phỏng)

## 🚀 Cài đặt & Chạy

### 1. Clone repository

```bash
git clone <repository-url>
cd gps-guardian
```

### 2. Cài đặt dependencies

```bash
# Cài đặt cho Client (React)
npm install

# Cài đặt cho Server (Express)
cd server
npm install
cd ..
```

### 3. Cấu hình môi trường

Tạo file `.env.local` ở thư mục root (nếu chưa có):

```env
VITE_EMAILJS_SERVICE_ID=your_emailjs_service_id
VITE_EMAILJS_TEMPLATE_ID=your_emailjs_template_id
VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
```

### 4. Chạy Server

```bash
cd server
npm start
# Hoặc với hot-reload:
npm run dev
```

Server chạy tại: `http://localhost:3001`

### 5. Chạy Client

```bash
# Ở thư mục root
npm run dev
```

Client chạy tại: `http://localhost:5173`

## 📱 ESP32 Setup (Tùy chọn)

### Phần cứng cần thiết

- ESP32 DevKit
- Module GPS NEO-6M
- Dây nối

### Kết nối

| ESP32 | GPS NEO-6M |
|-------|------------|
| 3.3V  | VCC        |
| GND   | GND        |
| GPIO4 | TX         |
| GPIO5 | RX         |

### Nạp code

1. Mở `wowwnhattran.ino` bằng Arduino IDE
2. Cài thư viện: `TinyGPSPlus`, `ArduinoJson`
3. Cập nhật WiFi credentials trong code:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
4. Nạp code lên ESP32

## 📁 Cấu trúc dự án

```
gps-guardian/
├── App.tsx              # Component chính
├── components/
│   ├── Map.tsx          # Bản đồ Leaflet
│   ├── Sidebar.tsx      # Thanh điều khiển
│   ├── ZoneEditor.tsx   # Editor vùng an toàn
│   ├── DirectionPicker.tsx  # Chọn hướng mô phỏng
│   └── ToastContainer.tsx   # Thông báo
├── contexts/
│   └── AuthContext.tsx  # Xác thực
├── utils/
│   ├── geo.ts           # Hàm tính khoảng cách
│   └── emailService.ts  # Gửi email cảnh báo
├── server/
│   └── index.js         # Express API server
├── types.ts             # TypeScript types
└── wowwnhattran.ino     # Code ESP32
```

## 🎯 Tính năng chính

### Vùng an toàn (Safe Zones)
- Double-click trên bản đồ để tạo vùng mới
- Thiết lập bán kính, màu sắc
- Bật/tắt từng vùng riêng biệt

### Tuyến đường (Routes)
- Tạo nhiều tuyến đường độc lập
- Click trên bản đồ để thêm điểm
- Kéo thả để điều chỉnh điểm
- Xác nhận để bật giám sát

### Mô phỏng
- **Simulate Route**: Di chuyển theo tuyến đường
- **Simulate Intrusion**: Test cảnh báo xâm nhập
- **Simulate Static**: Đứng yên tại vị trí

## 🔐 Đăng nhập

Tài khoản mặc định:
- **Email**: `congcuong123465@gmail.com`
- **Password**: `123456`

## 📜 Scripts

| Script | Mô tả |
|--------|-------|
| `npm run dev` | Chạy client (development) |
| `npm run build` | Build production |
| `npm run preview` | Preview production build |
| `cd server && npm start` | Chạy server |
| `cd server && npm run dev` | Chạy server với nodemon |

## 🛠️ Tech Stack

**Client:**
- React 19
- Vite
- TypeScript
- Leaflet (bản đồ)
- Lucide React (icons)
- EmailJS (gửi email)

**Server:**
- Express.js
- SQLite (sql.js)
- JWT Authentication
- bcryptjs

**Hardware:**
- ESP32
- GPS NEO-6M
- TinyGPSPlus library

## 📄 License

MIT License
