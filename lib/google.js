import { google } from 'googleapis';

export async function getGoogleSheets() {
  try {
    // Tự động xử lý lỗi chuỗi private key bị mất định dạng xuống dòng trên Vercel
    const privateKey = process.env.GOOGLE_PRIVATE_KEY 
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') 
      : '';

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
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    return sheets;
  } catch (error) {
    console.error("Lỗi kết nối Google Sheets:", error.message);
    throw error;
  }
}