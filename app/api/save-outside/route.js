import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google';

export async function POST(request) {
  try {
    const body = await request.json();
    const { store, location, barcode, name, countQty, unit, userName } = body;

    const sheets = await getGoogleSheets();
    
    // Sử dụng trực tiếp process.env.GOOGLE_SHEET_ID hoặc biến mà API lưu chính đang dùng
    const spreadsheetId = process.env.GOOGLE_SHEET_ID || process.env.SHEET_ID;

    // Phân loại tên sheet ngoài danh mục theo kho
    let sheetName = 'ngoaidanhmuc';
    const storeLower = store ? store.toLowerCase() : '';
    if (storeLower.includes('q7')) {
      sheetName = 'ngoaidanhmuc q7';
    } else if (storeLower.includes('ph')) {
      sheetName = 'ngoaidanhmucph';
    } else if (storeLower.includes('q4c')) {
      sheetName = 'ngoaidanhmuc q4c';
    } else {
      const match = store.match(/kinh doanh (\d+)/i);
      if (match) {
        sheetName = `ngoaidanhmuc ${match[1]}`.toLowerCase();
      }
    }

    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const rowData = [
      now,
      store,
      location || "", 
      barcode,
      name,
      countQty,
      unit || "Cái",
      userName
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:H`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [rowData],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lỗi lưu ngoài danh mục:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}