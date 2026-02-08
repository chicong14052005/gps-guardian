import emailjs from '@emailjs/browser';

// EmailJS Configuration - từ dự án gốc notification.js
const EMAILJS_PUBLIC_KEY = "4cvVLEjXS7gDEgoOT";
const EMAILJS_SERVICE_ID = "service_xyowmff";

// Template IDs cho các loại cảnh báo khác nhau
const TEMPLATE_STAY_LONG = "template_zdsevir"; // Cho Đứng Lâu
const TEMPLATE_INTRUSION = "template_x17q06i"; // Cho Xâm Nhập/Ra khỏi vùng

// Default recipient email
const DEFAULT_RECIPIENT = "congcuong123465@gmail.com";

// Khởi tạo EmailJS một lần
let isInitialized = false;

function initEmailJS(): void {
  if (!isInitialized) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    isInitialized = true;
  }
}

export type AlertType = 'STAY_LONG' | 'OUT_OF_ZONE';

/**
 * Gửi email cảnh báo dựa trên loại alert
 * @param type - Loại cảnh báo: 'STAY_LONG' hoặc 'OUT_OF_ZONE'
 * @param recipientEmail - Email người nhận (mặc định: congcuong123465@gmail.com)
 * @returns Promise<boolean> - true nếu gửi thành công
 */
export async function sendAlertEmail(
  type: AlertType,
  recipientEmail?: string
): Promise<boolean> {
  initEmailJS();

  const targetTemplateID = type === 'STAY_LONG' ? TEMPLATE_STAY_LONG : TEMPLATE_INTRUSION;
  const typeLabel = type === 'STAY_LONG' ? 'Đứng Lâu' : 'Xâm Nhập';

  console.log(`📨 Đang gửi email cảnh báo ${typeLabel}...`);

  const templateParams = {
    to_email: recipientEmail || DEFAULT_RECIPIENT
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      targetTemplateID,
      templateParams
    );
    console.log('🚀 GỬI EMAIL THÀNH CÔNG!', response.status);
    return true;
  } catch (error) {
    console.error('❌ LỖI GỬI EMAIL:', error);
    return false;
  }
}

/**
 * Gửi email cảnh báo với thông tin vị trí cụ thể
 * @param type - Loại cảnh báo
 * @param lat - Latitude
 * @param lng - Longitude
 * @param additionalInfo - Thông tin bổ sung
 * @param recipientEmail - Email người nhận
 */
export async function sendAlertEmailWithLocation(
  type: AlertType,
  lat: number,
  lng: number,
  additionalInfo?: string,
  recipientEmail?: string
): Promise<boolean> {
  initEmailJS();

  const targetTemplateID = type === 'STAY_LONG' ? TEMPLATE_STAY_LONG : TEMPLATE_INTRUSION;
  const typeLabel = type === 'STAY_LONG' ? 'Đứng Lâu' : 'Xâm Nhập';

  console.log(`📨 Đang gửi email cảnh báo ${typeLabel} với vị trí...`);
  console.log(`📍 Vị trí: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  console.log(`📧 Gửi tới: ${recipientEmail || DEFAULT_RECIPIENT}`);

  const templateParams = {
    to_email: recipientEmail || DEFAULT_RECIPIENT,
    location_lat: lat.toFixed(6),
    location_lng: lng.toFixed(6),
    google_maps_link: `https://www.google.com/maps?q=${lat},${lng}`,
    additional_info: additionalInfo || ""
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      targetTemplateID,
      templateParams
    );
    console.log('🚀 GỬI EMAIL VỚI VỊ TRÍ THÀNH CÔNG!', response.status);
    return true;
  } catch (error) {
    console.error('❌ LỖI GỬI EMAIL:', error);
    return false;
  }
}
