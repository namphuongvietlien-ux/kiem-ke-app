import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log("1. Đang kiểm tra biến môi trường...");
    if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.SPREADSHEET_ID) {
      throw new Error("Thiếu biến môi trường! Vui lòng kiểm tra lại file .env.local");
    }

    console.log("2. Khởi tạo Google Auth...");
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // Dấu xuống dòng trong khóa private_key rất hay bị lỗi khi đọc từ file .env
        private_key: process.env.GOOGLE_PRIVATE_KEY.split('\\n').join('\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    console.log("3. Bắt đầu gọi API Google Sheets...");
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: 'TỔNG HỢP TỒN KHO!A1:H10', 
    });

    console.log("4. Thành công!");
    return NextResponse.json({ 
      success: true, 
      message: 'Kết nối thành công!',
      data: response.data.values 
    });

  } catch (error) {
    console.error(">>> LỖI CỤ THỂ:", error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}