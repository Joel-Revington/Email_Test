import { supabase } from "../../../client"; // Import Supabase client
import { google } from "googleapis"; // Import Google APIs

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

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    // Handle CORS preflight
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "POST") {
    try {
      console.log("Incoming request body:", req.body);

      const {
        OrderReceived,
        email,
        company,
        ContactName,
        ContractNumber,
        StartDate,
        EndDate,
        products,
      } = req.body;

      // Parse products if it's a stringified JSON
      let parsedProducts = products;
      if (typeof products === "string") {
        try {
          parsedProducts = JSON.parse(products);
        } catch (error) {
          console.error("Error parsing 'products':", error.message);
          return res.status(400).json({ error: "Invalid 'products' JSON format" });
        }
      }

      if (!Array.isArray(parsedProducts)) {
        return res.status(400).json({ error: "'products' must be an array" });
      }

      // Prepare records for Supabase
      const records = [];
      parsedProducts.forEach((product) => {
        if (product.ProductDescription) {
          for (let i = 0; i < product.Quantity; i++) {
            records.push({
              OrderReceived,
              email,
              company,
              ContactName,
              ContractNumber,
              StartDate,
              EndDate,
              ProductDescription: product.ProductDescription,
              NewRenewal: product.NewRenewal,
              Term: product.Term,
              Quantity: 1, // Split Quantity into individual rows
            });
          }
        }
      });

      console.log("Prepared records:", records);

      // Insert into Supabase
      const { data, error: supabaseError } = await supabase
        .from("EmailTest") // Replace with your actual table name
        .insert(records);

      if (supabaseError) {
        console.error("Supabase error:", supabaseError);
        return res.status(500).json({ error: "Failed to save to Supabase", details: supabaseError });
      }

      console.log("Data inserted into Supabase:", data);

      // Save to Google Sheets
      try {
        const credentials = getGoogleCredentials();

        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const sheets = google.sheets({ version: "v4", auth });

        const sheetRows = records.map((record) => [
          record.OrderReceived,
          record.email,
          record.company,
          record.ContactName,
          record.ContractNumber,
          record.StartDate,
          record.EndDate,
          record.ProductDescription,
          record.NewRenewal,
          record.Term,
          record.Quantity,
        ]);

        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: "Sheet1", // Adjust sheet name as necessary
          valueInputOption: "USER_ENTERED",
          resource: { values: sheetRows },
        });

        console.log("Data appended to Google Sheets successfully.");
      } catch (googleError) {
        console.error("Error saving to Google Sheets:", googleError);
        return res
          .status(500)
          .json({ error: "Failed to save to Google Sheets", details: googleError });
      }

      // Respond success
      res.status(200).json({ message: "Data saved successfully", data });
    } catch (error) {
      console.error("Error handling request:", error);
      res.status(500).json({ error: error.message || "Unknown error occurred" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
