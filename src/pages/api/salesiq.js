import { supabase } from "../../../client";
import { google } from "googleapis";

const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);
const spreadsheetId = process.env.SPREADSHEET_ID;

export default async function handler(req, res) {
  console.log("Headers:", req.headers);
  
  // Validate incoming request body
  const visitor = req.body.entity?.visitor;
  if (!visitor) {
    console.error("Visitor data is missing from the request body.");
    return res.status(400).json({ success: false, error: "Visitor data is missing" });
  }

  const { name, email: email, phone } = visitor;
  if (!name || !email || !phone) {
    console.error("Required fields (name, email, phone) are missing.");
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  res.setHeader("Content-Type", "application/json");

  try {
    // Insert data into Supabase
    const { data: user, error } = await supabase
      .from("Leads")
      .insert([{ name: name.trim(), email: email.trim(), phone: phone.trim() }]);

    if (error) {
      console.error("Supabase error:", error);
      return res.status(400).json({ success: false, error: error.message });
    }

    console.log("Supabase data:", user);

    // Now handle Google Sheets appending in a separate try-catch block
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });
      const sheetRow = [
        [name.trim(), email.trim(), phone.trim()],
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: "Sheet1",
        valueInputOption: "USER_ENTERED",
        resource: { values: sheetRow },
      });

      console.log("Data added to Google Sheets successfully");

      // Respond with success after both operations
      return res.status(200).json({ success: true, user });

    } catch (googleError) {
      console.error("Google Sheets API error:", googleError);
      return res.status(500).json({ success: false, error: "Failed to update Google Sheets" });
    }

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ success: false, error: "Unexpected error occurred" });
  }
}
