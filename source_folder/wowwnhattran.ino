#include <WiFi.h>
#include <HardwareSerial.h>
#include <TinyGPSPlus.h>
#include <WebServer.h> // Thêm thư viện WebServer
#include <ArduinoJson.h> // Cần cài thư viện ArduinoJson từ Library Manager nếu muốn format đẹp, nhưng ở đây tôi sẽ dùng chuỗi thủ công để bạn không cần cài thêm nếu không muốn.

// --- THÔNG TIN WIFI ---
const char* ssid = "LHBS";     
const char* password = "";  

// --- CẤU HÌNH GPS ---
#define BUTTON_PIN 3
#define GPS_TX_PIN 4
#define GPS_RX_PIN 5
static const uint32_t GPSBaud = 9600; 

HardwareSerial &gpsSerial = Serial2; 
TinyGPSPlus gps;
WebServer server(80); // Khởi tạo Server ở port 80

// --- BIẾN THỜI GIAN ---
unsigned long previousGpsUpdateTime = 0;
const long updateInterval = 30000; // 30 giây

// --- BIẾN CHO NÚT BẤM ---
bool alarmMode = false; // false = tắt, true = bật
bool systemOn = true; // Hệ thống đang hoạt động
unsigned long lastButtonPressTime = 0;
unsigned long buttonHoldStartTime = 0;
int buttonPressCount = 0;
bool buttonPressed = false;
const int DEBOUNCE_TIME = 50; 
const int DOUBLE_CLICK_TIME = 500; 
const int HOLD_TIME = 5000; 

// --- BIẾN LƯU VỊ TRÍ CUỐI CÙNG (Để gửi web ngay cả khi mất sóng tạm thời) ---
float lastLat = 0.0;
float lastLng = 0.0;

// --- HÀM XỬ LÝ SERVER ---
// Hàm này cho phép Web App (app.js) truy cập vào ESP32
void handleGPSData() {
  // BẮT BUỘC: Thêm 3 dòng này để trình duyệt cho phép App lấy dữ liệu
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");

  if (server.method() == HTTP_OPTIONS) {
    server.send(204);
    return;
  }

  String json = "{";
  json += "\"valid\": " + String(gps.location.isValid() ? "true" : "false") + ",";
  json += "\"lat\": " + String(gps.location.lat(), 6) + ",";
  json += "\"lng\": " + String(gps.location.lng(), 6) + ",";
  json += "\"alarm\": " + String(alarmMode ? "true" : "false") + ",";
  json += "\"system\": " + String(systemOn ? "true" : "false");
  json += "}";

  server.send(200, "application/json", json);
}
void handleRoot() {
  server.send(200, "text/plain", "ESP32 GPS Tracker is Online!");
}

void setup() {
  Serial.begin(115200);
  
  // Cấu hình nút bấm
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Khởi tạo UART cho GPS
  gpsSerial.begin(GPSBaud, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // Kết nối WiFi
  Serial.print("Dang ket noi WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi da ket noi!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP()); // *** QUAN TRỌNG: GHI NHỚ IP NÀY ĐỂ NHẬP VÀO APP ***

  // Cấu hình Web Server
  server.on("/", handleRoot);
  server.on("/gps", handleGPSData); // Web App sẽ gọi vào đường dẫn này
  server.begin();
  Serial.println("HTTP Server da khoi dong.");
  
  Serial.println("Dang doi tin hieu GPS (Hay ra ngoai troi)...");
  
  // In hướng dẫn sử dụng
  Serial.println("\n=== HUONG DAN SU DUNG ===");
  Serial.println("1. Nhan nut 2 lan: Bat/tat che do bao dong");
  Serial.println("2. Nhan giu 5 giay: Tat he thong");
  Serial.println("========================\n");
}

void handleButton() {
  int buttonState = digitalRead(BUTTON_PIN);
  unsigned long currentMillis = millis();
  
  if (buttonState == LOW && !buttonPressed) {
    buttonPressed = true;
    lastButtonPressTime = currentMillis;
    buttonHoldStartTime = currentMillis;
    buttonPressCount++;
    Serial.println("Nut da duoc nhan!");
  }
  
  if (buttonState == HIGH && buttonPressed) {
    buttonPressed = false;
    unsigned long holdDuration = currentMillis - buttonHoldStartTime;
    
    if (holdDuration >= HOLD_TIME) {
      Serial.println("\n!!! HE THONG DA TAT !!!");
      Serial.println("Nhan reset de khoi dong lai");
      systemOn = false;
      buttonPressCount = 0;
      return;
    }
  }
  
  if (buttonPressCount > 0 && (currentMillis - lastButtonPressTime) > DOUBLE_CLICK_TIME) {
    if (buttonPressCount == 2) {
      alarmMode = !alarmMode;
      Serial.println("================================");
      if (alarmMode) {
        Serial.println("CHE DO BAO DONG: BAT");
      } else {
        Serial.println("CHE DO BAO DONG: TAT");
      }
      Serial.println("================================");
    }
    buttonPressCount = 0;
  }
  
  if (buttonPressed) {
    unsigned long holdDuration = currentMillis - buttonHoldStartTime;
    if (holdDuration >= 1000 && holdDuration < HOLD_TIME) {
      int secondsLeft = (HOLD_TIME - holdDuration) / 1000 + 1;
      if (secondsLeft <= 5 && secondsLeft > 0) {
        static int lastSecond = 6;
        if (secondsLeft != lastSecond) {
          Serial.print("Nhan giu de tat he thong: ");
          Serial.print(secondsLeft);
          Serial.println(" giay");
          lastSecond = secondsLeft;
        }
      }
    }
  }
}

void loop() {
  // Xử lý Client kết nối tới Web Server
  server.handleClient(); 

  // Nếu hệ thống đã tắt, dừng mọi hoạt động (trừ Web Server để có thể check trạng thái)
  if (!systemOn) {
    delay(100); // Delay nhẹ
    return;
  }
  
  // Xử lý nút bấm
  handleButton();
  
  // Đọc dữ liệu từ module GPS liên tục
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Logic in ra Serial (Giữ nguyên code cũ của bạn)
  if (millis() - previousGpsUpdateTime >= updateInterval) {
    if (gps.location.isValid()) {
      Serial.print("Vi tri hien tai: ");
      Serial.print(gps.location.lat(), 6);
      Serial.print(",");
      Serial.println(gps.location.lng(), 6);

      Serial.print("Google Maps Link: https://www.google.com/maps?q=");
      Serial.print(gps.location.lat(), 6);
      Serial.print(",");
      Serial.println(gps.location.lng(), 6);
      
      if (alarmMode) {
        Serial.println("!!! BAO DONG !!! Vi tri tren la vi tri hien tai!");
      }
      
      previousGpsUpdateTime = millis(); 
    } else {
      Serial.println("Dang doi fix GPS (No Signal)...");
      previousGpsUpdateTime = millis(); 
    }
  }
  
  if (alarmMode && (millis() - previousGpsUpdateTime >= 10000)) { 
    if (gps.location.isValid()) {
      Serial.println("\n=== BAO DONG ===");
      Serial.print("Vi tri khan cap: ");
      Serial.print(gps.location.lat(), 6);
      Serial.print(",");
      Serial.println(gps.location.lng(), 6);
      previousGpsUpdateTime = millis();
    }
  }
  
  delay(1); // Giảm delay xuống thấp nhất để Web Server phản hồi nhanh
}