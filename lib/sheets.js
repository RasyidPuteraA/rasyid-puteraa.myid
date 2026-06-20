const { google } = require("googleapis");
const path = require("path");

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, "../credentials.json"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = "1IWOQlwA0Jt5RLyYQSVkTHB5CMurA8TlIh1ak5tOIxqg";

async function getSheetData(sheetName) {
  const client = await auth.getClient();

  const response = await sheets.spreadsheets.values.get({
    auth: client,
    spreadsheetId: SPREADSHEET_ID,
    range: sheetName,
  });

  const rows = response.data.values;

  if (!rows || rows.length === 0) return [];

  const headers = rows[0];
  const data = rows.slice(1);

  return data.map((row) => {
    let obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || "";
    });
    return obj;
  });
}

module.exports = {
  getSheetData,
};
