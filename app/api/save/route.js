import { NextResponse } from 'next/server';
import { getGoogleSheets } from '../../../lib/google'; 

export async function POST(request) {
  try {
    // 1. Nhận dữ liệu từ giao diện gửi lên
    const body = await request.json();
    const { store, barcode, name, sysQty, countQty, maVach, unit, diff, userName } = body;
    
    // 2. Tạo thời gian theo đúng chuẩn M/D/YYYY H:mm:ss (Giờ Việt Nam)
    const dateObj = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
    const month = dateObj.getMonth() + 1; // getMonth() đếm từ 0 nên phải +1
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();
    const hours = dateObj.getHours(); // Lưu theo hệ 24h
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');
    
    const timestamp = `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;

    // 3. Cấu trúc dòng dữ liệu sẽ lưu vào Sheet (11 Cột)
    // [Thời gian, Kho, Địa chỉ, Mã hàng, Tên SP, Tồn hệ thống, Thực tế, Lệch, Mã vạch, ĐVT, Người kiểm]
    const rowData = [
      timestamp, 
      store, 
      store, 
      barcode, 
      name, 
      sysQty, 
      countQty, 
      diff, 
      maVach, 
      unit, 
      (userName || "Không rõ") // Thêm tên người dùng vào cột K
    ];

    // 4. Gọi API Google Sheets
    const sheets = await getGoogleSheets();
    
    // Nối thêm (Append) dữ liệu vào cuối sheet "kiemke"
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'kiemke!A:K', // Nới rộng vùng lưu trữ ra cột K
      valueInputOption: 'USER_ENTERED', // Để Google Sheets tự nhận diện định dạng ngày/giờ và số
      requestBody: {
        values: [rowData],
      },
    });

    return NextResponse.json({ success: true, message: 'Đã lưu kiểm kê thành công!' });

  } catch (error) {
    console.error("Lỗi lưu dữ liệu:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}