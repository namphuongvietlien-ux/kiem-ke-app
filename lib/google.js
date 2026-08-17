import { google } from 'googleapis';

export async function getGoogleSheets() {
  try {
    let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";

    // Tự động giải mã Base64 nếu khóa trên Vercel ở dạng Base64
    if (privateKey && !privateKey.includes("BEGIN PRIVATE KEY")) {
      privateKey = Buffer.from(privateKey, 'base64').toString('utf-8');
    } else {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive',
      ],
    });

    const client = await auth.getClient();
    return google.sheets({ version: 'v4', auth: client });
  } catch (error) {
    console.error("Lỗi kết nối Google Sheets:", error.message);
    throw error;
  }
}