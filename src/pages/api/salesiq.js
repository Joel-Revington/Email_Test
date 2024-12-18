import { supabase } from "../../../client";
import { google } from "googleapis";

// Decode Google credentials
const getGoogleCredentials = () => {
  try {
    return JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS, "base64").toString()
    );
  } catch (error) {
    console.error("Error decoding Google credentials:", error);
    throw new Error("Invalid Google credentials");
  }
};

const spreadsheetId = process.env.SPREADSHEET_ID;

export default async function handler(req, res) {

  // Validate incoming request body
  const visitor = req.body.entity?.visitor;
  if (!visitor) {
    console.error("Visitor data is missing from the request body.");
    return res.status(400).json({ success: false, error: "Visitor data is missing" });
  }

  const { name, email, phone } = visitor;

  // Validate required fields and trim whitespace
  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    console.error("Required fields (name, email, phone) are missing or invalid.");
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

    // Handle Google Sheets appending
    const credentials = getGoogleCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const sheetRow = [
      [name.trim(), email.trim(), phone.trim()],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: "Sheet1", // Adjust sheet name as necessary
      valueInputOption: "USER_ENTERED",
      resource: { values: sheetRow },
    });

    console.log("Data appended to Google Sheets successfully.");

    // Respond success
    return res.status(200).json({
      success: true,
      message: "Data successfully saved to Supabase and Google Sheets",
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ success: false, error: error.message || "Unexpected error occurred" });
  }
}
