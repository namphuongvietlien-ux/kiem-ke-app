import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google';

// Hàm phụ trợ tự động tìm tên tab
async function getValidSheetName(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetNames = meta.data.sheets.map(s => s.properties.title);
  
  const found = sheetNames.find(name => 
    name.toLowerCase().includes('kiemke') || 
    name.toLowerCase().includes('kiểm kê')
  );
  return found || sheetNames[0];
}

// 1. LẤY LỊCH SỬ (CÓ PHÂN QUYỀN)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const store = searchParams.get('store') || "";
    const currentUser = searchParams.get('currentUser') || ""; // Người đang đăng nhập
    const searchUser = searchParams.get('searchUser') || ""; // Tên người cần tìm

    // Khai báo tên Admin được cấp full quyền (viết thường để so sánh chuẩn)
    const isAdmin = currentUser.toLowerCase() === 'phuong' || currentUser.toLowerCase() === 'admin';

    const sheets = await getGoogleSheets();
    const spreadsheetId = process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;
    const targetSheetName = await getValidSheetName(sheets, spreadsheetId);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheetName}!A:J`,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return NextResponse.json({ success: true, data: [] });

    const dataRows = rows.slice(1);

    const history = dataRows.map((row, index) => ({
      rowIndex: index + 2,
      time: row[0] || "",
      store: row[1] || "",
      location: row[2] || "",
      maHang: row[3] || "",
      tenHang: row[4] || "",
      slHeThong: row[5] || 0,
      slThucTe: row[6] || 0,
      chenhLech: row[7] || 0,
      maVach: row[8] || "",
      userName: row[9] || ""
    })).filter(item => {
      if (isAdmin) {
        // ADMIN: Nếu gõ tìm kiếm -> Bỏ qua màng lọc kho, quét tất cả nhân viên trên toàn hệ thống
        if (searchUser.trim() !== "") {
          if (!item.userName.toLowerCase().includes(searchUser.toLowerCase())) return false;
        } else {
          // Nếu không gõ tìm kiếm -> Hiển thị kho hiện tại cho đỡ rối mắt
          if (store && item.store.toLowerCase() !== store.toLowerCase()) return false;
        }
        return true;
      } else {
        // NHÂN VIÊN THƯỜNG: Chỉ xem được data của mình ở Kho hiện tại
        if (store && item.store.toLowerCase() !== store.toLowerCase()) return false;
        if (item.userName.toLowerCase() !== currentUser.toLowerCase()) return false;
        return true;
      }
    });

    return NextResponse.json({ success: true, data: history.reverse() });
  } catch (error) {
    console.error("API History GET Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 2. CHỈNH SỬA SỐ LƯỢNG
export async function PUT(request) {
  try {
    const body = await request.json();
    const { rowIndex, newQty } = body;
    
    const sheets = await getGoogleSheets();
    const spreadsheetId = process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;
    const targetSheetName = await getValidSheetName(sheets, spreadsheetId);

    const getRow = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheetName}!A${rowIndex}:H${rowIndex}`,
    });

    const rowData = getRow.data.values[0];
    const slHeThong = parseFloat(rowData[5]) || 0;
    const newThucTe = parseFloat(newQty);
    const newChenhLech = newThucTe - slHeThong;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${targetSheetName}!G${rowIndex}:H${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[newThucTe, newChenhLech]]
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API History PUT Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 3. XÓA DÒNG
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rowIndex = parseInt(searchParams.get('rowIndex'));

    const sheets = await getGoogleSheets();
    const spreadsheetId = process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const targetSheetName = await getValidSheetName(sheets, spreadsheetId);
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === targetSheetName);
    const sheetId = sheet.properties.sheetId;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex
              }
            }
          }
        ]
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API History DELETE Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}