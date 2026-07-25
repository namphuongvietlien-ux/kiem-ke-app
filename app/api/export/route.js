import { NextResponse } from 'next/server';
import { getGoogleSheets } from '../../../lib/google';

const parseQty = (val) => {
  if (val === "" || val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  let str = val.toString().trim().replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeName = searchParams.get('store');
    if (!storeName) return NextResponse.json({ success: false, error: "Thiếu tên cửa hàng" });
    
    const storeTrim = storeName.trim().toLowerCase();
    const sheets = await getGoogleSheets();
    
    // Kéo dữ liệu từ 3 sheet cùng lúc
    const [tonKhoRes, kiemKeRes, danhMucRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.SPREADSHEET_ID, range: 'TỔNG HỢP TỒN KHO!A:H' }),
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.SPREADSHEET_ID, range: 'kiemke!A:K' }),
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.SPREADSHEET_ID, range: 'danhmuc!A:I' })
    ]);

    const dataTK = tonKhoRes.data.values || [];
    const dataKK = kiemKeRes.data.values || [];
    const dataDM = danhMucRes.data.values || [];

    // 1. Tạo từ điển Danh mục sản phẩm (Tên, ĐVT, Giá vốn...)
    let productInfoMap = {};
    for (let d = 1; d < dataDM.length; d++) {
      let dmCode = String(dataDM[d][0] || "").trim();
      let dmName = String(dataDM[d][6] || "").trim();
      let dmUnit = String(dataDM[d][8] || "-").trim();
      if (dmCode) {
        productInfoMap[dmCode] = { name: dmName, unit: dmUnit };
      }
    }

    let rawStockMap = {}; 
    let checkedItemsMap = {};

    // 2. Gom Tồn kho
    for (let i = 1; i < dataTK.length; i++) {
      let row = dataTK[i];
      if (!row || row.length < 8) continue;
      let tkStore = String(row[0] || "").trim().toLowerCase();
      let tkMaHang = String(row[1] || "").trim();
      let tkQty = parseQty(row[7]);

      if (tkStore === storeTrim && tkMaHang !== "") {
        if (!rawStockMap[tkMaHang]) rawStockMap[tkMaHang] = 0;
        rawStockMap[tkMaHang] += tkQty;
      }
    }

    // 3. Gom số lượng Kiểm kê thực tế (Cộng dồn nếu quét nhiều lần)
    for (let i = 1; i < dataKK.length; i++) {
      let row = dataKK[i];
      if (!row || row.length < 7) continue;
      let kkStore = String(row[1] || "").trim().toLowerCase();
      let kkCode = String(row[3] || "").trim();
      let kkQty = parseQty(row[6]);

      if (kkStore === storeTrim && kkCode !== "") {
        if (!checkedItemsMap[kkCode]) checkedItemsMap[kkCode] = 0;
        checkedItemsMap[kkCode] += kkQty;
      }
    }

    // 4. Bắt đầu tổng hợp Pivot
    let allCodes = new Set();
    // Đưa vào những mã hệ thống có tồn
    for (let code in rawStockMap) { 
      if (rawStockMap[code] > 0.001) allCodes.add(code); 
    }
    // Đưa vào những mã thực tế đã kiểm (kể cả quét dư)
    for (let code in checkedItemsMap) { 
      allCodes.add(code); 
    }

    let reportData = [];

    allCodes.forEach(code => {
      let systemQty = rawStockMap[code] || 0;
      let actualQty = checkedItemsMap[code] || 0;
      let diff = actualQty - systemQty;
      
      let info = productInfoMap[code] || { name: "Sản phẩm ngoài danh mục", unit: "-" };
      
      let status = "Khớp";
      if (diff > 0.001) status = "Dư hàng";
      else if (diff < -0.001) status = "Thiếu hàng";

      reportData.push({
        maHang: code,
        tenHang: info.name,
        dvt: info.unit,
        slHeThong: systemQty,
        slThucTe: actualQty,
        chenhLech: diff,
        trangThai: status
      });
    });

    // Sắp xếp báo cáo: Thiếu -> Dư -> Khớp
    reportData.sort((a, b) => a.chenhLech - b.chenhLech);

    return NextResponse.json({ success: true, data: reportData });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}