'use client';

import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as XLSX from 'xlsx';

const STORES: string[] = [
  "Kho Địa điểm kinh doanh Q7", "Kho Địa điểm kinh doanh 01", 
  "Kho Địa điểm kinh doanh 02", "Kho Địa điểm kinh doanh 03",
  "Kho Địa điểm kinh doanh 04", "Kho Địa điểm kinh doanh 05",
  "Kho Địa điểm kinh doanh 06", "Kho Tổng công ty"
];

const parseQty = (val: any): number => {
  if (val === "" || val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  let str = val.toString().trim().replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

export default function Home() {
  const [data, setData] = useState<{ tonKho: any[]; danhMuc: any[] }>({ tonKho: [], danhMuc: [] });
  const [loading, setLoading] = useState<boolean>(true);
  
  const [step, setStep] = useState<number>(0); 
  const [userName, setUserName] = useState<string>("");
  const [store, setStore] = useState<string>("");
  
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [countQty, setCountQty] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<string>("");
  
  const [progress, setProgress] = useState<any>(null);
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [isScanningLive, setIsScanningLive] = useState<boolean>(false);

  useEffect(() => {
    const savedName = localStorage.getItem("kiemke_username");
    if (savedName) {
      setUserName(savedName);
      setStep(1); 
    }
    
    fetch('/api/data')
      .then(res => res.json())
      .then(res => {
        if(res.success) setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Lỗi tải dữ liệu:", err);
        setLoading(false);
      });
  }, []);

  const loadProgress = async (storeName: string) => {
    setLoadingProgress(true);
    try {
      const res = await fetch(`/api/progress?store=${encodeURIComponent(storeName)}`);
      if (!res.ok) { setLoadingProgress(false); return; }
      const result = await res.json();
      if (result.success) setProgress(result.data);
    } catch (e) {
      console.error("Lỗi API Progress:", e);
    }
    setLoadingProgress(false);
  };

  const handleLogin = () => {
    if (!userName.trim()) return alert("Vui lòng nhập tên của bạn để tiếp tục!");
    localStorage.setItem("kiemke_username", userName.trim());
    setStep(1);
  };

  const handleLogout = () => {
    localStorage.removeItem("kiemke_username");
    setUserName(""); 
    setStore(""); 
    setStep(0);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length < 2) { 
      setSearchResults([]); 
      return; 
    }
    
    const qClean = query.toLowerCase().trim();
    const results = data.danhMuc.filter((row: any) => {
      if(row.length < 7 || !row[6] || String(row[6]).trim() === "") return false;
      const ma = String(row[0]).toLowerCase();
      const maVach = String(row[2] || "").toLowerCase();
      const ten = String(row[6]).toLowerCase();
      return ma.includes(qClean) || maVach.includes(qClean) || ten.includes(qClean);
    }).slice(0, 15);
    
    setSearchResults(results);
  };

  const selectProduct = (item: any) => {
    const maHang = String(item[0]).trim();
    const maVach = String(item[2] || "").trim();
    let sysQty = 0;
    
    const tonRow = data.tonKho.find((r: any) => 
      String(r[0]).trim().toLowerCase() === store.trim().toLowerCase() && 
      String(r[1]).trim() === maHang
    );
    
    if (tonRow) sysQty = parseQty(tonRow[7]);
    
    setSelectedProduct({
      maHang: maHang, 
      barcode: maVach, 
      name: String(item[6] || ""), 
      unit: String(item[8] || "-"), 
      sysQty: sysQty,
      isOutside: false
    });
    
    setSearchQuery(""); 
    setSearchResults([]); 
    setCountQty(""); 
    setStep(3);
  };

  // Xử lý khi quét hoặc nhập mã chưa có trong danh mục -> Hỏi để lưu vào ngoài danh mục
  const handleUnknownCode = (scannedCode: string) => {
    const customName = prompt(`❌ Mã "${scannedCode}" không có trong danh mục chính!\n\nNhập TÊN SẢN PHẨM để lưu vào ngoài danh mục:`);
    if (!customName || !customName.trim()) return;

    const unitInput = prompt("Nhập Đơn vị tính (Ví dụ: Hộp, Cái, Bao, Lọ...):", "Cái") || "Cái";
    const qtyInput = prompt("Nhập số lượng kiểm kê thực tế:", "1");
    if (qtyInput === null) return;

    saveOutsideProduct({
      store,
      barcode: scannedCode,
      name: customName.trim(),
      countQty: parseFloat(qtyInput) || 0,
      unit: unitInput,
      userName
    });
  };

  const saveOutsideProduct = async (payload: any) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/save-outside', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        setLastSaved(`✅ Đã lưu ngoài danh mục: ${payload.name} (SL: ${payload.countQty})`);
        setStep(2);
        loadProgress(store);
      } else {
        alert("Lỗi: " + result.error);
      }
    } catch (e) {
      alert("Lỗi kết nối mạng khi lưu ngoài danh mục!");
    }
    setIsSaving(false);
  };

  // Camera Trực Tiếp (Hỗ trợ iOS / Android mượt mà)
  const toggleLiveCamera = async () => {
    if (isScanningLive) {
      setIsScanningLive(false);
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const scanner = new Html5Qrcode("reader-container");
        await scanner.stop();
      } catch (e) {}
    } else {
      setIsScanningLive(true);
      setTimeout(async () => {
        try {
          const { Html5Qrcode } = await import('html5-qrcode');
          const scanner = new Html5Qrcode("reader-container");
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
            (decodedText) => {
              scanner.stop().catch(() => {});
              setIsScanningLive(false);
              const qClean = decodedText.toLowerCase().trim();
              const found = data.danhMuc.find((row: any) => 
                String(row[0]).toLowerCase().trim() === qClean || 
                String(row[2]).toLowerCase().trim() === qClean
              );
              if (found) {
                selectProduct(found);
              } else {
                handleUnknownCode(decodedText);
              }
            },
            () => {}
          );
        } catch (err) {
          alert("❌ Không thể mở camera. Vui lòng cấp quyền camera trong Safari/Trình duyệt!");
          setIsScanningLive(false);
        }
      }, 300);
    }
  };

  const handleSave = async () => {
    if (countQty === "") return alert("Vui lòng nhập số lượng kiểm kê thực tế!");
    setIsSaving(true);
    
    const thucTeVal = parseFloat(countQty);
    const diff = thucTeVal - selectedProduct.sysQty;
    
    const payload = {
      store, 
      barcode: selectedProduct.maHang, 
      name: selectedProduct.name,
      sysQty: selectedProduct.sysQty, 
      countQty: thucTeVal,
      maVach: selectedProduct.barcode, 
      unit: selectedProduct.unit, 
      diff, 
      userName
    };
    
    try {
      const res = await fetch('/api/save', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      const result = await res.json();
      
      if (result.success) {
        setLastSaved(`✅ Đã lưu: ${selectedProduct.name} (SL Thực Tế: ${thucTeVal})`);
        setStep(2); 
        loadProgress(store);
      } else {
        alert("❌ Lỗi từ server: " + result.error);
      }
    } catch (err) { 
      alert("❌ Lỗi mạng, không thể kết nối đến máy chủ!"); 
    }
    
    setIsSaving(false);
  };

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/export?store=${encodeURIComponent(store)}`);
      if (!res.ok) throw new Error("Lỗi Server khi tải báo cáo");
      
      const result = await res.json();
      if (!result.success) {
        alert("Lỗi xuất dữ liệu: " + result.error);
        setIsExporting(false); 
        return;
      }
      
      const reportData = result.data;
      const formattedData = reportData.map((item: any) => ({
        "Mã hàng": item.maHang,
        "Tên hàng": item.tenHang,
        "ĐVT": item.dvt,
        "Hệ thống": item.slHeThong,
        "Thực tế": item.slThucTe,
        "Chênh lệch": item.chenhLech,
        "Trạng thái": item.trangThai
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      worksheet['!cols'] = [
        {wch: 15}, {wch: 50}, {wch: 8}, {wch: 12}, {wch: 12}, {wch: 12}, {wch: 15}
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCaoKiemKe");
      
      const fileName = `${store.replace(/[^a-zA-Z0-9]/g, "_")}_BaoCao.xlsx`;
      XLSX.writeFile(workbook, fileName);

    } catch (e) {
      alert("Lỗi mạng khi xuất báo cáo!");
      console.error(e);
    }
    setIsExporting(false);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <h4 className="text-primary">⏳ Đang tải hệ thống và dữ liệu kho...</h4>
      </div>
    );
  }

  return (
    <div className="container mt-4 pb-5" style={{ maxWidth: '600px' }}>
      
      {step > 0 && (
        <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom">
          <h5 className="text-primary fw-bold m-0">Kiểm Kê Kho</h5>
          <div className="d-flex align-items-center">
            <span className="badge bg-secondary me-2 fs-6">👤 {userName}</span>
            <button className="btn btn-sm btn-outline-danger" onClick={handleLogout}>Thoát</button>
          </div>
        </div>
      )}

      {/* BƯỚC 0: ĐĂNG NHẬP */}
      {step === 0 && (
        <div className="card p-4 shadow border-0 bg-light rounded-4 mt-5">
          <h3 className="text-center text-primary mb-4 fw-bold">ĐĂNG NHẬP HỆ THỐNG</h3>
          <label className="form-label fw-bold">Tên nhân viên kiểm kê:</label>
          <input 
            type="text" 
            className="form-control form-control-lg mb-4" 
            placeholder="Ví dụ: Nguyễn Văn A" 
            value={userName} 
            onChange={(e) => setUserName(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button className="btn btn-primary btn-lg w-100 fw-bold shadow-sm" onClick={handleLogin}>
            Bắt đầu
          </button>
        </div>
      )}

      {/* BƯỚC 1: CHỌN CỬA HÀNG */}
      {step === 1 && (
        <div className="card p-4 shadow border-0 bg-light rounded-4">
          <label className="form-label fw-bold">Chọn cửa hàng / địa chỉ:</label>
          <select 
            className="form-select mb-4 form-select-lg" 
            value={store} 
            onChange={(e) => setStore(e.target.value)}
          >
            <option value="">-- Chọn cửa hàng --</option>
            {STORES.map((s: string) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button 
            className="btn btn-primary btn-lg w-100 fw-bold shadow-sm" 
            onClick={() => { 
              if(!store) alert("Vui lòng chọn cửa hàng!"); 
              else { 
                setStep(2); 
                loadProgress(store); 
              } 
            }}
          >
            Tiếp tục
          </button>
        </div>
      )}

      {/* BƯỚC 2: TÌM KIẾM, CAMERA VÀ TIẾN ĐỘ */}
      {step === 2 && (
        <div className="card p-4 shadow border-0 rounded-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="text-success m-0 fw-bold">Đang kiểm: {store}</h6>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setStep(1)}>Đổi kho</button>
          </div>

          <div className="mb-4 bg-light p-3 rounded-3 border position-relative">
            {loadingProgress ? (
              <div className="text-center text-muted small">⏳ Đang cập nhật tiến độ...</div>
            ) : progress ? (
              <>
                <div className="d-flex justify-content-between mb-1">
                  <span className="fw-bold text-secondary">Tiến độ kiểm kê</span>
                  <span className="fw-bold text-primary">{progress.percent}%</span>
                </div>
                
                <div className="progress mb-2" style={{ height: '20px' }}>
                  <div 
                    className="progress-bar bg-success progress-bar-striped progress-bar-animated" 
                    role="progressbar" 
                    style={{ width: `${progress.percent}%` }}
                  ></div>
                </div>
                
                <div className="d-flex justify-content-between small text-muted mb-3">
                  <span>Đã kiểm: <strong>{progress.checkedItems} / {progress.totalItems}</strong> mã</span>
                  <span>Khớp: <strong className="text-success">{progress.matchCount}</strong> | Lệch: <strong className="text-danger">{progress.diffCount}</strong></span>
                </div>
                
                <button 
                  className="btn btn-outline-primary btn-sm w-100 fw-bold" 
                  onClick={handleExportReport}
                  disabled={isExporting}
                >
                  {isExporting ? "⏳ ĐANG TẠO FILE EXCEL..." : "📥 TẢI BÁO CÁO CHÊNH LỆCH (EXCEL)"}
                </button>
              </>
            ) : (
              <div className="text-center text-muted small">Chưa có dữ liệu tiến độ.</div>
            )}
          </div>

          {lastSaved && <div className="alert alert-success py-2 small fw-bold shadow-sm">{lastSaved}</div>}

          {/* Nút bật/tắt camera trực tiếp */}
          <button 
            className={`btn ${isScanningLive ? 'btn-danger' : 'btn-success'} w-100 py-3 mb-3 fw-bold shadow-sm`} 
            style={{fontSize: '18px'}}
            onClick={toggleLiveCamera}
          >
            {isScanningLive ? "🛑 TẮT CAMERA QUÉT" : "📷 MỞ CAMERA QUÉT TRỰC TIẾP"}
          </button>

          <div 
            id="reader-container" 
            className="w-100 mb-4 rounded-3 overflow-hidden shadow-sm" 
            style={{ display: isScanningLive ? 'block' : 'none', minHeight: '300px', backgroundColor: '#000' }}
          ></div>

          <label className="form-label fw-bold text-primary">🔍 Nhập mã hoặc tên sản phẩm:</label>
          <div className="position-relative">
            <input 
              type="text" 
              className="form-control form-control-lg bg-light" 
              placeholder="Gõ tìm kiếm để xem gợi ý..." 
              value={searchQuery} 
              onChange={handleSearch} 
              autoComplete="off"
            />
            
            {searchResults.length > 0 && (
              <ul className="list-group position-absolute w-100 shadow-lg mt-1" style={{ zIndex: 1000, maxHeight: '300px', overflowY: 'auto' }}>
                {searchResults.map((item: any, idx: number) => (
                  <li 
                    key={idx} 
                    className="list-group-item list-group-item-action" 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => selectProduct(item)}
                  >
                    <strong>{item[6]}</strong><br/>
                    <small className="text-muted">
                      Mã: {item[0]} | Mã vạch: {item[2] || "N/A"} | ĐVT: <span className="fw-bold text-info">{item[8] || "-"}</span>
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* BƯỚC 3: NHẬP SỐ LƯỢNG VÀ LƯU */}
      {step === 3 && selectedProduct && (
        <div className="card p-4 shadow border-0 rounded-4">
          <h5 className="text-primary fw-bold mb-3 border-bottom pb-2">Sản phẩm tìm thấy</h5>
          
          <p className="mb-1"><strong>Mã hàng:</strong> {selectedProduct.maHang}</p>
          <p className="mb-1"><strong>Mã vạch:</strong> <span className="text-success fw-bold">{selectedProduct.barcode || "N/A"}</span></p>
          <p className="mb-1"><strong>Tên:</strong> {selectedProduct.name}</p>
          <p className="mb-3"><strong>Tồn hệ thống:</strong> <span className="text-danger fw-bold fs-5">{selectedProduct.sysQty}</span> {selectedProduct.unit}</p>

          <label className="form-label fw-bold mt-2">📦 Số lượng kiểm kê thực tế:</label>
          <input 
            type="number" 
            className="form-control form-control-lg mb-4 bg-light border-primary" 
            placeholder="Nhập số lượng thực tế..." 
            value={countQty} 
            onChange={(e) => setCountQty(e.target.value)} 
            autoFocus 
          />
          
          <button 
            className="btn btn-success btn-lg w-100 fw-bold mb-3 shadow-sm" 
            onClick={handleSave} 
            disabled={isSaving}
          >
            {isSaving ? "⏳ ĐANG LƯU VÀO GOOGLE SHEETS..." : "💾 LƯU KIỂM KÊ"}
          </button>
          
          <button 
            className="btn btn-outline-secondary w-100 fw-bold" 
            onClick={() => setStep(2)} 
            disabled={isSaving}
          >
            Hủy & Quay lại
          </button>
        </div>
      )}
    </div>
  );
}