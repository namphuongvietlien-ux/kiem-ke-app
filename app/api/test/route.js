import { NextResponse } from 'next/server';

export async function GET() {
  // Lấy khóa gốc từ file .env.local trên máy tính của bạn
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  
  // Tiến hành nén chuỗi khóa thành dạng Base64 một dòng duy nhất
  const base64Key = Buffer.from(rawKey).toString('base64');
  
  return NextResponse.json({
    message: "Copy đoạn mã Base64 dưới đây để dán lên Vercel:",
    base64Key: base64Key
  });
}