import { NextResponse } from 'next/server';

export async function GET() {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const base64Key = Buffer.from(rawKey).toString('base64');
  
  return NextResponse.json({
    message: "Copy đoạn mã Base64 dưới đây để dán lên Vercel:",
    base64Key: base64Key
  });
}