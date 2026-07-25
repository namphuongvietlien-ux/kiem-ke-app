import { NextResponse } from 'next/server';
import { getGoogleSheets } from '../../../lib/google';

// Hàm ép kiểu số lượng chính xác (nhận diện dấu phẩy/chấm)
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
    
    // Đọc rộng range ra cột K để đảm bảo không bị hụt dữ liệu
    const [tonKhoRes, kiemKeRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.SPREADSHEET_ID, range: 'TỔNG HỢP TỒN KHO!A:K' }),
      sheets.spreadsheets.values.get({ spreadsheetId: process.env.SPREADSHEET_ID, range: 'kiemke!A:K' })
    ]);

    const dataTK = tonKhoRes.data.values || [];
    const dataKK = kiemKeRes.data.values || [];

    let rawStockMap = {};
    let validStockMap = {};
    let checkedItemsMap = {};

    let totalSystemQty = 0;
    let totalCheckedQty = 0;

    // 1. GOM TỒN KHO HỆ THỐNG
    for (let i = 1; i < dataTK.length; i++) {
      let row = dataTK[i];
      if (!row || row.length < 8) continue;
      
      let tkStore = String(row[0] || "").trim().toLowerCase();
      let tkMaHang = String(row[1] || "").trim();
      let tkQty = parseQty(row[7]); // Cột H

      if (tkStore === storeTrim && tkMaHang !== "") {
        if (!rawStockMap[tkMaHang]) rawStockMap[tkMaHang] = 0;
        rawStockMap[tkMaHang] += tkQty;
      }
    }

    // Chỉ lấy các mã có Tồn > 0 làm mục tiêu (Mẫu số)
    let totalStockItems = 0;
    for (let code in rawStockMap) {
      if (rawStockMap[code] > 0.001) {
        validStockMap[code] = rawStockMap[code];
        totalStockItems++;
        totalSystemQty += rawStockMap[code];
      }
    }

    // 2. GOM SỐ LIỆU ĐÃ KIỂM KÊ
    for (let i = 1; i < dataKK.length; i++) {
      let row = dataKK[i];
      if (!row || row.length < 7) continue;
      
      let kkStore = String(row[1] || "").trim().toLowerCase();
      let kkCode = String(row[3] || "").trim(); // Cột D
      let kkQty = parseQty(row[6]); // Cột G

      if (kkStore === storeTrim && kkCode !== "") {
        if (!checkedItemsMap[kkCode]) checkedItemsMap[kkCode] = 0;
        // Nếu cùng 1 mã quét nhiều lần, số lượng sẽ được cộng dồn
        checkedItemsMap[kkCode] += kkQty;
        totalCheckedQty += kkQty;
      }
    }

    // 3. TÍNH TOÁN ĐỐI CHIẾU CHÍNH XÁC
    // Số mã duy nhất user đã quét
    let checkedItems = Object.keys(checkedItemsMap).length; 
    let matchCount = 0;
    let diffCount = 0;
    let validCheckedCount = 0; // Số mã ĐÃ QUÉT nằm trong danh sách cần kiểm

    // Kiểm tra từng mã ĐÃ QUÉT
    for (let checkedCode in checkedItemsMap) {
      let actual = checkedItemsMap[checkedCode];
      let system = validStockMap[checkedCode] || 0; // Mã ngoài luồng tự động system = 0

      // Khớp hay lệch
      if (Math.abs(actual - system) < 0.001) {
        matchCount++;
      } else {
        diffCount++;
      }

      // Nếu mã này thuộc danh sách hệ thống yêu cầu
      if (validStockMap[checkedCode] !== undefined) {
        validCheckedCount++;
      }
    }

    // Phần trăm hoàn thành (Không bao giờ vượt 100%)
    let percent = 0;
    if (totalStockItems > 0) {
      percent = Math.min(100, Math.round((validCheckedCount / totalStockItems) * 100));
    } else if (checkedItems > 0) {
      percent = 100; // Kho không có tồn nhưng có kiểm => Xong 100%
    }

    return NextResponse.json({
      success: true,
      data: {
        totalItems: totalStockItems,
        checkedItems: checkedItems,
        percent: percent,
        matchCount: matchCount,
        diffCount: diffCount,
        totalSystemQty: totalSystemQty,
        totalCheckedQty: totalCheckedQty
      }
    });

  } catch (error) {
    console.error("Lỗi API Progress:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}