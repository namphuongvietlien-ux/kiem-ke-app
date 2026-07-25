import { getGoogleSheets } from '@/lib/google';
import { NextResponse } from 'next/server';

// Khởi tạo Biến lưu trữ tạm trên RAM (Cache)
let cachedData = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // Cache lưu trong 5 phút (300.000 ms)

export async function GET() {
  try {
    const now = Date.now();
    
    // NẾU ĐÃ CÓ CACHE VÀ CHƯA QUÁ 5 PHÚT -> TRẢ VỀ NGAY LẬP TỨC TỪ RAM
    if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
      return NextResponse.json({ 
        success: true, 
        message: 'Lấy dữ liệu từ RAM Cache (Siêu tốc ⚡)', 
        data: cachedData 
      });
    }

    // NẾU CHƯA CÓ CACHE -> GỌI GOOGLE SHEETS
    console.log("Đang tải dữ liệu từ Google Sheets...");
    const sheets = await getGoogleSheets();
    
    // Gọi song song (Promise.all) cả 2 sheet cùng lúc để tiết kiệm 50% thời gian
    const [tonKhoRes, danhMucRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'TỔNG HỢP TỒN KHO!A:H', 
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: process.env.SPREADSHEET_ID,
        range: 'danhmuc!A:I', 
      })
    ]);

    // Lưu vào RAM
    cachedData = {
      tonKho: tonKhoRes.data.values,
      danhMuc: danhMucRes.data.values
    };
    lastFetchTime = now;

    return NextResponse.json({ 
      success: true, 
      message: 'Lấy dữ liệu mới từ Google Sheets thành công!',
      data: cachedData 
    });

  } catch (error) {
    console.error("LỖI:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}