import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google';

export async function POST(request) {
  try {
    const body = await request.json();
    const { store, barcode, name, countQty, unit, userName } = body;

    const sheets = await getGoogleSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Xác định tên sheet ngoài danh mục dựa theo tên cửa hàng hoặc sheet mặc định
    // (ví dụ: kho q7 -> ngoaidanhmuc q7, hoặc lưu chung vào sheet 'ngoaidanhmuc')
    let sheetName = 'ngoaidanhmuc';
    const storeLower = store ? store.toLowerCase() : '';
    if (storeLower.includes('q7')) {
      sheetName = 'ngoaidanhmuc q7';
    } else if (storeLower.includes('01') || storeLower.includes('02') || storeLower.includes('03') || storeLower.includes('04') || storeLower.includes('05') || storeLower.includes('06')) {
      // Tách lấy số cửa hàng hoặc quy ước tên sheet tương ứng
      const match = store.match(/kinh doanh (\d+)/);
      if (match) {
        sheetName = `ngoaidanhmuc${match[1]}`;
      }
    }

    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const rowData = [
      now,
      store,
      "", // Địa chỉ (nếu có)
      barcode,
      name,
      countQty,
      unit || "Cái",
      userName
    ];

    // Ghi dữ liệu xuống Google Sheets vào tab tương ứng
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:H`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [rowData],
      },
    });

    return NextResponse.json({ success: true, message: "Đã lưu vào danh mục ngoài!" });
  } catch (error) {
    console.error("Lỗi khi lưu ngoài danh mục:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}