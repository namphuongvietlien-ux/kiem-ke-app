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
      return NextResponse.json({ success: true, totalCounted: 0, countedBy: "" });
    }

    const sheets = await getGoogleSheets();
    const spreadsheetId = process.env.SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;
    const targetSheetName = await getValidSheetName(sheets, spreadsheetId);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${targetSheetName}!A:J`,
      valueRenderOption: 'UNFORMATTED_VALUE', 
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return NextResponse.json({ success: true, totalCounted: 0, countedBy: "" });

    let total = 0;
    let users = new Set(); // Dùng Set để lọc trùng lặp tên người nhập
    
    const searchCode = String(code).toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    for (let i = 1; i < rows.length; i++) {
      const rowStore = String(rows[i][1] || "").toLowerCase().trim();
      
      if (rowStore === store.toLowerCase().trim()) {
        const rowMaHang = String(rows[i][3] || "").toLowerCase().replace(/[^a-z0-9]/g, '');
        
        let rowMaVachRaw = String(rows[i][8] || "").toLowerCase().trim();
        if (rowMaVachRaw.endsWith('.0')) rowMaVachRaw = rowMaVachRaw.slice(0, -2);
        const rowMaVach = rowMaVachRaw.replace(/[^a-z0-9]/g, '');

        let slThucTe = 0;
        if (typeof rows[i][6] === 'number') {
          slThucTe = rows[i][6];
        } else {
          let str = String(rows[i][6] || "0").trim();
          str = str.replace(/,/g, '.'); 
          slThucTe = parseFloat(str) || 0;
        }

        if (
          (rowMaHang && rowMaHang === searchCode) || 
          (rowMaVach && rowMaVach === searchCode) ||
          (rowMaVach && searchCode.length >= 5 && rowMaVach.endsWith(searchCode))
        ) {
          total += slThucTe;
          
          // Lấy tên người đã nhập (Cột J - index 9)
          const userName = String(rows[i][9] || "").trim();
          if (userName) users.add(userName);
        }
      }
    }

    total = Math.round(total * 100) / 100;
    
    // Nối danh sách người đã kiểm thành chuỗi (Ví dụ: "Phượng, Thoa")
    const countedBy = Array.from(users).join(", ");

    return NextResponse.json({ success: true, totalCounted: total, countedBy });
  } catch (error) {
    console.error("API Counted GET Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}