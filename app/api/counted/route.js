import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/google';

async function getValidSheetName(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetNames = meta.data.sheets.map(s => s.properties.title);
  
  const found = sheetNames.find(name => 
    name.toLowerCase().includes('kiemke') || 
    name.toLowerCase().includes('kiểm kê')
  );
  return found || sheetNames[0];
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const store = searchParams.get('store');
    const code = searchParams.get('code');

    if (!store || !code) {
      return NextResponse.json({ success: true, totalCounted: 0 });
    }

    const sheets = await getGoogleSheets();
    const spreadsheetId = process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;
    const targetSheetName = await getValidSheetName(sheets, spreadsheetId);

    // QUAN TRỌNG: Dùng UNFORMATTED_VALUE để lấy chính xác giá trị số, bỏ qua mọi dấu chấm phẩy định dạng của Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheetName}!A:J`,
      valueRenderOption: 'UNFORMATTED_VALUE', 
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return NextResponse.json({ success: true, totalCounted: 0 });

    let total = 0;
    
    // Xóa toàn bộ ký tự lạ, khoảng trắng, chỉ giữ lại chữ cái và số để so khớp tuyệt đối
    const searchCode = String(code).toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    // Bỏ qua dòng tiêu đề (index 0)
    for (let i = 1; i < rows.length; i++) {
      const rowStore = String(rows[i][1] || "").toLowerCase().trim();
      
      // Chỉ cộng dồn nếu đúng kho đang kiểm
      if (rowStore === store.toLowerCase().trim()) {
        const rowMaHang = String(rows[i][3] || "").toLowerCase().replace(/[^a-z0-9]/g, '');
        
        let rowMaVachRaw = String(rows[i][8] || "").toLowerCase().trim();
        if (rowMaVachRaw.endsWith('.0')) rowMaVachRaw = rowMaVachRaw.slice(0, -2);
        const rowMaVach = rowMaVachRaw.replace(/[^a-z0-9]/g, '');

        // Lấy số lượng thực tế an toàn tuyệt đối
        let slThucTe = 0;
        if (typeof rows[i][6] === 'number') {
          slThucTe = rows[i][6];
        } else {
          let str = String(rows[i][6] || "0").trim();
          str = str.replace(/,/g, '.'); // Quy chuẩn đổi hết phẩy thành chấm
          slThucTe = parseFloat(str) || 0;
        }

        // Kiểm tra khớp Mã Hàng HOẶC khớp 1 phần Mã Vạch (từ 5 số trở lên)
        if (
          (rowMaHang && rowMaHang === searchCode) || 
          (rowMaVach && rowMaVach === searchCode) ||
          (rowMaVach && searchCode.length >= 5 && rowMaVach.endsWith(searchCode))
        ) {
          total += slThucTe;
        }
      }
    }

    // Làm tròn 2 chữ số thập phân (khắc phục lỗi Javascript 0.1 + 0.2 = 0.3000000004)
    total = Math.round(total * 100) / 100;

    return NextResponse.json({ success: true, totalCounted: total });
  } catch (error) {
    console.error("API Counted GET Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}