'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  if (typeof val === 'number') return Math.round(val);
  let str = val.toString().trim();
  const num = parseFloat(str.replace(',', '.'));
  return isNaN(num) ? 0 : Math.round(num);
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

  const [recentSavedList, setRecentSavedList] = useState<any[]>([]);

  // State quản lý lịch sử và Tìm kiếm nhanh
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historySearchTerm, setHistorySearchTerm] = useState<string>(""); // State mới để tìm kiếm tức thì
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // State ngoài danh mục
  const [outsideBarcode, setOutsideBarcode] = useState<string>("");
  const [outsideName, setOutsideName] = useState<string>("");
  const [outsideUnit, setOutsideUnit] = useState<string>("Cái");
  const [outsideQty, setOutsideQty] = useState<string>("");
  
  const [progress, setProgress] = useState<any>(null);
  const [loadingProgress, setLoadingProgress] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [isScanningLive, setIsScanningLive] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Phân quyền Admin
  const isAdmin = userName.toLowerCase() === 'phuong' || userName.toLowerCase() === 'admin';

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

  useEffect(() => {
    if (step === 2 && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [step]);

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

  // Nâng cấp: Tải TOÀN BỘ dữ liệu lịch sử một lần, sau đó dùng Frontend để tìm kiếm tức thì
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/history?store=${encodeURIComponent(store)}&currentUser=${encodeURIComponent(userName)}`);
      const result = await res.json();
      if (result.success) setHistoryList(result.data);
    } catch (e) {
      console.error("Lỗi tải lịch sử:", e);
    }
    setLoadingHistory(false);
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
    }).slice(0, 20);
    
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
      sysQty: sysQty
    });
    
    setSearchQuery(""); 
    setSearchResults([]); 
    setCountQty(""); 
    setStep(3);
  };

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
                setOutsideBarcode(decodedText);
                setOutsideName("");
                setOutsideUnit("Cái");
                setOutsideQty("");
                setStep(4);
              }
            },
            () => {}
          );
        } catch (err) {
          alert("❌ Không thể mở camera. Vui lòng cấp quyền camera trong trình duyệt!");
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
        const savedMsg = `Đã lưu: ${selectedProduct.name} - SL: ${thucTeVal} ${selectedProduct.unit}`;
        setLastSaved(savedMsg);
        setRecentSavedList(prev => [{ name: selectedProduct.name, qty: thucTeVal, unit: selectedProduct.unit, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
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

  const handleSaveOutside = async () => {
    if (!outsideBarcode.trim()) return alert("Vui lòng nhập mã vạch / mã hàng!");
    if (!outsideName.trim()) return alert("Vui lòng nhập tên sản phẩm!");
    if (outsideQty === "") return alert("Vui lòng nhập số lượng thực tế!");

    setIsSaving(true);
    const payload = {
      store,
      barcode: outsideBarcode.trim(),
      name: outsideName.trim(),
      countQty: parseFloat(outsideQty) || 0,
      unit: outsideUnit.trim(),
      userName
    };

    try {
      const res = await fetch('/api/save-outside', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.success) {
        const savedMsg = `Đã lưu ngoài DM: ${outsideName} - SL: ${outsideQty}`;
        setLastSaved(savedMsg);
        setRecentSavedList(prev => [{ name: outsideName, qty: outsideQty, unit: outsideUnit, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
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

  const handleUpdateHistoryQty = async (rowIndex: number, currentQty: number) => {
    if (!isAdmin) return; 
    const newQtyStr = prompt("Nhập số lượng thực tế MỚI để lưu lại:", currentQty.toString());
    if (newQtyStr === null || newQtyStr.trim() === "") return;

    const newQty = parseFloat(newQtyStr);
    if (isNaN(newQty)) return alert("Số lượng không hợp lệ!");

    try {
      const res = await fetch('/api/history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex, newQty })
      });
      const result = await res.json();
      if (result.success) {
        alert("✅ Đã cập nhật số lượng thành công!");
        fetchHistory(); // Load lại dữ liệu mới
        loadProgress(store);
      } else {
        alert("Lỗi: " + result.error);
      }
    } catch (e) {
      alert("Lỗi kết nối máy chủ!");
    }
  };

  const handleDeleteHistoryRow = async (rowIndex: number) => {
    if (!isAdmin) return; 
    if (!confirm("⚠️ Chú ý: Bạn đang thực hiện quyền XÓA với tư cách Admin.\nBạn có chắc chắn muốn xóa vĩnh viễn dòng này không?")) return;

    try {
      const res = await fetch(`/api/history?rowIndex=${rowIndex}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (result.success) {
        alert("🗑️ Đã xóa dòng thành công!");
        fetchHistory();
        loadProgress(store);
      } else {
        alert("Lỗi: " + result.error);
      }
    } catch (e) {
      alert("Lỗi kết nối máy chủ!");
    }
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

  // Logic lọc dữ liệu trực tiếp trên Frontend (Instant Search)
  const displayedHistory = historyList.filter(item => {
    const term = historySearchTerm.toLowerCase();
    return (
      item.maHang.toLowerCase().includes(term) ||
      item.tenHang.toLowerCase().includes(term) ||
      (item.userName && item.userName.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
        <h4 className="text-primary fw-bold">⏳ Đang tải hệ thống và cơ sở dữ liệu kho...</h4>
      </div>
    );
  }

  return (
    <div className="container-fluid bg-light min-vh-100 py-4">
      <div className="container" style={{ maxWidth: '1200px' }}>
        
        {step > 0 && (
          <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom bg-white p-3 rounded-4 shadow-sm">
            <div>
              <h3 className="text-primary fw-bold m-0">🖥️ HỆ THỐNG KIỂM KÊ KHO (PC VERSION)</h3>
              <span className="text-muted small">Kho đang làm việc: <strong className="text-success">{store}</strong></span>
            </div>
            <div className="d-flex align-items-center gap-3">
              <span className={`badge fs-6 py-2 px-3 ${isAdmin ? 'bg-danger' : 'bg-secondary'}`}>
                {isAdmin ? '👑 Admin' : '👤 Nhân viên'}: {userName}
              </span>
              <button className="btn btn-outline-danger btn-sm fw-bold px-3" onClick={handleLogout}>Thoát tài khoản</button>
            </div>
          </div>
        )}

        {/* BƯỚC 0: ĐĂNG NHẬP */}
        {step === 0 && (
          <div className="row justify-content-center mt-5">
            <div className="col-md-6">
              <div className="card p-5 shadow border-0 rounded-4 bg-white">
                <h3 className="text-center text-primary mb-4 fw-bold">ĐĂNG NHẬP HỆ THỐNG</h3>
                <label className="form-label fw-bold">Tên nhân viên kiểm kê:</label>
                <input 
                  type="text" 
                  className="form-control form-control-lg mb-4" 
                  placeholder="Nhập tên đăng nhập..." 
                  value={userName} 
                  onChange={(e) => setUserName(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  autoFocus
                />
                <button className="btn btn-primary btn-lg w-100 fw-bold shadow-sm" onClick={handleLogin}>
                  Bắt đầu làm việc
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BƯỚC 1: CHỌN CỬA HÀNG */}
        {step === 1 && (
          <div className="row justify-content-center mt-5">
            <div className="col-md-6">
              <div className="card p-5 shadow border-0 rounded-4 bg-white">
                <h4 className="text-center text-secondary mb-4 fw-bold">CHỌN KHO / CỬA HÀNG KIỂM KÊ</h4>
                <label className="form-label fw-bold">Danh sách cửa hàng:</label>
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
                  Xác nhận vào kho
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BƯỚC 2: MÀN HÌNH CHÍNH PC */}
        {step === 2 && (
          <div className="row g-4">
            <div className="col-lg-7">
              <div className="card p-4 shadow border-0 rounded-4 bg-white h-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="text-primary fw-bold m-0">🔍 Tìm kiếm & Quét sản phẩm</h5>
                  <div>
                    <button className="btn btn-sm btn-outline-info me-2 fw-bold" onClick={() => { setStep(5); fetchHistory(); setHistorySearchTerm(""); }}>📋 Lịch sử nhập</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setStep(1)}>Đổi kho</button>
                  </div>
                </div>

                {lastSaved && <div className="alert alert-success py-2 small fw-bold shadow-sm mb-3">🔔 {lastSaved}</div>}

                <div className="mb-3">
                  <label className="form-label fw-bold text-dark">Nhập mã hàng, mã vạch hoặc tên sản phẩm:</label>
                  <input 
                    ref={searchInputRef}
                    type="text" 
                    className="form-control form-control-lg bg-light border-primary" 
                    placeholder="Gõ từ khóa để tìm nhanh sản phẩm..." 
                    value={searchQuery} 
                    onChange={handleSearch} 
                    autoComplete="off"
                  />
                </div>

                {searchResults.length > 0 && (
                  <div className="mb-3 position-relative">
                    <ul className="list-group shadow border rounded-3" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                      {searchResults.map((item: any, idx: number) => (
                        <li 
                          key={idx} 
                          className="list-group-item list-group-item-action py-3 px-3 d-flex justify-content-between align-items-center" 
                          style={{ cursor: 'pointer' }} 
                          onClick={() => selectProduct(item)}
                        >
                          <div>
                            <strong className="text-primary fs-6">{item[6]}</strong><br/>
                            <small className="text-muted">
                              Mã hàng: <strong>{item[0]}</strong> | Mã vạch: <strong>{item[2] || "N/A"}</strong>
                            </small>
                          </div>
                          <span className="badge bg-info text-dark fs-6">ĐVT: {item[8] || "-"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="d-flex gap-2 mt-3">
                  <button 
                    className={`btn ${isScanningLive ? 'btn-danger' : 'btn-success'} flex-grow-1 py-3 fw-bold shadow-sm`} 
                    onClick={toggleLiveCamera}
                  >
                    {isScanningLive ? "🛑 Tắt Camera Web" : "📷 Bật Camera Quét Mã"}
                  </button>

                  <button 
                    className="btn btn-warning flex-grow-1 py-3 fw-bold shadow-sm text-dark" 
                    onClick={() => {
                      setOutsideBarcode("");
                      setOutsideName("");
                      setOutsideUnit("Cái");
                      setOutsideQty("");
                      setStep(4);
                    }}
                  >
                    ➕ Thêm Ngoài Danh Mục
                  </button>
                </div>

                <div 
                  id="reader-container" 
                  className="w-100 mt-3 rounded-3 overflow-hidden shadow-sm" 
                  style={{ display: isScanningLive ? 'block' : 'none', minHeight: '280px', backgroundColor: '#000' }}
                ></div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card p-4 shadow border-0 rounded-4 bg-white mb-4">
                <h5 className="text-success fw-bold mb-3">📊 Tiến độ kiểm kê kho</h5>
                {loadingProgress ? (
                  <div className="text-center text-muted py-3">⏳ Đang tải dữ liệu tiến độ...</div>
                ) : progress ? (
                  <>
                    <div className="d-flex justify-content-between mb-1">
                      <span className="fw-bold text-secondary">Hoàn thành</span>
                      <span className="fw-bold text-primary fs-5">{progress.percent}%</span>
                    </div>
                    
                    <div className="progress mb-3" style={{ height: '22px' }}>
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
                      className="btn btn-outline-primary w-100 fw-bold py-2 mb-2" 
                      onClick={handleExportReport}
                      disabled={isExporting}
                    >
                      {isExporting ? "⏳ ĐANG XUẤT FILE EXCEL..." : "📥 TẢI BÁO CÁO CHÊNH LỆCH (EXCEL)"}
                    </button>
                  </>
                ) : (
                  <div className="text-center text-muted small">Chưa có dữ liệu tiến độ.</div>
                )}
              </div>

              <div className="card p-4 shadow border-0 rounded-4 bg-white">
                <h6 className="text-secondary fw-bold mb-3">🕒 Sản phẩm vừa lưu gần đây</h6>
                {recentSavedList.length === 0 ? (
                  <p className="text-muted small text-center mb-0">Chưa có sản phẩm nào được lưu trong phiên này.</p>
                ) : (
                  <div className="list-group list-group-flush" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {recentSavedList.map((item, idx) => (
                      <div key={idx} className="list-group-item px-0 py-2 d-flex justify-content-between align-items-center small">
                        <div>
                          <strong className="text-dark">{item.name}</strong><br/>
                          <span className="text-muted">{item.time}</span>
                        </div>
                        <span className="badge bg-success fs-6">SL: {item.qty} {item.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BƯỚC 3: NHẬP SỐ LƯỢNG VÀ LƯU */}
        {step === 3 && selectedProduct && (
          <div className="row justify-content-center">
            <div className="col-md-7">
              <div className="card p-5 shadow border-0 rounded-4 bg-white">
                <h4 className="text-primary fw-bold mb-3 border-bottom pb-2">Xác nhận số lượng thực tế</h4>
                
                <div className="row mb-3">
                  <div className="col-sm-6">
                    <p className="mb-1"><strong>Mã hàng:</strong> {selectedProduct.maHang}</p>
                    <p className="mb-1"><strong>Mã vạch:</strong> <span className="text-success fw-bold">{selectedProduct.barcode || "N/A"}</span></p>
                  </div>
                  <div className="col-sm-6">
                    <p className="mb-1"><strong>Đơn vị tính:</strong> <span className="text-info fw-bold">{selectedProduct.unit}</span></p>
                    <p className="mb-1"><strong>Tồn hệ thống:</strong> <span className="text-danger fw-bold fs-5">{selectedProduct.sysQty}</span></p>
                  </div>
                </div>

                <div className="mb-4 bg-light p-3 rounded-3 border">
                  <h5 className="text-dark fw-bold mb-2">{selectedProduct.name}</h5>
                </div>

                <div className="mb-4">
                  <label className="form-label fw-bold fs-5 text-success">📦 Nhập số lượng kiểm kê thực tế:</label>
                  <input 
                    type="number" 
                    className="form-control form-control-lg bg-light border-success fs-4 text-center fw-bold" 
                    placeholder="0" 
                    value={countQty} 
                    onChange={(e) => setCountQty(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    autoFocus 
                  />
                </div>
                
                <div className="d-flex gap-3">
                  <button className="btn btn-outline-secondary btn-lg flex-grow-1 fw-bold" onClick={() => setStep(2)} disabled={isSaving}>Hủy</button>
                  <button className="btn btn-success btn-lg flex-grow-2 fw-bold shadow-sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "⏳ ĐANG LƯU..." : "💾 LƯU VÀO KHO (Enter)"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BƯỚC 4: FORM NGOÀI DANH MỤC */}
        {step === 4 && (
          <div className="row justify-content-center">
            <div className="col-md-7">
              <div className="card p-5 shadow border-0 rounded-4 bg-white">
                <h4 className="text-warning fw-bold mb-3 border-bottom pb-2 text-dark">⚠️ Thêm Sản Phẩm Ngoài Danh Mục</h4>

                <div className="mb-3">
                  <label className="form-label fw-bold">Mã vạch / Mã hàng:</label>
                  <input type="text" className="form-control form-control-lg bg-light" value={outsideBarcode} onChange={(e) => setOutsideBarcode(e.target.value)} autoFocus />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Tên sản phẩm:</label>
                  <input type="text" className="form-control form-control-lg bg-light" value={outsideName} onChange={(e) => setOutsideName(e.target.value)} />
                </div>
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Đơn vị tính:</label>
                    <input type="text" className="form-control form-control-lg bg-light" value={outsideUnit} onChange={(e) => setOutsideUnit(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold">📦 Số lượng thực tế:</label>
                    <input type="number" className="form-control form-control-lg bg-light border-primary" value={outsideQty} onChange={(e) => setOutsideQty(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveOutside()} />
                  </div>
                </div>
                
                <div className="d-flex gap-3 mt-4">
                  <button className="btn btn-outline-secondary btn-lg flex-grow-1 fw-bold" onClick={() => setStep(2)} disabled={isSaving}>Hủy</button>
                  <button className="btn btn-warning btn-lg flex-grow-2 fw-bold text-dark shadow-sm" onClick={handleSaveOutside} disabled={isSaving}>
                    {isSaving ? "⏳ ĐANG LƯU..." : "💾 LƯU VÀO SHEET NGOÀI (Enter)"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BƯỚC 5: QUẢN LÝ LỊCH SỬ NHẬP (CÓ BẢO MẬT ADMIN & TÌM KIẾM NHANH) */}
        {step === 5 && (
          <div className="card p-0 shadow border-0 rounded-4 bg-white overflow-hidden">
            <div className="d-flex justify-content-between align-items-center p-4 border-bottom bg-light">
              <h4 className="text-primary fw-bold m-0">📋 Quản Lý Lịch Sử Kiểm Kê</h4>
              <button className="btn btn-secondary fw-bold shadow-sm" onClick={() => setStep(2)}>⬅ Quay lại trang chủ</button>
            </div>

            <div className="p-4">
              {/* THANH TÌM KIẾM ĐA NĂNG & TỨC THÌ */}
              <div className="row mb-4">
                <div className="col-12">
                  <label className="form-label fw-bold text-dark">
                    🔍 Tìm kiếm nhanh (Theo Mã, Tên, hoặc Tên nhân viên):
                  </label>
                  <input 
                    type="text" 
                    className="form-control form-control-lg border-primary shadow-sm" 
                    placeholder="Gõ từ khóa để lọc bảng ngay lập tức..." 
                    value={historySearchTerm} 
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    autoFocus
                  />
                  {!isAdmin && (
                    <div className="form-text text-info fw-bold mt-2">
                      📌 Chế độ nhân viên: Bạn chỉ xem và tìm kiếm được các mã hàng do bạn ({userName}) nhập tại kho {store}.
                    </div>
                  )}
                  {isAdmin && (
                    <div className="form-text text-danger fw-bold mt-2">
                      👑 Chế độ Admin: Đang hiển thị toàn bộ lịch sử của tất cả các kho trên hệ thống.
                    </div>
                  )}
                </div>
              </div>

              {loadingHistory ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status"></div>
                  <div className="mt-2 text-muted fw-bold">Đang tải dữ liệu lịch sử...</div>
                </div>
              ) : displayedHistory.length === 0 ? (
                <div className="text-center py-5 text-muted fw-bold bg-light rounded-3 border">
                  {historySearchTerm ? "Không tìm thấy dữ liệu nào khớp với từ khóa của bạn." : "Chưa có dữ liệu lịch sử nào."}
                </div>
              ) : (
                <div className="table-responsive border rounded-3" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  <table className="table table-hover table-bordered align-middle m-0">
                    <thead className="table-dark sticky-top">
                      <tr>
                        <th style={{ width: '10%' }}>Thời gian</th>
                        <th style={{ width: '8%' }}>Kho</th>
                        <th style={{ width: '10%' }}>Người nhập</th>
                        <th style={{ width: '12%' }}>Mã hàng</th>
                        <th>Tên sản phẩm</th>
                        <th className="text-center" style={{ width: '8%' }}>Hệ thống</th>
                        <th className="text-center" style={{ width: '8%' }}>Thực tế</th>
                        <th className="text-center" style={{ width: '9%' }}>Chênh lệch</th>
                        {/* CHỈ HIỆN CỘT THAO TÁC NẾU LÀ ADMIN */}
                        {isAdmin && <th className="text-center" style={{ width: '15%' }}>Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedHistory.map((item, idx) => (
                        <tr key={idx}>
                          <td><small className="text-muted">{item.time}</small></td>
                          <td><small className="text-secondary fw-bold">{item.store.replace('Kho Địa điểm kinh doanh ', 'Cửa hàng ')}</small></td>
                          <td>
                            {/* Hiển thị cả tên người dùng hoặc ĐVT để đề phòng Google Sheets sắp xếp cột sai */}
                            <span className="badge bg-secondary px-2 py-1">{item.userName || "N/A"}</span>
                          </td>
                          <td><strong className="text-primary">{item.maHang}</strong></td>
                          <td><span className="fw-medium">{item.tenHang}</span></td>
                          <td className="text-center bg-light">{item.slHeThong}</td>
                          <td className="text-center fw-bold text-success fs-5">{item.slThucTe}</td>
                          <td className={`text-center fw-bold fs-6 ${item.chenhLech < 0 ? 'text-danger' : item.chenhLech > 0 ? 'text-primary' : 'text-muted'}`}>
                            {item.chenhLech}
                          </td>
                          {/* CHỈ HIỆN NÚT SỬA XÓA NẾU LÀ ADMIN */}
                          {isAdmin && (
                            <td className="text-center">
                              <div className="d-flex justify-content-center gap-2">
                                <button 
                                  className="btn btn-sm btn-warning fw-bold text-dark d-flex align-items-center gap-1 shadow-sm" 
                                  onClick={() => handleUpdateHistoryQty(item.rowIndex, item.slThucTe)}
                                  title="Chỉnh sửa số lượng"
                                >
                                  ✏️ Sửa
                                </button>
                                <button 
                                  className="btn btn-sm btn-danger fw-bold d-flex align-items-center gap-1 shadow-sm" 
                                  onClick={() => handleDeleteHistoryRow(item.rowIndex)}
                                  title="Xóa dòng kiểm kê này"
                                >
                                  🗑️ Xóa
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}